# Project agents and continuous goals — 2026-11-16

User goal: a main agent manages project agents, sends files with assignments,
receives results, updates project memory and continues authorized project work.
This slice also removes the fixed 13-turn goal-run ceiling.

Base commit: `65c81356d`, branch `codex/upstream-sync`. Evidence refers to the
working changes in the goal loop, its direct/room adapters, card protocol and
renderer, Chief guidance and their regression tests.

## Delivered

- Chief guidance covers reusable project bots, known project/session context,
  deliverables and acceptance checks, file handoffs, evidence review, rework,
  separate project memory and verified portfolio memory.
- The goal loop and both adapters have no fixed turn ceiling. Prompts and
  new receipts no longer advertise a remaining turn count. Old receipts retain
  their interpretation through the optional wire field.
- Current progress shows the running turn. Stop, spend caps, provider retry,
  repeated-assignment detection and busy-resource waits keep their existing
  behavior.

## Evidence

All mutations used isolated fake-engine fixtures; the user's real bots and
project data were untouched. The model's planning and work were scripted to
verify the application integration deterministically.

- `server/project-agent-workflow.e2e.test.ts`: one request to the actual default
  bot creates five project bots, sends a brief in two legal fan-out batches,
  returns five report files, resumes the requester, writes each specialist's
  memory and the main bot's portfolio summary, and completes its goal. File
  bytes and memory isolation are checked. The fixture retains a `.workflow.json`
  beside its server log.
- Goal unit checks: 41 solo turns and 31 team turns; original implementation
  stopped the 41-turn case at 13. Logs: `baseline.log`, `goal-unit.log` and
  `final-regression.log` under `.Rethos-temp/project-agent-goals/`.
- Goal server checks: 19 direct and 19 group turns, cancellation, busy waits,
  failures and routine execution. Logs: `workflow-e2e.log`, `team-e2e.log`.
- Handoff, system-prompt and Chief regressions: `workflow-final.log`, followed
  by the updated Chief text and card checks in `prompt-card-final.log`.
- Typecheck, lint, locale and verification-document checks passed. Final logs
  are in the same evidence directory.
- Ego browser, real goal at turn 20: dark and light themes, 390px without
  horizontal overflow, Stop persisted as `stopped` at turn 20. Screenshots:
  `goal-turn-20-dark.png`, `goal-turn-20-mobile.png`. The fixture and browser
  test space were closed after acceptance.

[Completed plan](../exec-plans/completed/project-agent-goals.md).
