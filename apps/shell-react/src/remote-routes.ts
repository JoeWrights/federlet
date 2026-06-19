import type {
  FederletRuntimeEnvironment,
  RemoteRouteConfig,
} from "@federlet/shared-types";
import { DEFAULT_APOLLO_RUNTIME_CONFIG } from "./config/apollo";
import { DEFAULT_RUNTIME_ENV } from "./config/constants";
import { createRemoteRoutesFromManifest } from "./runtime-manifest";

/**
 * 根据 Apollo 运行时配置生成 fallback remote 路由。
 *
 * Shell 本地不再维护第二份手写 remote 表，避免 fallback 和 Apollo 配置漂移。
 */
export function createFallbackRemoteRoutes(
  runtimeConfig: FederletRuntimeEnvironment,
): RemoteRouteConfig[] {
  if (!runtimeConfig.manifest) {
    return [];
  }

  return createRemoteRoutesFromManifest(
    runtimeConfig.manifest,
    runtimeConfig.remoteVersion ?? runtimeConfig.manifestVersion ?? DEFAULT_RUNTIME_ENV,
  );
}

/**
 * 远程路由。
 */
export const remoteRoutes = createFallbackRemoteRoutes(
  DEFAULT_APOLLO_RUNTIME_CONFIG,
);
