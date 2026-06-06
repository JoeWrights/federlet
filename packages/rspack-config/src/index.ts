import path from "node:path";
import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { rspack, type Configuration } from "@rspack/core";
import { VueLoaderPlugin } from "vue-loader";

type SharedConfig = NonNullable<
  ConstructorParameters<typeof ModuleFederationPlugin>[0]["shared"]
>;

export interface BaseAppConfigOptions {
  /** 当前应用目录，所有入口、模板和输出路径都以它为基准解析。 */
  appDir: string;

  /** Rspack 与 Module Federation 使用的应用名。 */
  name: string;

  /** 本地开发服务器端口。 */
  port: number;

  /** 应用入口文件，未传时 React 默认使用 `src/main.tsx`。 */
  entry?: string;

  /** 静态资源 publicPath，Shell 子路由刷新时通常需要显式传 `/`。 */
  publicPath?: string;
}

/**
 * Shell host 的配置参数。
 */
export interface HostConfigOptions extends BaseAppConfigOptions {
  /** Module Federation remote 映射，例如 `remote_react@http://...`。 */
  remotes: Record<string, string>;
}

/**
 * Remote 应用的配置参数。
 */
export interface RemoteConfigOptions extends BaseAppConfigOptions {
  /** 暴露给 Shell 的模块映射，例如 `{ "./mount": "./src/mount.tsx" }`。 */
  exposes: Record<string, string>;
}

/** 获取 monorepo 根目录，用于配置跨包 alias。 */
function workspaceRoot(appDir: string) {
  return path.resolve(appDir, "../..");
}

/**
 * 将 workspace 包名指向源码入口。
 *
 * 这样示例应用在开发和构建时可以直接消费本仓库源码，不需要先发布包。
 */
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
    "@federlet/shared-ui": path.resolve(
      root,
      "packages/shared-ui/src/index.ts",
    ),
  };
}

/** React host/remote 共享同一份 React 单例，避免多个 React 实例导致 hooks 异常。 */
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

/** Vue remote 的共享依赖配置。 */
function vueShared(): SharedConfig {
  return {
    vue: {
      singleton: true,
      requiredVersion: "^3.5.25",
    },
  };
}

/**
 * 创建 React/Vue 应用共用的 Rspack 基础配置。
 *
 * 这里集中处理入口、输出、loader、HTML 模板、devServer 和通用优化项，
 * 再由 host/remote 工厂追加 Module Federation 插件。
 */
function createBaseConfig(
  options: BaseAppConfigOptions,
  framework: "react" | "vue",
): Configuration {
  const extensions =
    framework === "vue"
      ? [".vue", ".tsx", ".ts", ".jsx", ".js", ".json"]
      : [".tsx", ".ts", ".jsx", ".js", ".json"];

  return {
    context: options.appDir,
    entry: {
      main: path.resolve(options.appDir, options.entry ?? "src/main.tsx"),
    },
    output: {
      path: path.resolve(options.appDir, "dist"),
      publicPath: options.publicPath ?? "auto",
      uniqueName: options.name,
      clean: true,
    },
    resolve: {
      extensions,
      alias: workspaceAliases(options.appDir),
    },
    module: {
      rules: [
        ...(framework === "vue"
          ? [
              {
                test: /\.vue$/,
                loader: "vue-loader",
              },
            ]
          : []),
        {
          test: /\.(?:ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "builtin:swc-loader",
            options: {
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: framework === "react",
                },
                transform: {
                  react: {
                    runtime: "automatic",
                  },
                },
              },
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: path.resolve(options.appDir, "index.html"),
      }),
      ...(framework === "vue" ? [new VueLoaderPlugin()] : []),
    ],
    devServer: {
      port: options.port,
      historyApiFallback: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    // Module Federation remote 内部路由懒加载需要普通 async chunk，
    // Rspack dev 默认会对 import() 启用 lazy-compilation proxy，容易让 Suspense 一直停在 fallback。
    lazyCompilation: false,
    performance: {
      hints: false,
    },
    optimization: {
      // Module Federation 示例中保持单 runtime，降低首期配置复杂度。
      runtimeChunk: false,
    },
  };
}

/**
 * 创建 React Shell 的 Module Federation host 配置。
 */
export function createReactHostConfig(options: HostConfigOptions): Configuration {
  const config = createBaseConfig(options, "react");

  config.plugins = [
    ...(config.plugins ?? []),
    new ModuleFederationPlugin({
      name: options.name,
      remotes: options.remotes,
      shared: reactShared(),
      dts: false,
      manifest: false,
    }),
  ];

  return config;
}

/**
 * 创建 React remote 的 Module Federation 配置。
 */
export function createReactRemoteConfig(
  options: RemoteConfigOptions,
): Configuration {
  const config = createBaseConfig(options, "react");

  config.plugins = [
    ...(config.plugins ?? []),
    new ModuleFederationPlugin({
      name: options.name,
      filename: "remoteEntry.js",
      exposes: options.exposes,
      shared: reactShared(),
      dts: false,
      manifest: false,
    }),
  ];

  return config;
}

/**
 * 创建 Vue remote 的 Module Federation 配置。
 */
export function createVueRemoteConfig(options: RemoteConfigOptions): Configuration {
  const config = createBaseConfig(
    {
      ...options,
      entry: options.entry ?? "src/main.ts",
    },
    "vue",
  );

  config.plugins = [
    ...(config.plugins ?? []),
    new ModuleFederationPlugin({
      name: options.name,
      filename: "remoteEntry.js",
      exposes: options.exposes,
      shared: vueShared(),
      dts: false,
      manifest: false,
    }),
  ];

  return config;
}
