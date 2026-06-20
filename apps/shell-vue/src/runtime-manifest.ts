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

interface LoadRuntimeRemoteRoutesOptions {
  fallbackRoutes: RemoteRouteConfig[];
  registerRemoteEntries?: typeof registerRuntimeRemoteEntries;
  runtimeEnv?: FederletRuntimeEnvironment;
}

function getRuntimeEnvironment(): FederletRuntimeEnvironment {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__FEDERLET_ENV__ ?? {};
}

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

export function createRemoteRoutesFromManifest(
  manifest: RuntimeRemoteManifest,
): RemoteRouteConfig[] {
  return createRemoteDefinitionsFromManifest(
    manifest,
    SHELL_REMOTE_PROTOCOL_VERSION,
  ).map(toRemoteRoute);
}

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
    shellProtocolVersion: SHELL_REMOTE_PROTOCOL_VERSION,
  });
}
