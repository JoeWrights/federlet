# Shell 与 Remote 脚手架 CLI 方案

## 背景与目标

Federlet 当前已经有可运行的 React/Vue Shell，以及 React、Vue、Umi legacy 三类 remote 示例。新增业务 remote 或新建一套 Shell 时，开发者仍需要手动复制目录、改 package、改 Module Federation name、改端口、改 manifest 和来源策略，容易漏掉协议字段。

本方案对应 `ROADMAP.md` 阶段五的开发者体验能力：

- 新建 shell 模板：React、Vue。
- 新建 remote 模板：React、Vue、Umi/legacy。
- 接入脚手架 CLI：`create remote`、`register remote`。

目标是提供一个轻量 CLI，把“生成应用骨架”和“注册到本地 Shell manifest”标准化。现阶段只覆盖本地开发，不接真实 Apollo、发布平台或远端配置中心。

## CLI 形态

建议新增包：

```text
packages/cli/
```

对外命令名：

```bash
federlet
```

核心命令：

```bash
federlet create shell
federlet create remote
federlet register remote
```

`create shell` 与 `create remote` 负责生成目录和文件；`register remote` 负责把 remote 写入本地 Shell 的 runtime manifest mock 配置。

## 模板范围

### Shell 模板

Shell 模板比 remote 模板复杂，建议单独分阶段实现。首批支持：

- `react`
- `vue`

生成内容应包含：

- Shell 全局布局、导航和首页。
- runtime manifest 读取与 `bootstrapRuntimeRemoteRegistry()` 接入。
- `RemoteAppBoundary` 接入。
- `runtimeRemoteRegistry` load health 回写。
- 事件总线创建与注入。
- remote source policy 本地默认配置。
- `rspack`、`vite`、`rsbuild`、`webpack` 配置。
- `package.json`、`tsconfig.json`、基础样式。

Shell 模板不应该内置业务 remote。它只提供平台壳能力和本地 manifest 示例。

示例命令：

```bash
federlet create shell --framework react --name shell-admin --port 3100
federlet create shell --framework vue --name shell-portal --port 3101
```

### Remote 模板

首批支持：

- `react`
- `vue`
- `umi`

所有 remote 模板必须暴露统一入口：

```ts
export function mount(context: MicroAppContext): MicroAppInstance
```

Shell 只消费 `./mount` 接入协议，不直接 import remote 内部页面或业务组件。

React/Vue remote 模板应尽量小，只保留：

- `src/mount.tsx` 或 `src/mount.ts`
- `src/App.tsx` 或 `src/App.vue`
- 内部路由示例
- event bus lifecycle 示例
- 基础样式
- 多构建器配置

Umi/legacy remote 模板单独维护：

- React 17 / Umi 3。
- legacy var remote。
- 需要 `entryGlobalName`。
- 不强制共享 React runtime。

示例命令：

```bash
federlet create remote --framework react --name remote-orders --route /orders --port 3010 --title Orders
federlet create remote --framework vue --name remote-reports --route /reports --port 3011 --title Reports
federlet create remote --framework umi --name remote-legacy --route /legacy --port 3012 --title Legacy
```

## 注册策略

`register remote` 只修改本地 Shell mock 配置：

```text
apps/shell-react/src/config/apollo.ts
apps/shell-vue/src/config/apollo.ts
```

它需要写入两类信息：

1. `DEFAULT_APOLLO_RUNTIME_CONFIG.manifest.remotes`
2. `DEFAULT_APOLLO_RUNTIME_CONFIG.remoteSourcePolicy.allowedOrigins`

示例命令：

```bash
federlet register remote \
  --shell react \
  --id orders \
  --remote-name remote_orders \
  --title Orders \
  --basename /orders \
  --path /orders/* \
  --entry-base-url http://localhost:3010
```

Umi/legacy remote 需要额外字段：

