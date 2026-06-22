---
title: "Window 全局属性治理方案对比"
description: "对比 remote 自有 key 空间、平台白名单、opt-in 清理和 Proxy 执行上下文四种 window 全局属性治理方向。"
category: "design"
status: draft
last_modified: "2026-06-22"
---

# Window 全局属性治理方案对比

## 背景

Federlet 曾尝试通过 `windowPropertySnapshotManager` 做全量 `window` 属性快照恢复：第一个 sandbox 激活前记录真实 `window` 自有属性，最后一个 sandbox 释放后删除新增属性并恢复被修改的 descriptor。

这个方案能治理一部分 remote 直接写入：

```ts
window.foo = "remote";
```

但它已经确认会误删很多运行时全局属性。Module Federation、Webpack、Rspack、Rsbuild、Vite、React Refresh、Vue HMR 都可能在 `window` / `self` 上维护运行时状态，例如 `__FEDERATION__`、`webpackChunk*`、`chunk_*`、`remote_*`、`__webpack*`。一旦被快照恢复误删，会导致 `ChunkLoadError`、`RUNTIME-001`、remoteEntry exports 异常或 HMR/runtime 状态错乱。

因此，Federlet 不应继续依赖“扫描整个 `window` 并删除非基线属性”的默认策略。下面对比四个更可控的演进方向。

## 方案一：remote 自有 key 空间

remote 自有 key 空间是指约定 remote 只能把需要暴露到真实 `window` 的值写入明确命名空间，而不是散落在全局顶层。

示例：

```ts
window.__FEDERLET_REMOTES__ ??= {};
window.__FEDERLET_REMOTES__.remote_react = {
  sdk,
  debugState,
};
```

也可以约定顶层前缀：

```ts
window.__remote_react_debug__ = debugState;
```

### 优点

- 实现成本最低，不需要接管 Module Federation chunk 执行。
- 不会扫描和删除平台运行时全局，避免再次误删 `chunk_*`、`webpackChunk*`、`__FEDERATION__`。
- 适合可信团队协作，规范清晰，review 和 lint 都容易落地。
- 方便做诊断：Shell 可以只检查 `__FEDERLET_REMOTES__[remoteName]` 或指定前缀。
- 兼容所有构建器和框架。

### 缺点

- 只能约束遵守规范的 remote，不能阻止任意 `window.foo = ...`。
- 对第三方库内部写全局无能为力。
- 需要迁移已有 scattered global keys。
- 运行期间仍然是真实 `window` 写入，不是隔离。

### 适用场景

- 可信 remote 团队。
- 需要给调试、监控、SDK 或兼容层保留少量真实全局。
- 当前阶段想先把“可接受的全局写入”和“污染”区分开。

## 方案二：平台白名单 / 保护名单

白名单方案是指 sandbox 清理或诊断时显式保护平台运行时 key，不把这些 key 当作 remote 污染处理。

当前至少应保护：

```text
__FEDERATION__
webpackChunk*
webpackHotUpdate*
__webpack*
remote_*
chunk_*
```

它也可以扩展成“允许 remote 使用的 key 列表”，例如 manifest 中声明：

```ts
{
  remoteName: "remote_react",
  sandbox: {
    allowedWindowKeys: ["__remote_react_debug__"],
  },
}
```

### 优点

- 可以立刻降低误删平台运行时全局的风险。
- 对现有 `windowPropertySnapshotManager` 或诊断逻辑改动较小。
- 适合作为其他方案的基础保护层。
- 能把“平台运行时全局”和“remote 业务全局”在治理逻辑中区分开。

### 缺点

- 单独作为治理方案不够可靠。运行时 key 命名来自不同构建器、插件和版本，名单会持续膨胀。
- 容易漏掉新 runtime key，导致再次误删。
- 如果白名单过宽，会掩盖真正的 remote 污染。
- 白名单只能“不要删什么”，不能定义“应该如何写全局”。

### 适用场景

- 作为底线保护：任何清理逻辑都必须先保护 bundler / MF / HMR runtime。
- 辅助 opt-in 清理或诊断。
- 不适合作为唯一方案。

## 方案三：opt-in 清理 / 恢复

opt-in 方案是指不再扫描整个 `window`，而是由 remote 或 manifest 显式声明哪些 key 归它所有、哪些 key 可以在 unmount 后删除或恢复。

示例：

```ts
{
  remoteName: "remote_react",
  sandbox: {
    cleanupWindowKeys: ["__remote_react_debug__"],
    restoreWindowKeys: ["legacyRemoteConfig"],
  },
}
```

也可以提供运行时 API，让 remote 主动注册：

```ts
context.sandbox?.registerWindowKey("__remote_react_debug__", {
  cleanup: "delete-on-unmount",
});
```

### 优点

- 比全量快照恢复安全得多，只处理明确归属 remote 的 key。
- 可以按 remote 灰度开启，不影响其他 remote。
- 能兼容遗留 remote：先声明少量必须清理的旧 key。
- 行为可审计，manifest 或代码里能看到清理范围。
- 不依赖猜测平台 runtime key 的完整名单。

