import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapRuntimeRemoteRegistry,
  createRuntimeRemoteRegistry,
} from "./remote-registry";
import type {
  RemoteRouteConfig,
  RuntimeRemoteManifest,
} from "@federlet/shared-types";

const fallbackRoutes: RemoteRouteConfig[] = [
  {
    basename: "/react",
    exposedModule: "./mount",
    id: "react-dashboard",
    path: "/react/*",
    remoteName: "remote_react",
    title: "React Remote",
  },
];

const manifest: RuntimeRemoteManifest = {
  remotes: [
    {
      basename: "/react",
      components: [
        {
          contractVersion: "^1.0.0",
          expose: "./components/PrimaryButton",
          framework: "react",
          name: "PrimaryButton",
          typePackage: "@federlet/remote-react-contracts",
        },
      ],
      entryBaseUrl: "http://localhost:3001",
      id: "react-dashboard",
      meta: {
        owner: "platform",
      },
      path: "/react/*",
      remoteEntryType: "module",
      remoteName: "remote_react",
      status: "active",
      supportedShellProtocolVersions: ["1"],
      title: "React Remote",
    },
    {
      basename: "/umi",
      entryBaseUrl: "http://localhost:3003",
      entryGlobalName: "remote_umi_react",
      id: "umi-react",
      path: "/umi/*",
      remoteEntryType: "var",
      remoteName: "remote_umi_react",
      status: "active",
      supportedShellProtocolVersions: ["1"],
      title: "Umi React Remote",
    },
    {
      basename: "/disabled",
      entryBaseUrl: "http://localhost:3010",
      id: "disabled",
      path: "/disabled/*",
      remoteName: "remote_disabled",
      status: "disabled",
      title: "Disabled Remote",
    },
    {
      basename: "/legacy",
      entryBaseUrl: "http://localhost:3020",
      id: "legacy",
      path: "/legacy/*",
      remoteName: "remote_legacy",
      status: "active",
      supportedShellProtocolVersions: ["0"],
      title: "Legacy Remote",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRuntimeRemoteRegistry", () => {
  it("registers remote definitions and exposes route/query views", () => {
    const registry = createRuntimeRemoteRegistry(() => 1000);

    registry.registerMany([
      {
        basename: "/react",
        entry: "http://localhost:3001/remoteEntry.js",
        exposedModule: "./mount",
        id: "react-dashboard",
        meta: {
          owner: "platform",
        },
        path: "/react/*",
        components: [
          {
            contractVersion: "^1.0.0",
            expose: "./components/PrimaryButton",
            framework: "react",
            name: "PrimaryButton",
            typePackage: "@federlet/remote-react-contracts",
          },
        ],
        remoteName: "remote_react",
        title: "React Remote",
      },
    ]);

    expect(registry.getByName("remote_react")).toMatchObject({
      entry: "http://localhost:3001/remoteEntry.js",
      health: {
        loadHealth: "unknown",
        registrationStatus: "registered",
        updatedAt: 1000,
      },
      id: "react-dashboard",
      meta: {
        owner: "platform",
      },
      remoteName: "remote_react",
    });
    expect(registry.listComponents()).toEqual([
      {
        contractVersion: "^1.0.0",
        expose: "./components/PrimaryButton",
        framework: "react",
        moduleName: "remote_react/components/PrimaryButton",
        name: "PrimaryButton",
        remoteName: "remote_react",
        typePackage: "@federlet/remote-react-contracts",
      },
    ]);
    expect(registry.getComponent("remote_react", "PrimaryButton")).toMatchObject({
      moduleName: "remote_react/components/PrimaryButton",
      name: "PrimaryButton",
      remoteName: "remote_react",
    });
    expect(registry.getComponent("remote_react", "MissingButton")).toBeUndefined();
    expect(registry.getByRouteId("react-dashboard")).toMatchObject({
      remoteName: "remote_react",
    });
    expect(registry.listRoutes()).toEqual([
      {
        basename: "/react",
        exposedModule: "./mount",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        title: "React Remote",
      },
    ]);
  });

  it("updates remote health without losing route metadata", () => {
    const registry = createRuntimeRemoteRegistry(() => 1000);
    registry.registerMany(fallbackRoutes);

    registry.updateHealth("remote_react", {
      lastError: new Error("remote down"),
      loadHealth: "unavailable",
      registrationStatus: "failed",
    });

    expect(registry.getByName("remote_react")).toMatchObject({
      health: {
        lastError: expect.any(Error),
        loadHealth: "unavailable",
        registrationStatus: "failed",
        updatedAt: 1000,
      },
      remoteName: "remote_react",
    });
  });
});

describe("bootstrapRuntimeRemoteRegistry", () => {
  it("builds the registry from an Apollo manifest and registers active compatible entries", async () => {
    const registerRemoteEntries = vi.fn();
    const registry = createRuntimeRemoteRegistry(() => 1000);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const routes = await bootstrapRuntimeRemoteRegistry({
      fallbackRoutes,
      manifest,
      registerRemoteEntries,
      registry,
      shellProtocolVersion: "1",
    });

    expect(registerRemoteEntries).toHaveBeenCalledWith([
      {
        entry: "http://localhost:3001/remoteEntry.js",
        remoteEntryType: "module",
        remoteName: "remote_react",
      },
      {
        entry: "http://localhost:3003/remoteEntry.js",
        entryGlobalName: "remote_umi_react",
        remoteEntryType: "var",
        remoteName: "remote_umi_react",
      },
    ]);
    expect(routes).toEqual([
      {
        basename: "/react",
        exposedModule: "./mount",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        title: "React Remote",
      },
      {
        basename: "/umi",
        exposedModule: "./mount",
        id: "umi-react",
        path: "/umi/*",
        remoteName: "remote_umi_react",
        title: "Umi React Remote",
      },
    ]);
    expect(registry.getByName("remote_react")).toMatchObject({
      components: [
        {
          contractVersion: "^1.0.0",
          expose: "./components/PrimaryButton",
          framework: "react",
          name: "PrimaryButton",
          typePackage: "@federlet/remote-react-contracts",
        },
      ],
      entry: "http://localhost:3001/remoteEntry.js",
      health: {
        registrationStatus: "registered",
      },
      meta: {
        owner: "platform",
      },
    });
    expect(registry.getByName("remote_umi_react")).toMatchObject({
      entry: "http://localhost:3003/remoteEntry.js",
      entryGlobalName: "remote_umi_react",
      remoteEntryType: "var",
    });
    expect(registry.getByName("remote_disabled")).toBeUndefined();
    expect(registry.getByName("remote_legacy")).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[federlet] mf-runtime:remote.protocol.incompatible Remote protocol is incompatible with Shell",
      expect.objectContaining({
        context: {
          shellProtocolVersion: "1",
          supportedShellProtocolVersions: ["0"],
        },
        event: "remote.protocol.incompatible",
        message: "Remote protocol is incompatible with Shell",
        remoteName: "remote_legacy",
        scope: "mf-runtime",
      }),
    );
  });

  it("falls back to static routes when the manifest is invalid", async () => {
    const registerRemoteEntries = vi.fn();
    const registry = createRuntimeRemoteRegistry(() => 1000);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const routes = await bootstrapRuntimeRemoteRegistry({
      fallbackRoutes,
      manifest: {} as never,
      registerRemoteEntries,
      registry,
      runtimeEnv: "test",
      shellProtocolVersion: "1",
    });

    expect(routes).toBe(fallbackRoutes);
    expect(registerRemoteEntries).not.toHaveBeenCalled();
    expect(registry.listRoutes()).toEqual(fallbackRoutes);
    expect(consoleError).toHaveBeenCalledWith(
      "[federlet] mf-runtime:remote.manifest.invalid Injected runtime remote manifest is invalid",
      expect.objectContaining({
        context: {
          runtimeEnv: "test",
        },
        event: "remote.manifest.invalid",
        message: "Injected runtime remote manifest is invalid",
        scope: "mf-runtime",
      }),
    );
  });
});
