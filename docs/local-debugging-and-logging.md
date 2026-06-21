# 统一日志与 Remote 调试数据

## 背景与目标

Federlet 的 Shell 在运行时读取 manifest、注册 remoteEntry，并通过 `@federlet/mf-runtime` 加载 remote 的 `./mount` 模块。当前日志散落在 Shell、runtime、event bus 和 remote 示例中，格式不统一；registry 已经记录 remote 的注册状态、加载健康状态和 remoteEntry 地址，可以作为后续本地调试面板、CLI 或 DevTools 的数据来源。

本方案对应 `ROADMAP.md` 中两项开发者体验能力：

- 统一日志格式。
- 本地调试面板：显示已注册 remote、加载状态、remoteEntry 地址。

当前阶段先沉淀跨 React/Vue Shell 可复用的日志与 debug snapshot 能力。可视化调试面板暂缓，避免在 remote 数量较少时引入常驻 UI 噪音。

## 范围

本次实现覆盖：

- 在 `@federlet/mf-runtime` 提供统一结构化日志工具。
- 在 `@federlet/mf-runtime` 提供 remote debug snapshot，统一读取 registry 中的 remote 状态。
- React Shell 与 Vue Shell 都接入同一份 registry load health 回写。

本次不覆盖：

- 日志远端上报、采样、持久化和历史查询。
- registry subscribe 推送机制。
- React/Vue Shell 可视化调试面板。
- 熔断器详情面板。
- remote preload 进行中状态。

## 统一日志格式

所有 Federlet 框架层日志统一成结构化事件：

```ts
interface FederletLogEvent {
  timestamp?: string;
  level: "debug" | "info" | "warn" | "error";
  scope: string;
  event: string;
  message: string;
  remoteName?: string;
  routeId?: string;
  error?: unknown;
  context?: Record<string, unknown>;
}
```

日志输出规则：

- 开发环境输出 `debug`、`info`、`warn`、`error`。
- 生产环境默认只输出 `warn` 和 `error`。
- 输出前补齐 ISO 格式 `timestamp`。
- `error` 字段保持原始对象，方便浏览器控制台展开堆栈。
- 控制台前缀统一为 `[federlet] scope:event message`。

MVP 阶段先替换核心框架路径的日志：

- runtime manifest 无效。
- remote 协议版本不兼容。
- event bus 非法事件。
- Shell preload、mount、runtime error。
- Shell 监听到 remote lifecycle 事件。

## 调试数据模型

调试数据不直接读取 manifest，而是读取 `runtimeRemoteRegistry`。这样后续面板、CLI 或 DevTools 展示的是 Shell 实际注册和加载后的状态。

共享 snapshot 字段：

```ts
interface RemoteDebugSnapshotItem {
  id: string;
  title: string;
  remoteName: string;
  exposedModule: string;
  entry?: string;
  remoteEntryType?: "module" | "var";
  registrationStatus: "registered" | "failed";
  loadHealth: "unknown" | "healthy" | "degraded" | "unavailable";
  lastErrorMessage?: string;
  updatedAt: number;
}
```

数据来源：

- `runtimeRemoteRegistry.listRoutes()` 获取当前路由列表。
- `runtimeRemoteRegistry.getByRouteId(route.id)` 获取 entry、health 和 lastError。
- 若 fallback route 没有 remoteEntry，snapshot 中 `entry` 为空。
- 若 lastError 不是 `Error`，统一转成字符串或 JSON 摘要。

## Shell 接入

React Shell 和 Vue Shell 都需要把 registry 传给 remote 加载链路：

- `createRemotePreloader({ loadOptions: { registry: runtimeRemoteRegistry } })`
- `RemoteAppBoundary` 或 Vue boundary 的 `loadOptions` 也传入 `{ registry: runtimeRemoteRegistry }`

这样 preload、mount 成功或失败时，`@federlet/mf-runtime` 才能更新 `loadHealth`。

后续如果恢复可视化面板，应直接消费 `createRemoteDebugSnapshot(runtimeRemoteRegistry)`，而不是重新解析 manifest。面板可以用轮询读取 snapshot，避免过早扩展 registry subscribe API。

## 验收标准

- React Shell 与 Vue Shell 都把 `runtimeRemoteRegistry` 传给 preload 和 mount 链路。
- `createRemoteDebugSnapshot()` 能返回 registry 中已注册 remote 的 entry、entry type、注册状态、加载状态和最后错误。
- remote preload 或 mount 后，registry 中的 `loadHealth` 会从 `unknown` 更新为 `healthy`、`degraded` 或 `unavailable`。
- 关键日志输出统一带 `[federlet]` 前缀和结构化 payload。