```bash
federlet register remote \
  --shell react \
  --id legacy \
  --remote-name remote_legacy \
  --title Legacy \
  --basename /legacy \
  --path /legacy/* \
  --entry-base-url http://localhost:3012 \
  --remote-entry-type var \
  --entry-global-name remote_legacy
```

注册前必须校验：

- `id` 不重复。
- `remoteName` 不重复，除非显式允许复用。
- `basename` 不重复。
- `path` 不重复。
- `entryBaseUrl` 是合法 URL。
- 本地端口未被当前 manifest 其他 remote 使用。
- `remote-entry-type=var` 时必须提供 `entry-global-name`。

## 包结构

建议结构：

```text
packages/cli/
  package.json
  src/
    index.ts
    commands/
      create-shell.ts
      create-remote.ts
      register-remote.ts
    templates/
      shell-react/
      shell-vue/
      remote-react/
      remote-vue/
      remote-umi/
    utils/
      file-system.ts
      manifest.ts
      names.ts
      package-json.ts
      ports.ts
```

模板文件使用占位变量，例如：

```text
__PACKAGE_NAME__
__REMOTE_NAME__
__SHELL_NAME__
__TITLE__
__BASENAME__
__PORT__
```

CLI 渲染模板时只替换这些明确占位，不做复杂字符串推断。

## Manifest 修改方式

本地 manifest 当前是 TypeScript 文件。CLI 修改它时有两种方案：

- 短期：使用 TypeScript AST 或 `ts-morph` 类工具更新 `DEFAULT_APOLLO_RUNTIME_CONFIG`。
- 备选：把本地 manifest 拆成 JSON，再由 `apollo.ts` import JSON。

推荐短期先用 AST 更新当前 TS 文件，避免迁移现有配置结构。若后续注册逻辑继续复杂化，再考虑把 manifest 数据迁出到 JSON。

## 分阶段落地

### 阶段一：模板固化

从现有 `apps/shell-react`、`apps/shell-vue`、`apps/remote-react`、`apps/remote-vue`、`apps/remote-umi-react` 提炼最小模板。

验收标准：

- 生成模板不包含 demo 业务噪音。
- remote 模板都暴露 `./mount`。
- Shell 模板都能读取 runtime manifest。

### 阶段二：实现 `create remote`

实现 remote 目录生成和变量替换。

验收标准：

```bash
federlet create remote --framework react --name remote-orders --route /orders --port 3010 --title Orders
pnpm --filter @federlet/remote-orders typecheck
```

### 阶段三：实现 `register remote`

实现本地 Shell manifest 注册和来源策略更新。

验收标准：

```bash
federlet register remote --shell react --id orders --remote-name remote_orders --basename /orders --path /orders/* --entry-base-url http://localhost:3010
```

React Shell 启动后能从 runtime manifest 看到 `/orders`。

### 阶段四：实现 `create shell`

实现 React/Vue Shell 模板生成。

验收标准：

```bash
federlet create shell --framework react --name shell-admin --port 3100
pnpm --filter @federlet/shell-admin typecheck
```

生成的 Shell 能通过本地 manifest 注册并加载 remote。

## 后续衔接

脚手架 CLI 完成后，可以继续接 ROADMAP 后续项：

- 本地联调命令：只启动 Shell + 指定 remote。
- remote 接入指南升级为标准 checklist。
- 构建器选择指南：Rspack、Vite、Rsbuild、Webpack 适用场景。

后续 `federlet dev --shell <name> --remote <name>` 可以复用 CLI 中的 manifest 解析、端口检查和 workspace 包定位能力。

## 推荐结论

先实现 `create remote` 和 `register remote`，因为它们直接解决新增业务 remote 的高频接入问题。`create shell` 需要覆盖 runtime manifest、安全策略、错误边界、导航和事件总线，复杂度更高，建议作为第二阶段实现，但应从一开始在 CLI 包结构中预留命令和模板目录。
