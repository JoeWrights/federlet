import type {
  FederletRuntimeEnvironment,
  RemoteRouteConfig,
} from "@federlet/shared-types";
import { DEFAULT_APOLLO_RUNTIME_CONFIG } from "./config/apollo";
import { createRemoteRoutesFromManifest } from "./runtime-manifest";

export function createFallbackRemoteRoutes(
  runtimeConfig: FederletRuntimeEnvironment,
): RemoteRouteConfig[] {
  if (!runtimeConfig.manifest) {
    return [];
  }

  return createRemoteRoutesFromManifest(runtimeConfig.manifest);
}

export const remoteRoutes = createFallbackRemoteRoutes(
  DEFAULT_APOLLO_RUNTIME_CONFIG,
);
