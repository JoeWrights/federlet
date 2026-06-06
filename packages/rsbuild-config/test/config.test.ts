import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import {
  createReactHostConfig,
  createReactRemoteConfig,
  createVueRemoteConfig,
} from "../src/index";

vi.mock("@module-federation/rsbuild-plugin", () => ({
  pluginModuleFederation: vi.fn(() => ({
    name: "rsbuild:module-federation-enhanced",
    setup() {},
  })),
}));

const appDir = "/workspace/apps/demo";
const pluginModuleFederationMock = vi.mocked(pluginModuleFederation);

function pluginNames(config: ReturnType<typeof createReactHostConfig>) {
  return (config.plugins ?? []).map((plugin) => plugin && "name" in plugin && plugin.name);
}

describe("rsbuild config factories", () => {
  beforeEach(() => {
    pluginModuleFederationMock.mockClear();
  });

  it("creates a React host config with server, html, source and federation settings", () => {
    const config = createReactHostConfig({
      appDir,
      name: "shell_react",
      port: 3000,
      publicPath: "/",
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
      },
    });

    expect(config.server?.port).toBe(3000);
    expect(config.server?.strictPort).toBe(true);
    expect(config.html?.template).toBe("/workspace/apps/demo/index.html");
    expect(config.source?.entry).toEqual({
      index: "/workspace/apps/demo/src/main.tsx",
    });
    expect(config.output?.distPath).toEqual({ root: "dist" });
    expect(config.output?.filename).toEqual({ html: "index.html" });
    expect(config.output?.assetPrefix).toBe("/");
    expect(pluginNames(config)).toContain("rsbuild:module-federation-enhanced");
    expect(pluginModuleFederationMock).toHaveBeenCalledWith({
      name: "shell_react",
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
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

  it("creates a React remote config that exposes remoteEntry.js", () => {
    const config = createReactRemoteConfig({
      appDir,
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
    });

    expect(config.server?.port).toBe(3001);
    expect(pluginNames(config)).toContain("rsbuild:module-federation-enhanced");
    expect(pluginModuleFederationMock).toHaveBeenCalledWith({
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

  it("creates a Vue remote config with the Vue entry default", () => {
    const config = createVueRemoteConfig({
      appDir,
      name: "remote_vue",
      port: 3002,
      exposes: {
        "./mount": "./src/mount.ts",
      },
    });

    expect(config.source?.entry).toEqual({
      index: "/workspace/apps/demo/src/main.ts",
    });
    expect(pluginNames(config)).toContain("rsbuild:module-federation-enhanced");
    expect(pluginModuleFederationMock).toHaveBeenCalledWith({
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
