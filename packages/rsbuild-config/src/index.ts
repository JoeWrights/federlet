import path from "node:path";
import { defineConfig, type RsbuildConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginVue } from "@rsbuild/plugin-vue";
import {
  pluginModuleFederation,
  type ModuleFederationOptions,
} from "@module-federation/rsbuild-plugin";
import {
  createRemoteScopeClass,
  createStyleIsolationPostcssPlugin,
} from "@federlet/style-isolation";

type SharedConfig = NonNullable<ModuleFederationOptions["shared"]>;

type StyleIsolationConfig =
  | boolean
  | {
      scopeClass?: string;
    };

export interface BaseAppConfigOptions {
  /** 当前应用目录，所有入口、模板和输出路径都以它为基准解析。 */
  appDir: string;

  /** Rsbuild 与 Module Federation 使用的应用名。 */
  name: string;

  /** 本地开发服务器端口。 */
  port: number;

  /** 应用入口文件，未传时 React 默认使用 `src/main.tsx`。 */
  entry?: string;

  /** 静态资源 publicPath，Shell 子路由刷新时通常需要显式传 `/`。 */
  publicPath?: string;

  /** 构建期 CSS selector 前缀化配置。Host 默认关闭，remote 默认开启。 */
  styleIsolation?: StyleIsolationConfig;
}

export interface HostConfigOptions extends BaseAppConfigOptions {
  /** Module Federation remote 映射，例如 `remote_react@http://...`。 */
  remotes: Record<string, string>;
}

export interface RemoteConfigOptions extends BaseAppConfigOptions {
  /** 暴露给 Shell 的模块映射，例如 `{ "./mount": "./src/mount.tsx" }`。 */
  exposes: Record<string, string>;
}

function workspaceRoot(appDir: string) {
  return path.resolve(appDir, "../..");
}

function workspaceAliases(appDir: string): Record<string, string> {
  const root = workspaceRoot(appDir);

  return {
    "@federlet/shared-types": path.resolve(
      root,
      "packages/shared-types/src/index.ts",
    ),
    "@federlet/mf-runtime": path.resolve(
      root,
      "packages/mf-runtime/src/index.ts",
    ),
    "@federlet/react-shell": path.resolve(
      root,
      "packages/react-shell/src/index.tsx",
    ),
    "@federlet/shared-ui": path.resolve(
      root,
      "packages/shared-ui/src/index.ts",
    ),
    "@federlet/style-isolation": path.resolve(
      root,
      "packages/style-isolation/src/index.ts",
    ),
    "@federlet/style-isolation/scope": path.resolve(
      root,
      "packages/style-isolation/src/scope.ts",
    ),
    "@federlet/vue-shell": path.resolve(
      root,
      "packages/vue-shell/src/index.ts",
    ),
  };
}

function reactShared(): SharedConfig {
  return {
    react: {
      singleton: true,
      requiredVersion: "^19.2.1",
    },
    "react-dom": {
      singleton: true,
      requiredVersion: "^19.2.1",
    },
  };
}

function vueShared(): SharedConfig {
  return {
    vue: {
      singleton: true,
      requiredVersion: "^3.5.25",
    },
  };
}

function createFrameworkPlugin(framework: "react" | "vue") {
  if (framework === "react") {
    return pluginReact();
  }

  return pluginVue({
    vueLoaderOptions: {
      hotReload: false,
    },
  });
}

function resolveStyleIsolation(
  options: BaseAppConfigOptions,
): { scopeClass: string } | null {
  if (!options.styleIsolation) {
    return null;
  }

  const configuredScopeClass =
    typeof options.styleIsolation === "object"
      ? options.styleIsolation.scopeClass
      : undefined;

  return {
    scopeClass: configuredScopeClass ?? createRemoteScopeClass(options.name),
  };
}

function createBaseConfig(
  options: BaseAppConfigOptions,
  framework: "react" | "vue",
): RsbuildConfig {
  const styleIsolation = resolveStyleIsolation(options);
  const extensions =
    framework === "vue"
      ? [".vue", ".tsx", ".ts", ".jsx", ".js", ".json"]
      : [".tsx", ".ts", ".jsx", ".js", ".json"];

  return {
    root: options.appDir,
    source: {
      entry: {
        index: path.resolve(options.appDir, options.entry ?? "src/main.tsx"),
      },
    },
    html: {
      template: path.resolve(options.appDir, "index.html"),
    },
    output: {
      distPath: {
        root: "dist",
      },
      filename: {
        html: "index.html",
      },
      assetPrefix: options.publicPath ?? "auto",
      cleanDistPath: true,
    },
    server: {
      port: options.port,
      strictPort: true,
      historyApiFallback: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    resolve: {
      alias: workspaceAliases(options.appDir),
      aliasStrategy: "prefer-alias",
      extensions,
    },
    performance: {
      chunkSplit: {
        strategy: "all-in-one",
      },
    },
    tools: {
      ...(styleIsolation
        ? {
            postcss: {
              postcssOptions: {
                plugins: [
                  createStyleIsolationPostcssPlugin({
                    scopeClass: styleIsolation.scopeClass,
                  }),
                ],
              },
            },
          }
        : {}),
      rspack(config) {
        // Federated remotes need real async chunks for their own internal routes in dev.
        config.lazyCompilation = false;
      },
    },
    plugins: [createFrameworkPlugin(framework)],
  };
}

export function createReactHostConfig(options: HostConfigOptions): RsbuildConfig {
  const config = createBaseConfig(options, "react");

  return defineConfig({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      pluginModuleFederation({
        name: options.name,
        remotes: options.remotes,
        shared: reactShared(),
        dts: false,
        manifest: false,
      }),
    ],
  });
}

export function createVueHostConfig(options: HostConfigOptions): RsbuildConfig {
  const config = createBaseConfig(
    {
      ...options,
      entry: options.entry ?? "src/main.ts",
    },
    "vue",
  );

  return defineConfig({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      pluginModuleFederation({
        name: options.name,
        remotes: options.remotes,
        shared: vueShared(),
        dts: false,
        manifest: false,
      }),
    ],
  });
}

export function createReactRemoteConfig(
  options: RemoteConfigOptions,
): RsbuildConfig {
  const config = createBaseConfig(
    {
      ...options,
      styleIsolation: options.styleIsolation ?? true,
    },
    "react",
  );

  return defineConfig({
    ...config,
    dev: {
      ...config.dev,
      assetPrefix: true,
    },
    plugins: [
      ...(config.plugins ?? []),
      pluginModuleFederation({
        name: options.name,
        filename: "remoteEntry.js",
        exposes: options.exposes,
        shared: reactShared(),
        dts: false,
        manifest: false,
      }),
    ],
  });
}

export function createVueRemoteConfig(options: RemoteConfigOptions): RsbuildConfig {
  const config = createBaseConfig(
    {
      ...options,
      entry: options.entry ?? "src/main.ts",
      styleIsolation: options.styleIsolation ?? true,
    },
    "vue",
  );

  return defineConfig({
    ...config,
    dev: {
      ...config.dev,
      assetPrefix: true,
    },
    plugins: [
      ...(config.plugins ?? []),
      pluginModuleFederation({
        name: options.name,
        filename: "remoteEntry.js",
        exposes: options.exposes,
        shared: vueShared(),
        dts: false,
        manifest: false,
      }),
    ],
  });
}
