import {
  bootstrapRuntimeRemoteRegistry,
  createRemoteDefinitionsFromManifest,
  registerRuntimeRemoteEntries,
} from "@federlet/mf-runtime";
import type {
  FederletRuntimeEnvironment,
  RemoteRouteConfig,
  RuntimeRemoteManifest,
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
 * @param route - 路由配置。
 * @returns 路由配置。
 */
function toRemoteRoute(route: RemoteRouteConfig): RemoteRouteConfig {
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
 * 从 manifest 创建远程路由配置。
 * @param manifest - manifest 配置。
 * @returns 远程路由配置。
 */
export function createRemoteRoutesFromManifest(
  manifest: RuntimeRemoteManifest,
): RemoteRouteConfig[] {
  return createRemoteDefinitionsFromManifest(
    manifest,
    SHELL_REMOTE_PROTOCOL_VERSION,
  ).map(toRemoteRoute);
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
  return bootstrapRuntimeRemoteRegistry({
    fallbackRoutes,
    manifest: runtimeEnv.manifest,
    registerRemoteEntries,
    runtimeEnv: runtimeEnv.runtimeEnv,
    sourcePolicy: runtimeEnv.remoteSourcePolicy,
    shellProtocolVersion: SHELL_REMOTE_PROTOCOL_VERSION,
  });
}
