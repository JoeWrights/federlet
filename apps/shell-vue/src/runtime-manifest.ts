import { registerRuntimeRemoteEntries } from "@federlet/mf-runtime";
import type {
  FederletRuntimeEnvironment,
  RemoteRouteConfig,
  RuntimeRemoteManifest,
  RuntimeRemoteManifestItem,
  RuntimeRemoteRouteConfig,
} from "@federlet/shared-types";
import { SHELL_REMOTE_PROTOCOL_VERSION } from "./config/constants";

interface LoadRuntimeRemoteRoutesOptions {
  fallbackRoutes: RemoteRouteConfig[];
  registerRemoteEntries?: typeof registerRuntimeRemoteEntries;
  runtimeEnv?: FederletRuntimeEnvironment;
}

const DEFAULT_REMOTE_EXPOSED_MODULE = "./mount";

function getRuntimeEnvironment(): FederletRuntimeEnvironment {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__FEDERLET_ENV__ ?? {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function isRuntimeRemoteManifest(value: unknown): value is RuntimeRemoteManifest {
  return (
    isRecord(value) &&
    Array.isArray(value.remotes) &&
    value.remotes.every(isManifestRemote)
  );
}

function createRemoteEntryUrl(entryBaseUrl: string | undefined) {
  if (!entryBaseUrl) {
    throw new Error("Remote manifest item is missing entryBaseUrl.");
  }

  return new URL("remoteEntry.js", normalizeEntryBaseUrl(entryBaseUrl)).toString();
}

function normalizeEntryBaseUrl(entryBaseUrl: string) {
  return entryBaseUrl.endsWith("/") ? entryBaseUrl : `${entryBaseUrl}/`;
}

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

function isRemoteCompatibleWithShell(remote: RuntimeRemoteManifestItem) {
  return (
    remote.supportedShellProtocolVersions === undefined ||
    remote.supportedShellProtocolVersions.includes(SHELL_REMOTE_PROTOCOL_VERSION)
  );
}

function reportIncompatibleRemote(remote: RuntimeRemoteManifestItem) {
  console.error(
    `Remote ${remote.remoteName} does not support Shell protocol ${SHELL_REMOTE_PROTOCOL_VERSION}.`,
    {
      remoteName: remote.remoteName,
      shellProtocolVersion: SHELL_REMOTE_PROTOCOL_VERSION,
      supportedShellProtocolVersions: remote.supportedShellProtocolVersions,
    },
  );
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
): RuntimeRemoteRouteConfig[] {
  return getCompatibleManifestRemotes(manifest).map(toRuntimeRoute);
}

export async function loadRuntimeRemoteRoutes({
  fallbackRoutes,
  registerRemoteEntries = registerRuntimeRemoteEntries,
  runtimeEnv = getRuntimeEnvironment(),
}: LoadRuntimeRemoteRoutesOptions): Promise<RemoteRouteConfig[]> {
  if (!runtimeEnv.manifest) {
    return fallbackRoutes;
  }

  if (!isRuntimeRemoteManifest(runtimeEnv.manifest)) {
    console.error("Invalid remote manifest, using fallback routes.", {
      manifest: runtimeEnv.manifest,
    });
    return fallbackRoutes;
  }

  const runtimeRoutes = createRemoteRoutesFromManifest(runtimeEnv.manifest);

  await registerRemoteEntries(
    runtimeRoutes.map((route) => ({
      entry: route.entry,
      remoteName: route.remoteName,
    })),
  );

  return runtimeRoutes;
}
