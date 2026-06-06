# Federlet

Federlet 是一个轻量微前端框架，基于 Rspack Module Federation 跑通 Shell/Remote 接入协议，并使用 pnpm workspace + Turbo 管理 monorepo。

## 技术栈

- Node.js `>=18`
- pnpm workspace
- Turbo
- TypeScript
- Rspack
- Vite
- `@module-federation/enhanced`
- React Shell
- React Remote
- Vue Remote
- Umi 3 React Remote

## 目录结构

```text
apps/
  shell-react/    React 主应用，负责布局、路由、remote 加载和错误边界
  remote-react/   React 微应用，暴露 ./mount
  remote-vue/     Vue 微应用，暴露 ./mount
  remote-umi-react/ Umi 3 + React 17 微应用，使用 Webpack 5 暴露 ./mount
packages/
  mf-runtime/     remote 加载、挂载协议和事件总线
  rspack-config/  共享 Rspack 与 Module Federation 配置工厂
  vite-config/    共享 Vite 与 Module Federation 配置工厂
  shared-types/   跨应用稳定类型契约
  shared-ui/      设计 token 和可复用 UI 基础
  tsconfig/       共享 TypeScript 配置
```

## 本地开发

```bash
pnpm install
pnpm dev
pnpm dev:vite
```

默认端口：

- Shell: `http://localhost:3000`
- React Remote: `http://localhost:3001`
- Vue Remote: `http://localhost:3002`
- Umi React Remote: `http://localhost:3003`

访问 Shell 后可以进入 `/react`、`/vue` 和 `/umi` 查看三个 remote。

## 架构文档

- [阶段一架构文档](docs/architecture-stage-1.md)

## 微应用接入协议

Remote 统一暴露 `./mount` 模块：

```ts
export function mount(context: MicroAppContext): MicroAppInstance;
```

`MicroAppContext` 由 Shell 注入，至少包含：

- `basename`：remote 内部路由前缀。
- `container`：remote 挂载 DOM 节点。
- `props`：Shell 传入的扩展参数。
- `eventBus`：可选跨应用事件总线。

Remote 必须返回 `unmount()`，Shell 在路由离开或组件卸载时调用它清理资源。

## 常用命令

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm clean
```

## 接入现有 React 项目

1. 增加 `rspack.config.ts`，使用 `createReactRemoteConfig`。
2. 新建 `src/mount.tsx`，在其中调用 `createRoot(container).render(...)`。
3. 在 Module Federation `exposes` 中暴露 `./mount`。
4. 确保 `react` 与 `react-dom` 作为 singleton shared。

## 接入现有 Vue 项目

1. 增加 `rspack.config.ts`，使用 `createVueRemoteConfig`。
2. 新建 `src/mount.ts`，在其中调用 `createApp(App).mount(container)`。
3. 在 `unmount()` 中调用 `app.unmount()`。
4. 在 Module Federation `exposes` 中暴露 `./mount`。

## 接入现有 Umi 3 React 项目

1. 确保 Umi 版本支持 `webpack5: {}`，并在 `chainWebpack` 中注入 `webpack.container.ModuleFederationPlugin`。
2. 暴露 `./mount`，在其中接收 Shell 传入的 `container` 和 `basename`。
3. 如果 Umi 项目使用 React 17，而 Shell 使用 React 19，优先不要共享 `react` 和 `react-dom`，让 Umi remote 独立打包自己的 React runtime。
4. Node 18+ 下如果遇到旧 Webpack hash 的 OpenSSL 错误，可在 Umi 脚本中设置 `NODE_OPTIONS=--openssl-legacy-provider`。
5. 如果 Umi remote 内部使用 `React.lazy` 或动态路由，需要开启 `dynamicImport: {}`，否则 Umi 可能把动态 import 提前打进主包，路由懒加载不会生效。

## 排坑记录

### Rspack remote 路由懒加载卡住

如果 React remote 内部路由使用 `React.lazy` 后页面一直停在 `Loading route...`，优先检查 Rspack dev 的 `lazyCompilation`。Module Federation remote 内部路由需要正常的 async chunk；Rspack lazy compilation proxy 在 dev 下可能让 Suspense 一直等不到真实 chunk。共享 Rspack 配置里应显式设置 `lazyCompilation: false`。

### Vite Shell 加载 Umi remote 失败

Vite remote 的 `remoteEntry.js` 是 ESM module，而 Umi 3 + Webpack 5 的 `remoteEntry.js` 默认是 `var remote_umi_react` 容器。Vite Shell 不能把 Umi remote 当 `type: "module"` 加载，需要在 `apps/shell-react/vite.config.ts` 中把 Umi remote 配成 `type: "var"`，并设置 `entryGlobalName: "remote_umi_react"`。

React/Vue Vite remote 仍然保持 `type: "module"`。因此 `@federlet/vite-config` 需要支持混合 remote 类型，不能简单把所有 remote 都统一转换成 module。

### Vite 不会自动使用现有 HTML 入口

现有 `index.html` 主要服务于 Rspack/Rsbuild 注入入口脚本，不能直接写死 `<script type="module" src="/src/main.tsx">`，否则会影响其他构建器。Vite 配置包通过 HTML transform 插件按 `entry` 注入 module script，只在 Vite 模式生效。

### Vite config 引用 workspace TS 包

`@federlet/vite-config` 的入口是 workspace 内的 TypeScript 源码。运行 Vite 或 Vitest 加载 `vite.config.ts` 时，需要带 `NODE_OPTIONS='--no-warnings=ExperimentalWarning --loader tsx'`，否则 Node 原生 ESM 会报 `Unknown file extension ".ts"`。

### Shell 切换 remote 时 React root 同步卸载警告

从 `remote-react` 切换到其他 remote 时，如果 Shell 在 React Router 切换的 cleanup 中同步调用上一个 remote 的 `root.unmount()`，React 19 会提示：

```text
Attempted to synchronously unmount a root while React was already rendering.
```

这个报错指向 `remote-react/src/mount.tsx` 是正常的，因为正在卸载的是上一个 React remote。修复点应在 Shell 生命周期边界：把 remote 实例的 `unmount()` 延后到当前 React commit 之后执行。

### 延迟卸载后频繁切换 remote 的 DOM 竞态

只延迟卸载还不够。如果不同 remote route 复用了同一个 `RemoteAppBoundary` 实例和同一个 DOM container，新 remote 可能已经挂载完成，而旧 remote 的延迟 `unmount()` 又回来清理这个 container，导致 Vue/React DOM 操作出现 `nextSibling`、`insertBefore` 等异常。

Shell 需要确保每个 remote route 使用独立的 Boundary 实例，例如给 `RemoteAppBoundary` 加 `key={route.id}`。这样旧 remote 的延迟卸载只会清理旧 container，不会误伤新 remote。

## 部署建议

Shell 和 remote 独立构建、独立部署。`remoteEntry.js` 使用短缓存，带 hash 的 chunk 使用长缓存。生产环境建议由 manifest 或环境变量提供 remoteEntry 地址，避免把环境 URL 固化到 Shell 构建产物中。