### 缺点

- 需要 remote 配合声明，不能自动捕捉未知污染。
- 配置错误会导致污染残留或误删业务依赖。
- 需要设计 key 归属、冲突检测和诊断输出。
- 对第三方库动态生成的全局 key 仍然难治理，除非能提前声明模式。

### 适用场景

- 已知 remote 会写少量真实 `window` key。
- 需要兼容历史全局变量。
- 希望从“全量快照恢复”迁移到可控清理。

## 方案四：Proxy 执行上下文

Proxy 执行上下文是更接近 qiankun / lego-sandbox 的方向：为每个 remote 创建 proxy global，让 remote 看到的 `window`、`self`、`globalThis` 指向 proxy。remote 写入：

```ts
window.foo = "remote";
```

实际落到 remote 私有 target，而不是真实 `window`。

### 优点

- 能在运行期间隔离大部分 `window.xxx` 写入。
- Shell 和其他 remote 默认看不到 remote 私有全局。
- 比卸载后恢复更接近真正的 JS 全局隔离。
- 未来可以配合白名单，把少量必须共享的 key 同步到真实 `window`。

### 缺点

- 实现成本最高。
- Federlet 基于 Module Federation，不是 HTML Entry；remoteEntry、shared scope、async chunk 的执行时机不完全由 Shell 控制，不能简单套 `with(proxyWindow) { ... }`。
- 浏览器 API 需要处理 `this` 绑定，否则容易出现 `Illegal invocation`。
- 不可配置属性、跨 realm 对象、HMR、React/Vue dev runtime、第三方库兼容都需要大量验证。
- 仍然不是安全沙箱，不能防恶意 remote 主动逃逸到真实全局。
- 对 DOM、storage、cookie、prototype 污染没有天然治理能力。

### 适用场景

- 中长期增强。
- 高风险但仍可信的 remote。
- 需要运行期间隔离 `window` 写入，而不是只在卸载后清理。

## 横向对比

| 方向 | 主要目标 | 实现成本 | 运行期间隔离 | 误删 runtime 风险 | 需要 remote 配合 | 推荐阶段 |
| --- | --- | --- | --- | --- | --- | --- |
| remote 自有 key 空间 | 规范真实全局写入位置 | 低 | 否 | 低 | 是 | 立即推进 |
| 平台白名单 / 保护名单 | 避免误删 bundler/MF/HMR 全局 | 低到中 | 否 | 中，取决于名单完整性 | 否 | 作为基础保护 |
| opt-in 清理 / 恢复 | 只清理明确归属 remote 的 key | 中 | 否 | 低 | 是 | 短中期推进 |
| Proxy 执行上下文 | 隔离 remote 的 `window` 写入 | 高 | 是，覆盖有限 | 低，但兼容风险高 | 部分需要 | 中长期评估 |

## 推荐组合

### 短期：规范 + 诊断

短期不建议恢复全量 `window` 快照。推荐先建立 remote 自有 key 空间规范：

- remote 如需真实全局，必须写入 `window.__FEDERLET_REMOTES__[remoteName]` 或统一前缀。
- Shell 开发态诊断非规范全局写入。
- 文档和 demo 明确：直接 `window.foo = ...` 属于污染。

### 短中期：opt-in 清理

对确实需要清理的历史 key，使用 manifest 或 runtime API 显式声明：

- `cleanupWindowKeys`
- `restoreWindowKeys`
- `allowedWindowKeys`

清理范围必须可审计，不再做全量扫描删除。

### 中长期：Proxy 执行上下文

如果业务需要运行期间隔离，再评估 Proxy 执行上下文。这个方向应独立立项，重点验证：

- Module Federation remote exposed module 是否能稳定在 proxy global 下执行。
- shared scope 和 async chunk 是否会受影响。
- React/Vue dev runtime 和 HMR 是否兼容。
- 浏览器 API 绑定和第三方库行为是否稳定。

## 不推荐继续推进的方向

不推荐把当前 `windowPropertySnapshotManager` 扩展成更大的黑名单系统，然后继续默认启用全量快照恢复。原因是：

- 运行时全局 key 来源太多，无法稳定枚举。
- 每补一个黑名单都只是修复一个已知事故，不能证明未来不会误删。
- dev server、HMR 和 Module Federation runtime 的全局状态经常只在特定加载顺序下出现。
- 一旦误删，故障表现会非常分散，例如 `ChunkLoadError`、`RUNTIME-001`、组件被替换、样式失效、刷新后恢复。

## 最终建议

Federlet 现阶段应把全局属性治理拆成三层：

1. **规范层**：remote 自有 key 空间，定义什么全局写入是被允许的。
2. **治理层**：opt-in 清理和平台运行时保护，只处理明确归属的 key。
3. **隔离层**：Proxy 执行上下文，作为中长期能力验证。

全量 `window` 快照恢复只保留为实验性诊断工具，不作为默认沙箱策略。
