export const CHAT_TURN_LIMITS = Object.freeze({
  steps: 1_024,
  toolCalls: 10_000,
});

export const turnBudgetStopMessage = (count: string) =>
  `Stopped after ${count} without a final answer. The steps so far already ran, so ask only for what's left.`;
