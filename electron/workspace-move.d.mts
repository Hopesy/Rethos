import type { OneHomeView } from "./one-home.mjs";

export interface WorkspaceMoveNotice { move?: OneHomeView }
export interface WorkspaceMoveBridge {
  notice(): Promise<WorkspaceMoveNotice>;
  dismiss(signature?: string): Promise<WorkspaceMoveNotice>;
  moveRetry(): Promise<WorkspaceMoveNotice>;
  onNotice(listener: (notice: WorkspaceMoveNotice) => void): () => void;
}
