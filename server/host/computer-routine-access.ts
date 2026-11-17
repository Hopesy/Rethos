import { createHash } from "node:crypto";
import { runsOnce } from "../../shared/limit-reset.ts";
import { createCloudRoutineAuthors, routineFingerprint } from "../cloud-lending.ts";
import type { HandoffView } from "../coordinator.ts";
import { lendingPersonKey, personKey, type OwnServer } from "../person-key.ts";
import type { Routine, RoutineRun } from "../routines.ts";
import type { PublicSession } from "../sessions.ts";
import { onlyTheirs, type ActingLine, type DirectRequest } from "./acting-person.ts";

type Turn = { botId: string; threadId: string; generation: string };

export function createComputerRoutineAccess(deps: {
  file: string;
  ownServer(): OwnServer;
  sessions(): readonly PublicSession[];
  request(threadId: string): DirectRequest | undefined;
  messages(threadId: string): readonly ActingLine[];
  starter(threadId: string): string | undefined;
  routine(id: string): Routine | undefined;
  run(threadId: string): RoutineRun | null;
  taskRun(botId: string, threadId: string): string | undefined;
  manualPerson(runId: string): string | undefined;
  assignment(turn: Turn): HandoffView | undefined;
  node(id: string): HandoffView | undefined;
}) {
  const authors = createCloudRoutineAuthors(deps.file, routine => createHash("sha256").update(routineFingerprint(routine)).update(String(routine.enabled)).digest("hex"));

  const principal = (person: string | undefined): string | null => {
    const own = deps.ownServer();
    if (!own || !person) return null;
    const session = deps.sessions().find(session => personKey(session) === person && session.scopes.includes("admin")
      && !session.owner && !session.teamRole && (!session.email || session.email.trim().toLowerCase() === own.admin));
    return session ? lendingPersonKey(session, own) : null;
  };

  const personForRun = (turn: Turn): string | null => {
    const request = deps.request(turn.threadId), run = deps.run(turn.threadId);
    if (!request || request.stopped || !request.generations.has(turn.generation) || !run || run.botId !== turn.botId
      || deps.taskRun(turn.botId, turn.threadId) !== run.id || !["running", "waiting"].includes(run.status)) return null;
    const trigger = run.triggerSource ?? (run.manual ? "manual" : "schedule");
    if (request.automation !== trigger || !["schedule", "manual", "startup"].includes(trigger)) return null;
    const routine = deps.routine(run.routineId), person = authors.writer(run.routineId);
    if (!routine || (!routine.enabled && !runsOnce(routine.schedule)) || !person || !principal(person) || (trigger === "manual" && deps.manualPerson(run.id) !== person)
      || !authors.authored(routine.id, { ...routine, enabled: true }) || !authors.authored(routine.id, {
        ...routine, prompt: run.prompt, target: run.target, botId: run.botId, groupId: run.groupId,
        attachments: run.attachments, runOn: run.runOn, enabled: true,
      })) return null;
    if (principal(deps.starter(turn.threadId)) !== principal(person) || !onlyTheirs(deps.messages(turn.threadId), person, 0)) return null;
    return person;
  };

  return {
    authors,
    principal,
    record(routine: Routine, person: string | null) {
      if (person && principal(person)) authors.record(routine.id, routine, person);
      else authors.forget(routine.id);
    },
    person(turn: Turn): string | null {
      const request = deps.request(turn.threadId);
      if (!request || request.stopped || !request.generations.has(turn.generation)) return null;
      if (request.automation !== undefined) return personForRun(turn);
      let node = deps.assignment(turn);
      if (!node || node.threadId !== turn.threadId || node.botId !== turn.botId) return null;
      const threads = new Set([turn.threadId]);
      // Security: only the coordinator's live parent chain can carry a routine's authority; model text never names it.
      while (node.parentId) {
        if (!["running", "waiting", "resume"].includes(node.status)) return null;
        threads.add(node.threadId);
        node = deps.node(node.parentId);
        if (!node) return null;
      }
      const person = personForRun({ botId: node.botId, threadId: node.threadId, generation: node.id });
      return person && [...threads].every(threadId => onlyTheirs(deps.messages(threadId), person, 0)) ? person : null;
    },
  };
}
