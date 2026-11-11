type Target = { dismiss: () => void; priority: number; order: number };
const targets = new Set<Target>();
const listeners = new Set<() => void>();
let sequence = 0;
let top: Target | null = null;

function publish() {
  const next = [...targets].sort((a, b) => b.priority - a.priority || b.order - a.order)[0] ?? null;
  if (next === top) return;
  top = next;
  for (const listener of listeners) listener();
}

export function registerMobileBackTarget(dismiss: () => void, priority = 0): () => void {
  const target = { dismiss, priority, order: ++sequence };
  targets.add(target);
  publish();
  return () => { targets.delete(target); publish(); };
}

export const mobileBackTarget = () => top;
export function subscribeMobileBack(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
