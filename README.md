# Federlet

Federlet 是一个轻量微前端框架，基于 Rspack Module Federation 跑通 Shell/Remote 接入协议，并使用 pnpm workspace + Turbo 管理 monorepo。

## 技术栈

- Node.js `>=18`
- pnpm workspace
- Turbo
- TypeScript
- Rspack
- `@module-federation/enhanced`
- React Shell
- React Remote
- Vue Remote

## 目录结构

```text
apps/
  shell-react/    React 主应用，负责布局、路由、remote 加载和错误边界
  remote-react/   React 微应用，暴露 ./mount
  remote-vue/     Vue 微应用，暴露 ./mount
packages/
  mf-runtime/     remote 加载、挂载协议和事件总线
  rspack-config/  共享 Rspack 与 Module Federation 配置工厂
  shared-types/   跨应用稳定类型契约
  shared-ui/      设计 token 和可复用 UI 基础
  tsconfig/       共享 TypeScript 配置
```

## 本地开发

```bash
pnpm install
pnpm dev
```

默认端口：

- Shell: `http://localhost:3000`
- React Remote: `http://localhost:3001`
- Vue Remote: `http://localhost:3002`

访问 Shell 后可以进入 `/react` 和 `/vue` 查看两个 remote。

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

## 部署建议

Shell 和 remote 独立构建、独立部署。`remoteEntry.js` 使用短缓存，带 hash 的 chunk 使用长缓存。生产环境建议由 manifest 或环境变量提供 remoteEntry 地址，避免把环境 URL 固化到 Shell 构建产物中。
