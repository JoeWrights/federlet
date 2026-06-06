import * as path from "node:path";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import * as vuePluginModule from "@vitejs/plugin-vue";
import { defineConfig, type Plugin, type PluginOption, type UserConfig } from "vite";

type VuePluginFactory = () => PluginOption;

const vue = (vuePluginModule as unknown as { default: VuePluginFactory }).default;

type SharedConfig = Record<
  string,
  {
    /** 是否单例 */
    singleton: boolean;
    /** 依赖版本 */
    requiredVersion: string;
  }
>;

interface ViteRemoteConfigItem {
  type: string;
  name: string;
  entry: string;
  entryGlobalName?: string;
}

type ViteRemoteConfig = Record<string, ViteRemoteConfigItem>;

export interface BaseAppConfigOptions {
  /** 当前应用目录，所有入口、模板和输出路径都以它为基准解析。 */
  appDir: string;

  /** Vite 与 Module Federation 使用的应用名。 */
  name: string;

  /** 本地开发服务器端口。 */
  port: number;

  /** 应用入口文件，Vite 默认由 index.html 引用，保留该字段用于 API 对齐。 */
  entry?: string;

  /** 静态资源 publicPath，Shell 子路由刷新时通常需要显式传 `/`。 */
  publicPath?: string;
}

export interface HostConfigOptions extends BaseAppConfigOptions {
  /** Module Federation remote 映射，例如 `remote_react@http://...`。 */
  remotes: Record<string, string | ViteRemoteConfigItem>;
}

export interface RemoteConfigOptions extends BaseAppConfigOptions {
  /** 暴露给 Shell 的模块映射，例如 `{ "./mount": "./src/mount.tsx" }`。 */
  exposes: Record<string, string>;
}

/**
 * 工作空间根目录
 * @param appDir 应用目录
 * @returns 工作空间根目录
 */
function workspaceRoot(appDir: string) {
  return path.resolve(appDir, "../..");
}

/**
 * 工作空间别名
 * @param appDir 应用目录
 * @returns 工作空间别名
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

/**
 * React 共享依赖配置
 * @returns React 共享依赖配置
 */
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

/**
 * Vue 共享依赖配置
 * @returns Vue 共享依赖配置
 */
function vueShared(): SharedConfig {
  return {
    vue: {
      singleton: true,
      requiredVersion: "^3.5.25",
    },
  };
}

/**
 * 规范化远程入口
 * @param remoteName 远程名称
 * @param remoteEntry 远程入口
 * @returns 规范化后的远程入口
 */
function normalizeRemoteEntry(remoteName: string, remoteEntry: string) {
  const separatorIndex = remoteEntry.indexOf("@");

  if (separatorIndex === -1) {
    return {
      name: remoteName,
      entry: remoteEntry,
    };
  }

  return {
    name: remoteEntry.slice(0, separatorIndex),
    entry: remoteEntry.slice(separatorIndex + 1),
  };
}

/**
 * 规范化远程入口
 * @param remotes 远程入口
 * @returns 规范化后的远程入口
 */
function viteRemotes(
  remotes: Record<string, string | ViteRemoteConfigItem>,
): ViteRemoteConfig {
  return Object.fromEntries(
    Object.entries(remotes).map(([remoteName, remoteEntry]) => {
      if (typeof remoteEntry !== "string") {
        return [remoteName, remoteEntry];
      }

      const normalizedRemote = normalizeRemoteEntry(remoteName, remoteEntry);

      return [
        remoteName,
        {
          type: "module" as const,
          name: normalizedRemote.name,
          entry: normalizedRemote.entry,
        },
      ];
    }),
  );
}

/**
 * 创建基础配置
 * @param options 基础配置选项
 * @param framework 框架
 * @returns 基础配置
 */
function createBaseConfig(
  options: BaseAppConfigOptions,
  framework: "react" | "vue",
): UserConfig {
  const entry = options.entry ?? (framework === "react" ? "src/main.tsx" : "src/main.ts");

  return {
    root: options.appDir,
    base: options.publicPath ?? "/",
    server: {
      port: options.port,
      strictPort: true,
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    preview: {
      port: options.port,
      strictPort: true,
    },
    resolve: {
      alias: workspaceAliases(options.appDir),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "esnext",
      cssCodeSplit: false,
    },
    plugins: [
      framework === "react" ? react() : vue(),
      htmlEntryPlugin(entry),
    ],
  };
}

/**
 * HTML 入口插件 Vite 需要 index.html 里有 module script
 * @param entry 入口
 * @returns HTML 入口插件
 */
function htmlEntryPlugin(entry: string): Plugin {
  const entryPath = entry.startsWith("/") ? entry : `/${entry}`;

  return {
    name: "federlet:html-entry",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: {
            type: "module",
            src: entryPath,
          },
          injectTo: "body",
        },
      ];
    },
  };
}

/**
 * 创建 React Host 配置
 * @param options Host 配置选项
 * @returns React Host 配置
 */
export function createReactHostConfig(options: HostConfigOptions): UserConfig {
  const config = createBaseConfig(options, "react");

  return defineConfig({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      federation({
        name: options.name,
        remotes: viteRemotes(options.remotes),
        shared: reactShared(),
        dts: false,
        manifest: false,
      }),
    ],
  });
}

/**
 * 创建 React Remote 配置
 * @param options Remote 配置选项
 * @returns React Remote 配置
 */
export function createReactRemoteConfig(options: RemoteConfigOptions): UserConfig {
  const config = createBaseConfig(options, "react");

  return defineConfig({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      federation({
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

/**
 * 创建 Vue Remote 配置
 * @param options Remote 配置选项
 * @returns Vue Remote 配置
 */
export function createVueRemoteConfig(options: RemoteConfigOptions): UserConfig {
  const config = createBaseConfig(options, "vue");

  return defineConfig({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      federation({
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
