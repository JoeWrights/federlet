import { registerRemotes } from "@module-federation/enhanced/runtime";
import type { RemoteEntryType } from "@federlet/shared-types";

export interface RuntimeRemoteEntry {
  remoteName: string;
  entry: string;
  remoteEntryType?: RemoteEntryType;
  entryGlobalName?: string;
}

/**
 * 将 manifest 中的 remoteEntry 动态注册进 Module Federation runtime。
 *
 * `force: true` 确保 Apollo/manifest 切换版本后，Shell 使用最新入口。
 */
export function registerRuntimeRemoteEntries(entries: RuntimeRemoteEntry[]) {
  if (entries.length === 0) {
    return;
  }

  registerRemotes(
    entries.map((entry) => ({
      name: entry.remoteName,
      entry: entry.entry,
      ...(entry.remoteEntryType ? { type: entry.remoteEntryType } : {}),
      ...(entry.entryGlobalName ? { entryGlobalName: entry.entryGlobalName } : {}),
    })),
    { force: true },
  );
}
