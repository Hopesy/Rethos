export function freezeAnswer(got) {
  if (got.status === 409 && typeof got.body?.busy === "string") return { busy: got.body.busy, ...(typeof got.body.what === "string" ? { what: got.body.what } : {}) };
  if (!got.ok || got.body?.frozen !== true) throw Object.assign(new Error("Rethos on this computer could not pause."), { status: got.status });
  return { frozen: true };
}

export function createWindowActivity(window, now = Date.now) {
  let lastInput = 0;
  const watched = new WeakSet();
  return () => {
    const win = window();
    if (win && !win.isDestroyed() && !watched.has(win.webContents)) {
      watched.add(win.webContents);
      win.webContents.on("before-input-event", () => { lastInput = now(); });
      lastInput = Math.max(lastInput, now());
    }
    return lastInput;
  };
}

export function installWorkspaceMove({ ipcMain, guard, move, page }) {
  const notice = () => ({ move: move().view() ?? undefined });
  const publish = () => {
    const contents = page();
    if (contents && !contents.isDestroyed()) contents.send("workspace-move:notice", notice());
  };
  ipcMain.handle("workspace-move:notice", guard("workspace-move:notice", notice));
  ipcMain.handle("workspace-move:retry", guard("workspace-move:retry", async () => { await move().retry(); publish(); return notice(); }));
  ipcMain.handle("workspace-move:dismiss", guard("workspace-move:dismiss", () => { move().seen(); publish(); return notice(); }));
  return { publish };
}
