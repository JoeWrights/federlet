import { beforeEach, describe, expect, it, vi } from "vitest";
import { federation } from "@module-federation/vite";
import {
  createReactHostConfig,
  createReactRemoteConfig,
  createVueRemoteConfig,
} from "../src/index";

vi.mock("@module-federation/vite", () => ({
  federation: vi.fn(() => ({
    name: "vite:module-federation",
  })),
}));

const appDir = "/workspace/apps/demo";
const federationMock = vi.mocked(federation);

function pluginNames(config: ReturnType<typeof createReactHostConfig>) {
  return (config.plugins ?? []).map((plugin) => plugin && "name" in plugin && plugin.name);
}

describe("vite config factories", () => {
  beforeEach(() => {
    federationMock.mockClear();
  });

  it("creates a React host config with server, aliases and federation remotes", () => {
    const config = createReactHostConfig({
      appDir,
      name: "shell_react",
      port: 3000,
      publicPath: "/",
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
      },
    });

    expect(config.root).toBe(appDir);
    expect(config.base).toBe("/");
    expect(config.server?.port).toBe(3000);
    expect(config.server?.strictPort).toBe(true);
    expect(config.server?.cors).toBe(true);
    expect(config.resolve?.alias).toMatchObject({
      "@federlet/shared-types": "/workspace/packages/shared-types/src/index.ts",
      "@federlet/mf-runtime": "/workspace/packages/mf-runtime/src/index.ts",
      "@federlet/shared-ui": "/workspace/packages/shared-ui/src/index.ts",
    });
    expect(pluginNames(config)).toContain("vite:module-federation");
    expect(federationMock).toHaveBeenCalledWith({
      name: "shell_react",
      remotes: {
        remote_react: {
          type: "module",
          name: "remote_react",
          entry: "http://localhost:3001/remoteEntry.js",
        },
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
      },
      dts: false,
      manifest: false,
    });
  });

  it("allows a React host to consume Webpack var remotes next to Vite module remotes", () => {
    createReactHostConfig({
      appDir,
      name: "shell_react",
      port: 3000,
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
        remote_umi_react: {
          type: "var",
          name: "remote_umi_react",
          entry: "http://localhost:3003/remoteEntry.js",
          entryGlobalName: "remote_umi_react",
        },
      },
    });

    expect(federationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        remotes: {
          remote_react: {
            type: "module",
            name: "remote_react",
            entry: "http://localhost:3001/remoteEntry.js",
          },
          remote_umi_react: {
            type: "var",
            name: "remote_umi_react",
            entry: "http://localhost:3003/remoteEntry.js",
            entryGlobalName: "remote_umi_react",
          },
        },
      }),
    );
  });

  it("creates a React remote config that exposes remoteEntry.js", () => {
    const config = createReactRemoteConfig({
      appDir,
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
    });

    expect(config.build?.outDir).toBe("dist");
    expect(pluginNames(config)).toContain("vite:module-federation");
    expect(federationMock).toHaveBeenCalledWith({
      name: "remote_react",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.1",
        },
      },
      dts: false,
      manifest: false,
    });
  });

  it("creates a Vue remote config with Vue plugin and shared Vue singleton", () => {
    const config = createVueRemoteConfig({
      appDir,
      name: "remote_vue",
      port: 3002,
      exposes: {
        "./mount": "./src/mount.ts",
      },
    });

    expect(pluginNames(config)).toContain("vite:module-federation");
    expect(federationMock).toHaveBeenCalledWith({
      name: "remote_vue",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.ts",
      },
      shared: {
        vue: {
          singleton: true,
          requiredVersion: "^3.5.25",
        },
      },
      dts: false,
      manifest: false,
    });
  });
});
