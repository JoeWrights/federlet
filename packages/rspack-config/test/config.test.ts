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

  it("shares only the React runtime from the host by default", () => {
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
        react: {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
      }),
      dts: false,
      manifest: false,
    });
  });

  it("does not configure shared UI for React remotes by default", () => {
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
        react: {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
      }),
      dts: false,
      manifest: false,
    });

    const call = ModuleFederationPluginMock.mock.lastCall?.[0] as {
      shared: Record<string, unknown>;
    };

    expect(call.shared["@federlet/shared-ui"]).toBeUndefined();
  });

  it("uses business-provided shared UI config for production remotes", () => {
    createReactRemoteConfig({
      appDir: "/workspace/apps/remote-react",
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: {
        "@federlet/shared-ui": {
          singleton: true,
          requiredVersion: "^0.1.0",
          strictVersion: true,
          import: false,
        },
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
          requiredVersion: "^0.1.0",
          strictVersion: true,
          import: false,
        },
      }),
      dts: false,
      manifest: false,
    });
  });

  it("merges externally configured shared dependencies for React apps", () => {
    createReactRemoteConfig({
      appDir: "/workspace/apps/remote-react",
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: {
        antd: {
          singleton: true,
          requiredVersion: "^5.0.0",
          strictVersion: true,
          import: false,
        },
        "@federlet/shared-ui": {
          singleton: true,
          requiredVersion: "^0.2.0",
          strictVersion: true,
          import: false,
        },
      },
    });

    expect(ModuleFederationPluginMock).toHaveBeenLastCalledWith({
      name: "remote_react",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: expect.objectContaining({
        react: {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
        antd: {
          singleton: true,
          requiredVersion: "^5.0.0",
          strictVersion: true,
          import: false,
        },
        "@federlet/shared-ui": {
          singleton: true,
          requiredVersion: "^0.2.0",
          strictVersion: true,
          import: false,
        },
      }),
      dts: false,
      manifest: false,
    });
  });
});
