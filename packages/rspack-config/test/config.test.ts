import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { describe, expect, it, vi } from "vitest";
import {
  createReactHostConfig,
  createReactRemoteConfig,
} from "../src/index";

vi.mock("@module-federation/enhanced/rspack", () => ({
  ModuleFederationPlugin: vi.fn().mockImplementation((options) => ({
    name: "rspack:module-federation-enhanced",
    options,
  })),
}));

const ModuleFederationPluginMock = vi.mocked(ModuleFederationPlugin);

describe("rspack config factories", () => {
  it("disables lazy compilation so federated remote route chunks resolve in dev", () => {
    const config = createReactRemoteConfig({
      appDir: "/workspace/apps/remote-react",
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
    });

    expect(config.lazyCompilation).toBe(false);
  });

  it("shares the React UI package from the host", () => {
    createReactHostConfig({
      appDir: "/workspace/apps/shell-react",
      name: "shell_react",
      port: 3000,
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
      },
    });

    expect(ModuleFederationPluginMock).toHaveBeenLastCalledWith({
      name: "shell_react",
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
      },
      shared: expect.objectContaining({
      "@federlet/shared-ui": {
        singleton: true,
        requiredVersion: false,
      },
      }),
      dts: false,
      manifest: false,
    });
  });

  it("keeps shared UI as a remote fallback for standalone dev", () => {
    createReactRemoteConfig({
      appDir: "/workspace/apps/remote-react",
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
    });

    expect(ModuleFederationPluginMock).toHaveBeenLastCalledWith({
      name: "remote_react",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: expect.objectContaining({
      "@federlet/shared-ui": {
        singleton: true,
        requiredVersion: false,
      },
      }),
      dts: false,
      manifest: false,
    });
  });

  it("omits the shared UI fallback from production remotes", () => {
    createReactRemoteConfig({
      appDir: "/workspace/apps/remote-react",
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      provideSharedUi: false,
    });

    expect(ModuleFederationPluginMock).toHaveBeenLastCalledWith({
      name: "remote_react",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: expect.objectContaining({
      "@federlet/shared-ui": {
        singleton: true,
        requiredVersion: false,
        import: false,
      },
      }),
      dts: false,
      manifest: false,
    });
  });
});
