import { registerRuntimeRemoteEntries } from "./runtime-remotes";
import type {
  RemoteEntryType,
  RemoteRouteConfig,
  RuntimeRemoteManifest,
  RuntimeRemoteManifestItem,
} from "@federlet/shared-types";
import type { RuntimeRemoteEntry } from "./runtime-remotes";

/**
 * 默认的 remote 暴露模块名，用于 fallback 静态配置。
 */
const DEFAULT_REMOTE_EXPOSED_MODULE = "./mount";

/**
 * 远程应用注册状态。
 */
export type RuntimeRemoteRegistrationStatus = "registered" | "failed";

/**
 * 远程应用加载健康状态。
 */
export type RuntimeRemoteLoadHealth = "unknown" | "healthy" | "degraded" | "unavailable";

/**
 * 远程应用健康状态。
 */
export interface RuntimeRemoteHealth {
  /**
   * 最后一次错误。
   */
  lastError?: unknown;
  /**
   * 加载健康状态。
   */
  loadHealth: RuntimeRemoteLoadHealth;
  /**
   * 注册状态。
   */
  registrationStatus: RuntimeRemoteRegistrationStatus;
  /**
   * 更新时间。
   */
  updatedAt: number;
}

/**
 * 远程应用定义。
 */
export interface RuntimeRemoteDefinition extends RemoteRouteConfig {
  /**
   * 远程入口。
   */
  entry?: string;
  /**
   * 远程入口加载格式。
   */
  remoteEntryType?: RemoteEntryType;
  /**
   * var remote 挂载到全局对象上的名称。
   */
  entryGlobalName?: string;
  /**
   * 元数据。
   */
  meta?: Record<string, unknown>;
}

/**
 * 远程应用记录。
 */
export interface RuntimeRemoteRecord extends RuntimeRemoteDefinition {
  /**
   * 健康状态。
   */
  health: RuntimeRemoteHealth;
}

/**
 * 远程应用健康状态补丁。
 */
export interface RuntimeRemoteHealthPatch {
  /**
   * 最后一次错误。
   */
  lastError?: unknown;
  /**
   * 加载健康状态。
   */
  loadHealth?: RuntimeRemoteLoadHealth;
  /**
   * 注册状态。
   */
  registrationStatus?: RuntimeRemoteRegistrationStatus;
}

/**
 * 远程应用注册表。
 */
export interface RuntimeRemoteRegistry {
  /**
   * 清空注册表。
   */
  clear(): void;
  /**
   * 根据远程应用名称获取记录。
   */
  getByName(remoteName: string): RuntimeRemoteRecord | undefined;
  /**
   * 根据路由 ID 获取记录。
   */
  getByRouteId(routeId: string): RuntimeRemoteRecord | undefined;
  /**
   * 列出所有路由。
   */
  listRoutes(): RemoteRouteConfig[];
  /**
   * 注册多个远程应用。
   */
  registerMany(definitions: RuntimeRemoteDefinition[]): void;
  /**
   * 更新远程应用健康状态。
   */
  updateHealth(remoteName: string, patch: RuntimeRemoteHealthPatch): void;
}

/**
 * 引导远程应用注册表的选项。
 */
export interface BootstrapRuntimeRemoteRegistryOptions {
  /**
   * 回退路由配置。
   */
  fallbackRoutes: RemoteRouteConfig[];
  /**
   * 运行时环境。
   */
  manifest?: RuntimeRemoteManifest;
  /**
   * 注册远程入口的函数。
   */
  registerRemoteEntries?: (entries: RuntimeRemoteEntry[]) => void | Promise<void>;
  /**
   * 注册表。
   */
  registry?: RuntimeRemoteRegistry;
  /**
   * 运行时环境。
   */
  runtimeEnv?: string;
  /**
   * Shell 协议版本。
   */
  shellProtocolVersion: string;
}

/**
 * 创建初始健康状态。
 * @param now - 时间函数。
 */
function createInitialHealth(now: () => number): RuntimeRemoteHealth {
  return {
    loadHealth: "unknown",
    registrationStatus: "registered",
    updatedAt: now(),
  };
}

/**
 * 将远程应用定义转换为路由配置。
 * @param route - 远程应用定义。
 * @returns 路由配置。
 */
function toRemoteRoute(route: RuntimeRemoteDefinition): RemoteRouteConfig {
  return {
    basename: route.basename,
    exposedModule: route.exposedModule,
    id: route.id,
    path: route.path,
    remoteName: route.remoteName,
    title: route.title,
  };
}

