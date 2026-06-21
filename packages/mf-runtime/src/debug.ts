import type {
  RuntimeRemoteLoadHealth,
  RuntimeRemoteRegistrationStatus,
  RuntimeRemoteRegistry,
} from "./remote-registry";
import type { RemoteEntryType } from "@federlet/shared-types";

export interface RemoteDebugSnapshotItem {
  entry?: string;
  exposedModule: string;
  id: string;
  lastErrorMessage?: string;
  loadHealth: RuntimeRemoteLoadHealth;
  registrationStatus: RuntimeRemoteRegistrationStatus;
  remoteEntryType?: RemoteEntryType;
  remoteName: string;
  title: string;
  updatedAt: number;
}

export interface RemoteDebugSnapshot {
  remotes: RemoteDebugSnapshotItem[];
}

function formatLastError(error: unknown) {
  if (error === undefined) {
    return undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function createRemoteDebugSnapshot(
  registry: RuntimeRemoteRegistry,
): RemoteDebugSnapshot {
  return {
    remotes: registry.listRoutes().map((route) => {
      const record = registry.getByRouteId(route.id);
      const health = record?.health;

      return {
        entry: record?.entry,
        exposedModule: route.exposedModule,
        id: route.id,
        lastErrorMessage: formatLastError(health?.lastError),
        loadHealth: health?.loadHealth ?? "unknown",
        registrationStatus: health?.registrationStatus ?? "registered",
        remoteEntryType: record?.remoteEntryType,
        remoteName: route.remoteName,
        title: route.title,
        updatedAt: health?.updatedAt ?? 0,
      };
    }),
  };
}
