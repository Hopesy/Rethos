/** Owner-scoped connection status returned by GET /api/shared-computers. */
export interface SharedComputerStatus {
  id: string;
  name: string;
  online: boolean;
  busy: boolean;
  lastSeenAt: number;
  botPermissions?: boolean;
  platform?: "darwin" | "win32" | "linux";
  access?: "enabled" | "paused" | "revoked";
  scopes: {
    folders: { id: string; name: string; write: boolean }[];
    terminal: boolean;
    screen: boolean;
    internet: boolean;
    chrome: boolean;
  };
}

/** Previously connected computers remain visible while offline or unshared. */
export interface KnownLentComputer {
  id: string;
  name: string;
  platform: "darwin" | "win32" | "linux" | null;
  online: boolean;
  busy: boolean;
  lent: boolean;
  access?: "enabled" | "paused" | "revoked";
  lastSeenAt: number;
  lastUsedAt: number | null;
  scopes: { folders: number; terminal: boolean; screen: boolean; internet: boolean; chrome: boolean };
}

export interface ConnectedComputersStatus {
  computers: SharedComputerStatus[];
  known: KnownLentComputer[];
}