/**
 * 克隆远程应用记录。
 * @param record - 远程应用记录。
 * @returns 克隆后的远程应用记录。
 */
function cloneRecord(record: RuntimeRemoteRecord): RuntimeRemoteRecord {
  return {
    ...record,
    health: {
      ...record.health,
    },
  };
}

/**
 * 创建远程应用注册表。
 * @param now - 时间函数。
 */
export function createRuntimeRemoteRegistry(
  now: () => number = () => Date.now(),
): RuntimeRemoteRegistry {
  const recordsByName = new Map<string, RuntimeRemoteRecord>();
  const routeIdToRemoteName = new Map<string, string>();

  return {
    /**
     * 清空注册表。
     */
    clear() {
      recordsByName.clear();
      routeIdToRemoteName.clear();
    },
    /**
     * 根据远程应用名称获取记录。
     * @param remoteName - 远程应用名称。
     * @returns 远程应用记录。
     */
    getByName(remoteName) {
      const record = recordsByName.get(remoteName);

      return record ? cloneRecord(record) : undefined;
    },
    /**
     * 根据路由 ID 获取记录。
     * @param routeId - 路由 ID。
     * @returns 远程应用记录。
     */
    getByRouteId(routeId) {
      const remoteName = routeIdToRemoteName.get(routeId);

      return remoteName ? this.getByName(remoteName) : undefined;
    },
    /**
     * 列出所有路由。
     */
    listRoutes() {
      return [...recordsByName.values()].map(toRemoteRoute);
    },
    /**
     * 注册多个远程应用。
     * @param definitions - 远程应用定义。
     */
    registerMany(definitions) {
      for (const definition of definitions) {
        const existing = recordsByName.get(definition.remoteName);
        const record: RuntimeRemoteRecord = {
          ...definition,
          health: existing?.health ?? createInitialHealth(now),
        };

        recordsByName.set(definition.remoteName, record);
        routeIdToRemoteName.set(definition.id, definition.remoteName);
      }
    },
    /**
     * 更新远程应用健康状态。
     * @param remoteName - 远程应用名称。
     * @param patch - 健康状态补丁。
     */
    updateHealth(remoteName, patch) {
      const record = recordsByName.get(remoteName);

      if (!record) {
        return;
      }

      record.health = {
        ...record.health,
        ...patch,
        updatedAt: now(),
      };
    },
  };
}

/**
 * 远程应用注册表实例。
 */
export const runtimeRemoteRegistry = createRuntimeRemoteRegistry();

/**
 * 判断是否为记录。
 * @param value - 值。
 * @returns 是否为记录。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 判断是否为 manifest 远程。
 * @param value - 值。
 * @returns 是否为 manifest 远程。
 */
function isManifestRemote(value: unknown): value is RuntimeRemoteManifestItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.path === "string" &&
    typeof value.title === "string" &&
    typeof value.remoteName === "string" &&
    (value.exposedModule === undefined ||
      typeof value.exposedModule === "string") &&
    typeof value.basename === "string" &&
    (typeof value.entry === "string" ||
      typeof value.entryBaseUrl === "string") &&
    (value.remoteEntryType === undefined ||
      value.remoteEntryType === "module" ||
      value.remoteEntryType === "var") &&
    (value.entryGlobalName === undefined ||
      typeof value.entryGlobalName === "string") &&
    (value.supportedShellProtocolVersions === undefined ||
      (Array.isArray(value.supportedShellProtocolVersions) &&
        value.supportedShellProtocolVersions.every(
          (version) => typeof version === "string",
        ))) &&
    (value.status === undefined ||
      value.status === "active" ||
      value.status === "disabled")
  );
}

/**
 * 判断是否为 runtime 远程 manifest。
 * @param value - 值。
 * @returns 是否为 runtime 远程 manifest。
 */
function isRuntimeRemoteManifest(value: unknown): value is RuntimeRemoteManifest {
  return (
    isRecord(value) &&
    Array.isArray(value.remotes) &&
    value.remotes.every(isManifestRemote)
  );
}

/**
 * 创建远程入口 URL。
 * @param entryBaseUrl - 远程入口 URL。
 * @returns 远程入口 URL。
 */
