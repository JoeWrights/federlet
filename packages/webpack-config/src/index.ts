import { createRequire } from "node:module";
import path from "node:path";
import { ModuleFederationPlugin } from "@module-federation/enhanced/webpack";
import {
  createRemoteScopeClass,
  createStyleIsolationPostcssPlugin,
} from "@federlet/style-isolation";
import HtmlWebpackPlugin from "html-webpack-plugin";
import type { Configuration } from "webpack";
import type {} from "webpack-dev-server";
import { VueLoaderPlugin } from "vue-loader";

type SharedConfig = NonNullable<
  ConstructorParameters<typeof ModuleFederationPlugin>[0]["shared"]
>;

type StyleIsolationConfig =
  | boolean
  | {
      scopeClass?: string;
    };

const require = createRequire(import.meta.url);

export interface BaseAppConfigOptions {
  /** 当前应用目录，所有入口、模板和输出路径都以它为基准解析。 */
  appDir: string;

  /** Webpack 与 Module Federation 使用的应用名。 */
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

function resolveAppPath(appDir: string, request: string) {
  return path.isAbsolute(request) ? request : path.resolve(appDir, request);
}

function resolveExposes(
  appDir: string,
  exposes: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(exposes).map(([name, request]) => [
      name,
      resolveAppPath(appDir, request),
    ]),
  );
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

function cssRules(options: BaseAppConfigOptions) {
  const styleIsolation = resolveStyleIsolation(options);
  const styleLoader = require.resolve("style-loader");
  const cssLoader = require.resolve("css-loader");

  if (!styleIsolation) {
    return [
      {
        test: /\.css$/,
        use: [styleLoader, cssLoader],
      },
    ];
  }

  return [
    {
      test: /\.css$/,
      exclude: /node_modules/,
      use: [
        styleLoader,
        {
          loader: cssLoader,
          options: {
            importLoaders: 1,
          },
        },
        {
          loader: require.resolve("postcss-loader"),
          options: {
            postcssOptions: {
              plugins: [
                createStyleIsolationPostcssPlugin({
                  scopeClass: styleIsolation.scopeClass,
                }),
              ],
            },
          },
        },
      ],
    },
    {
      test: /\.css$/,
      include: /node_modules/,
      use: [styleLoader, cssLoader],
    },
  ];
}

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
                loader: require.resolve("vue-loader"),
              },
            ]
          : []),
        {
          test: /\.(?:ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: require.resolve("swc-loader"),
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
        ...cssRules(options),
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
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
    performance: {
      hints: false,
    },
    optimization: {
      runtimeChunk: false,
    },
  };
}

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

export function createVueHostConfig(options: HostConfigOptions): Configuration {
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
      remotes: options.remotes,
      shared: vueShared(),
      dts: false,
      manifest: false,
    }),
  ];

  return config;
}

export function createReactRemoteConfig(
  options: RemoteConfigOptions,
): Configuration {
  const config = createBaseConfig(
    {
      ...options,
      styleIsolation: options.styleIsolation ?? true,
    },
    "react",
  );

  config.plugins = [
    ...(config.plugins ?? []),
    new ModuleFederationPlugin({
      name: options.name,
      filename: "remoteEntry.js",
      exposes: resolveExposes(options.appDir, options.exposes),
      shared: reactShared(),
      dts: false,
      manifest: false,
    }),
  ];

  return config;
}

export function createVueRemoteConfig(options: RemoteConfigOptions): Configuration {
  const config = createBaseConfig(
    {
      ...options,
      entry: options.entry ?? "src/main.ts",
      styleIsolation: options.styleIsolation ?? true,
    },
    "vue",
  );

  config.plugins = [
    ...(config.plugins ?? []),
    new ModuleFederationPlugin({
      name: options.name,
      filename: "remoteEntry.js",
      exposes: resolveExposes(options.appDir, options.exposes),
      shared: vueShared(),
      dts: false,
      manifest: false,
    }),
  ];

  return config;
}
