import { registerRemotes } from "@module-federation/enhanced/runtime";
import type { RemoteEntryType, RemoteSourcePolicy } from "@federlet/shared-types";
import { assertRemoteEntrySourceAllowed } from "./remote-source-policy";

export interface RuntimeRemoteEntry {
  remoteName: string;
  entry: string;
  remoteEntryType?: RemoteEntryType;
  entryGlobalName?: string;
}

export interface RegisterRuntimeRemoteEntriesOptions {
  sourcePolicy?: RemoteSourcePolicy;
}

interface RuntimeRemoteRegistration {
  name: string;
  entry: string;
  type?: RemoteEntryType;
  entryGlobalName?: string;
}

function looksLikeEsmRemoteEntry(source: string) {
  return /(^|\n)\s*import\s+[\s\S]*?\sfrom\s*["']/.test(source) ||
    /(^|\n)\s*export\s+/.test(source);
}

async function detectRemoteEntryType(entry: RuntimeRemoteEntry) {
  if (entry.remoteEntryType) {
    return entry.remoteEntryType;
  }

  if (typeof fetch !== "function") {
    return undefined;
  }

  try {
    const response = await fetch(entry.entry);
    const source = await response.text();

    return looksLikeEsmRemoteEntry(source) ? "module" : undefined;
  } catch {
    return undefined;
  }
}

async function toRuntimeRemoteRegistration(
  entry: RuntimeRemoteEntry,
): Promise<RuntimeRemoteRegistration> {
  const remoteEntryType = await detectRemoteEntryType(entry);

  return {
    name: entry.remoteName,
    entry: entry.entry,
    ...(remoteEntryType ? { type: remoteEntryType } : {}),
    ...(entry.entryGlobalName ? { entryGlobalName: entry.entryGlobalName } : {}),
  };
}

/**
 * 将 manifest 中的 remoteEntry 动态注册进 Module Federation runtime。
 *
 * `force: true` 确保 Apollo/manifest 切换版本后，Shell 使用最新入口。
 */
export async function registerRuntimeRemoteEntries(
  entries: RuntimeRemoteEntry[],
  options: RegisterRuntimeRemoteEntriesOptions = {},
) {
  if (entries.length === 0) {
    return;
  }

  for (const entry of entries) {
    assertRemoteEntrySourceAllowed(
      entry.remoteName,
      entry.entry,
      options.sourcePolicy,
    );
  }

  const remotes = await Promise.all(entries.map(toRuntimeRemoteRegistration));

  registerRemotes(
    remotes,
    { force: true },
  );
}
