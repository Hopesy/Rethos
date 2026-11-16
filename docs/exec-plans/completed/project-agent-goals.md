# Project agents and continuous goals

## Completed task

User request (2026-11-16): verify and complete the main-bot → project-bot →
file handoff → returned result → project-memory workflow, then remove the
fixed 13-turn team-goal ceiling. Progress should continue unattended until
completion, a genuine blocker, a person decision, cancellation, or an existing
resource policy stops it. Cancelled monitoring stays cancelled.

Base: `65c81356d`, `codex/upstream-sync`. All mutations use disposable fixtures.
Scripts and evidence: `.Rethos-temp/project-agent-goals/`.

## Work

- [x] Verify the team-management, file-return and memory tools together through
  a main bot's real turn; repair integration gaps and clarify its workflow.
- [x] Remove the fixed goal-turn ceiling from room and direct goals, prompts,
  run receipts and the current progress display; keep legacy receipts readable.
- [x] Retain cancellation, spend caps, failed-provider recovery and repeated-work
  detection. Exercise long goals beyond 13 turns and genuine stalled work.
- [x] Validate the goal card in an isolated renderer, run targeted regressions,
  typecheck and lint; record results and remaining limits.

## Findings

- The fixed ceiling appears in the shared loop, both host adapters, prompts,
  card payload and renderer. Increasing the constant would preserve the defect.
- Existing coordination passes files into the receiving conversation's inbox
  and returns attached results to the requester. The new combined fixture
  verifies team setup, file transfer, result resumption and memory together.
- Project autonomy reuses the existing coordinator, memory and approval
  modules. This change does not introduce a second scheduler or permission model.

## Acceptance

The regression failed on the original 13-turn implementation (41 expected,
13 actual), then passed with 41 direct turns and 31 team turns. Real isolated
servers completed 19-turn goals in direct and group chats. The combined
project workflow passed with all five project bots and their separate memory.
Browser acceptance showed turn 20 still working in both themes and at 390px,
then persisted Stop at turn 20. Typecheck, lint and locale checks passed.

Details and evidence: [delivery record](../../histories/2026-11-16-project-agent-goals.md).
