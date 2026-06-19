import { registerRuntimeRemoteEntries } from "@federlet/mf-runtime";
import type {
  FederletRuntimeEnvironment,
  RemoteRouteConfig,
  RuntimeRemoteManifest,
  RuntimeRemoteManifestItem,
  RuntimeRemoteRouteConfig,
} from "@federlet/shared-types";
import { SHELL_REMOTE_PROTOCOL_VERSION } from "./config/constants";

/**
 * 加载运行时 remote 路由的选项。
 */
interface LoadRuntimeRemoteRoutesOptions {
  /**
   * 回退路由配置。
   */
  fallbackRoutes: RemoteRouteConfig[];
  /**
   * 注册远程入口的函数。
   */
  registerRemoteEntries?: typeof registerRuntimeRemoteEntries;
  /**
   * 运行时环境。
   */
  runtimeEnv?: FederletRuntimeEnvironment;
}

/**
 * 默认的 remote 暴露模块名，用于 fallback 静态配置。
 */
const DEFAULT_REMOTE_EXPOSED_MODULE = "./mount";

/**
 * 获取运行时环境。
 */
function getRuntimeEnvironment(): FederletRuntimeEnvironment {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__FEDERLET_ENV__ ?? {};
}

/**
 * 校验值是否为对象。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 校验 manifest 中的 remote 是否有效。
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
 * 校验 runtime remote manifest 是否有效。
 */
function isRuntimeRemoteManifest(value: unknown): value is RuntimeRemoteManifest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.remotes) &&
    value.remotes.every(isManifestRemote)
  );
}

/**
 * 将 manifest 中的 remote 转换为 runtime 路由配置。
 * @param remote - manifest 中的 remote。
 * @returns runtime 路由配置。
 */
function toRuntimeRoute(remote: RuntimeRemoteManifestItem): RuntimeRemoteRouteConfig {
  return {
    basename: remote.basename,
    entry: remote.entry ?? createRemoteEntryUrl(remote.entryBaseUrl),
    exposedModule: remote.exposedModule ?? DEFAULT_REMOTE_EXPOSED_MODULE,
    id: remote.id,
    path: remote.path,
    remoteName: remote.remoteName,
    title: remote.title,
  };
}

/**
 * 创建 remote entry 的 URL。
 * @param entryBaseUrl - remote entry 的 base URL。
 * @returns remote entry 的 URL。
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
 * 将 runtime 路由配置转换为 remote 路由配置。
 * @param route - runtime 路由配置。
 * @returns remote 路由配置。
 */
function toRemoteRoute(route: RuntimeRemoteRouteConfig): RemoteRouteConfig {
  return {
    basename: route.basename,
    exposedModule: route.exposedModule,
    id: route.id,
    path: route.path,
    remoteName: route.remoteName,
    title: route.title,
  };
}

function isRemoteCompatibleWithShell(remote: RuntimeRemoteManifestItem) {
  return (
    remote.supportedShellProtocolVersions === undefined ||
    remote.supportedShellProtocolVersions.includes(SHELL_REMOTE_PROTOCOL_VERSION)
  );
}

function reportIncompatibleRemote(remote: RuntimeRemoteManifestItem) {
  console.error("Remote protocol is incompatible with Shell", {
    remoteName: remote.remoteName,
    shellProtocolVersion: SHELL_REMOTE_PROTOCOL_VERSION,
    supportedShellProtocolVersions: remote.supportedShellProtocolVersions,
  });
}

function getCompatibleManifestRemotes(manifest: RuntimeRemoteManifest) {
  return manifest.remotes.filter((remote) => {
    if (remote.status === "disabled") {
      return false;
    }

    if (!isRemoteCompatibleWithShell(remote)) {
      reportIncompatibleRemote(remote);
      return false;
    }

    return true;
  });
}

export function createRemoteRoutesFromManifest(
  manifest: RuntimeRemoteManifest,
): RemoteRouteConfig[] {
  return getCompatibleManifestRemotes(manifest)
    .map((remote) => toRuntimeRoute(remote))
    .map(toRemoteRoute);
}

/**
 * 注册 manifest 中的 remote 路由。
 * @param manifest - manifest。
 * @param registerRemoteEntries - 注册远程入口的函数。
 * @returns runtime 路由配置。
 */
function registerManifestRoutes(
  manifest: RuntimeRemoteManifest,
  registerRemoteEntries: typeof registerRuntimeRemoteEntries,
) {
  const runtimeRoutes = getCompatibleManifestRemotes(manifest).map((remote) =>
    toRuntimeRoute(remote),
  );

  registerRemoteEntries(
    runtimeRoutes.map((route) => ({
      entry: route.entry,
      remoteName: route.remoteName,
    })),
  );

  return runtimeRoutes.map(toRemoteRoute);
}

/**
 * 加载运行时 remote 路由。
 * @param options - 加载运行时 remote 路由的选项。
 * @returns 运行时 remote 路由配置。
 */
export async function loadRuntimeRemoteRoutes({
  fallbackRoutes,
  registerRemoteEntries = registerRuntimeRemoteEntries,
  runtimeEnv = getRuntimeEnvironment(),
}: LoadRuntimeRemoteRoutesOptions): Promise<RemoteRouteConfig[]> {
  if (runtimeEnv.manifest) {
    if (!isRuntimeRemoteManifest(runtimeEnv.manifest)) {
      console.error("Injected runtime remote manifest is invalid", {
        runtimeEnv: runtimeEnv.runtimeEnv,
      });

      return fallbackRoutes;
    }

    return registerManifestRoutes(
      runtimeEnv.manifest,
      registerRemoteEntries,
    );
  }

  return fallbackRoutes;
}
