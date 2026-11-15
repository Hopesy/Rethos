# Taking control of a bot's computer

Run the focused checks in disposable homes:

```sh
pnpm exec vitest run src/components/ComputerPanel.takeover.test.ts src/components/computer-takeover.test.ts src/components/ComputerPanel.simple.test.ts
```

The panel checks mount the real `ComputerPanel` with its real control requests;
only the live desktop itself is a stand-in. They prove:

- On a Local VM or a VPS, **Take control** turns the panel's own picture into
  the live desktop at once, and **Full screen** takes control straight into a
  view that fills the window. Nothing opens in another window or tab. The take
  carries this view's control lease.
- **Hand control back** releases the computer at once and the panel returns to
  watching.
- Closing the panel, leaving its Computer view, opening another conversation or
  closing the page gives back the hold this view took, with a keepalive request,
  and never a hold another device has.
- A hand-back from elsewhere ends the live view once it has lasted a second and
  a half; an out-of-order event does not end it.
- A desktop that never comes up gives the computer back and says so.
- Handing back a VPS also closes its viewer tunnel.

The private VPS viewer and lease paths are covered by `server/vps-routing.test.ts`. Connected computers expose their actual screen capabilities through the [native connector fixture](connected-computer.md).