function createRemoteEntryUrl(entryBaseUrl: string | undefined) {
  if (!entryBaseUrl) {
    throw new Error("Remote manifest item is missing entryBaseUrl.");
  }

  const normalizedBaseUrl = entryBaseUrl.endsWith("/")
    ? entryBaseUrl
    : `${entryBaseUrl}/`;

  return `${normalizedBaseUrl}remoteEntry.js`;
}

/**
 * 判断远程应用是否与 Shell 兼容。
 * @param remote - 远程应用。
 * @param shellProtocolVersion - Shell 协议版本。
 * @returns 是否与 Shell 兼容。
 */
function isRemoteCompatibleWithShell(
  remote: RuntimeRemoteManifestItem,
  shellProtocolVersion: string,
) {
  return (
    remote.supportedShellProtocolVersions === undefined ||
    remote.supportedShellProtocolVersions.includes(shellProtocolVersion)
  );
}

/**
 * 报告不兼容的远程应用。
 * @param remote - 远程应用。
 * @param shellProtocolVersion - Shell 协议版本。
 */
function reportIncompatibleRemote(
  remote: RuntimeRemoteManifestItem,
  shellProtocolVersion: string,
) {
  console.error("Remote protocol is incompatible with Shell", {
    remoteName: remote.remoteName,
    shellProtocolVersion,
    supportedShellProtocolVersions: remote.supportedShellProtocolVersions,
  });
}
/**
 * 获取与 Shell 兼容的 manifest 远程。
 * @param manifest - manifest。
 * @param shellProtocolVersion - Shell 协议版本。
 * @returns 与 Shell 兼容的 manifest 远程。
 */
function getCompatibleManifestRemotes(
  manifest: RuntimeRemoteManifest,
  shellProtocolVersion: string,
) {
  return manifest.remotes.filter((remote) => {
    if (remote.status === "disabled") {
      return false;
    }

    if (!isRemoteCompatibleWithShell(remote, shellProtocolVersion)) {
      reportIncompatibleRemote(remote, shellProtocolVersion);
      return false;
    }

    return true;
  });
}

/**
 * 创建远程应用定义。
 * @param manifest - manifest。
 * @param shellProtocolVersion - Shell 协议版本。
 * @returns 远程应用定义。
 */
export function createRemoteDefinitionsFromManifest(
  manifest: RuntimeRemoteManifest,
  shellProtocolVersion: string,
): RuntimeRemoteDefinition[] {
  return getCompatibleManifestRemotes(manifest, shellProtocolVersion).map(
    (remote) => ({
      basename: remote.basename,
      entry: remote.entry ?? createRemoteEntryUrl(remote.entryBaseUrl),
      entryGlobalName: remote.entryGlobalName,
      exposedModule: remote.exposedModule ?? DEFAULT_REMOTE_EXPOSED_MODULE,
      id: remote.id,
      meta: remote.meta,
      path: remote.path,
      remoteEntryType: remote.remoteEntryType,
      remoteName: remote.remoteName,
      title: remote.title,
    }),
  );
}

/**
 * 引导远程应用注册表。
 * @param options - 选项。
 * @returns 路由配置。
 */
export async function bootstrapRuntimeRemoteRegistry({
  fallbackRoutes,
  manifest,
  registerRemoteEntries = registerRuntimeRemoteEntries,
  registry = runtimeRemoteRegistry,
  runtimeEnv,
  shellProtocolVersion,
}: BootstrapRuntimeRemoteRegistryOptions): Promise<RemoteRouteConfig[]> {
  registry.clear();

  if (!manifest) {
    registry.registerMany(fallbackRoutes);
    return fallbackRoutes;
  }

  if (!isRuntimeRemoteManifest(manifest)) {
    console.error("Injected runtime remote manifest is invalid", {
      runtimeEnv,
    });
    registry.registerMany(fallbackRoutes);
    return fallbackRoutes;
  }

  const definitions = createRemoteDefinitionsFromManifest(
    manifest,
    shellProtocolVersion,
  );
  registry.registerMany(definitions);

  try {
    await registerRemoteEntries(
      definitions
        .filter((definition) => definition.entry)
        .map((definition) => ({
          entry: definition.entry as string,
          entryGlobalName: definition.entryGlobalName,
          remoteEntryType: definition.remoteEntryType,
          remoteName: definition.remoteName,
        })),
    );
  } catch (error) {
    for (const definition of definitions) {
      registry.updateHealth(definition.remoteName, {
        lastError: error,
        registrationStatus: "failed",
      });
    }

    throw error;
  }

  return registry.listRoutes();
}
