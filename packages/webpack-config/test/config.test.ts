import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { ModuleFederationPlugin } from "@module-federation/enhanced/webpack";
import {
  createReactHostConfig,
  createReactRemoteConfig,
  createVueRemoteConfig,
} from "../src/index";

vi.mock("@module-federation/enhanced/webpack", () => ({
  ModuleFederationPlugin: vi.fn().mockImplementation((options) => ({
    name: "webpack:module-federation-enhanced",
    options,
  })),
}));

const appDir = "/workspace/apps/demo";
const require = createRequire(import.meta.url);
const ModuleFederationPluginMock = vi.mocked(ModuleFederationPlugin);

function pluginNames(config: ReturnType<typeof createReactHostConfig>) {
  return (config.plugins ?? []).map((plugin) => plugin && "name" in plugin && plugin.name);
}

describe("webpack config factories", () => {
  it("creates a React host config with dev server, aliases and federation settings", () => {
    const config = createReactHostConfig({
      appDir,
      name: "shell_react",
      port: 3000,
      publicPath: "/",
      remotes: {
        remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
      },
    });

    expect(config.context).toBe(appDir);
    expect(config.entry).toEqual({
      main: "/workspace/apps/demo/src/main.tsx",
    });
    expect(config.output).toMatchObject({
      path: "/workspace/apps/demo/dist",
      publicPath: "/",
      uniqueName: "shell_react",
      clean: true,
    });
    expect(config.devServer).toMatchObject({
      port: 3000,
      historyApiFallback: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
    expect(config.resolve?.alias).toMatchObject({
      "@federlet/shared-types": "/workspace/packages/shared-types/src/index.ts",
      "@federlet/mf-runtime": "/workspace/packages/mf-runtime/src/index.ts",
      "@federlet/shared-ui": "/workspace/packages/shared-ui/src/index.ts",
    });
    expect(JSON.stringify(config.module?.rules)).toContain(require.resolve("swc-loader"));
    expect(JSON.stringify(config.module?.rules)).toContain(require.resolve("style-loader"));
    expect(JSON.stringify(config.module?.rules)).toContain(require.resolve("css-loader"));
    expect(pluginNames(config)).toContain("webpack:module-federation-enhanced");
    expect(ModuleFederationPluginMock).toHaveBeenCalledWith({
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

    expect(config.devServer?.port).toBe(3001);
    expect(pluginNames(config)).toContain("webpack:module-federation-enhanced");
    expect(ModuleFederationPluginMock).toHaveBeenCalledWith({
      name: "remote_react",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "/workspace/apps/demo/src/mount.tsx",
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

  it("creates a Vue remote config with Vue entry and loader defaults", () => {
    const config = createVueRemoteConfig({
      appDir,
      name: "remote_vue",
      port: 3002,
      exposes: {
        "./mount": "./src/mount.ts",
      },
    });

    expect(config.entry).toEqual({
      main: "/workspace/apps/demo/src/main.ts",
    });
    expect(config.resolve?.extensions).toEqual([
      ".vue",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ]);
    expect(pluginNames(config)).toContain("webpack:module-federation-enhanced");
    expect(ModuleFederationPluginMock).toHaveBeenCalledWith({
      name: "remote_vue",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "/workspace/apps/demo/src/mount.ts",
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
