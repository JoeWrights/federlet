---
title: "Federlet 沙箱对比说明"
description: "对比 Federlet 当前沙箱、qiankun 沙箱和 lego-sandbox 的定位、能力边界与适用场景。"
category: "design"
status: draft
last_modified: "2026-06-21"
---

# Federlet 沙箱对比说明

## 结论

Federlet 当前实现的是一套面向 Module Federation remote 生命周期的轻量治理型沙箱。它的核心目标不是复制 qiankun 的完整 HTML Entry 沙箱，而是在 `mount(context)` 到 `unmount()` 之间治理可信 remote 的常见全局副作用。

和 qiankun 相比，Federlet 沙箱更轻，覆盖面更窄，但更贴合 Federlet 当前的运行模型：remote 已经由 Module Federation 加载，Shell 已经通过 `context.container` 约束 DOM 挂载，样式隔离也主要依赖构建期 scope 和运行时检测。因此 Federlet 不需要在第一阶段接管脚本加载、动态资源插入、`document.head/body` 重定向和 CSS 重写。

和 `lego-sandbox` 相比，Federlet 当前实现没有复用它的 membrane/compartment 体系，而是直接实现了更贴近 Federlet P1 目标的副作用治理：`setTimeout`、`setInterval`、`requestAnimationFrame`、`window.addEventListener`、全局错误 handler 和 remote 级诊断。

## 三者定位

| 方案 | 定位 | 适合场景 |
| --- | --- | --- |
| Federlet 当前沙箱 | remote 生命周期治理层 | 可信 remote、Module Federation 加载、需要自动清理常见全局副作用 |
| qiankun 沙箱 | HTML Entry 微前端运行时沙箱 | 子应用由 qiankun loader 接管，需动态资源、DOM、样式和历史监听统一治理 |
| lego-sandbox | 从 qiankun sandbox 裁剪出的轻量 JS 沙箱 | 需要 Proxy/Membrane 全局隔离和少量副作用 patch，但不需要 HTML Entry 能力 |

## Federlet 当前沙箱

实现入口在 `packages/sandbox/src/index.ts`。

当前提供两个主要 API：

- `createFederletSandbox(options)`：创建 remote 级沙箱，暴露 `activate()`、`deactivate()`、`globalThis` 和 `getDiagnostics()`。
- `createSandboxedRemoteMount(options)`：包装 Federlet remote mount 流程，确保 mount 前激活沙箱，remote unmount 后释放沙箱，mount 失败时也会兜底释放。

当前能力：

- `mode: "proxy" | "off"`，默认 `proxy`，可显式关闭。
- `globalThis` 使用轻量 Proxy，让 remote 显式写入 `sandbox.globalThis.xxx` 时落到沙箱 target。
- 记录 `globalMutations`，用于定位 remote 写入了哪些全局字段。
- patch 真实 `window` 上的常见副作用 API：
  - `setTimeout` / `clearTimeout`
  - `setInterval` / `clearInterval`
  - `requestAnimationFrame` / `cancelAnimationFrame`
  - `addEventListener` / `removeEventListener`
  - `onerror`
  - `onunhandledrejection`
- `deactivate()` 自动清理未释放的 timer、raf、window listener 和 global handler。
- `getDiagnostics()` 返回 remote 维度的统计信息，例如 listener、timer、raf 和 global mutation 数量。

当前不会做的事：

- 不接管 Module Federation remoteEntry 和 chunk 的加载执行。
- 不保证所有 remote 代码都运行在 Proxy global 下。
- 不代理 `document`、`document.head`、`document.body`。
- 不追踪动态 `<script>`、`<style>`、`<link>`。
- 不做 CSSOM `insertRule` 隔离或样式重写。
- 不提供恶意代码安全边界。

这意味着 Federlet 当前沙箱更准确地说是“生命周期副作用沙箱”，不是“完整 JS 安全沙箱”。

## qiankun 沙箱

qiankun 的沙箱是和 HTML Entry loader 深度绑定的一整套运行时隔离能力。它在 `createSandboxContainer()` 中根据环境选择不同沙箱：

- 支持 Proxy 时使用 `ProxySandbox` 或 legacy proxy sandbox。
- 不支持 Proxy 时使用 `SnapshotSandbox`。
- mount/unmount 阶段会配合 patchers 记录、释放和重建副作用。

qiankun 的能力比 Federlet 当前沙箱完整得多：

- Proxy 沙箱维护 fake window，并处理大量浏览器全局对象、不可配置属性、`window/self/globalThis/top/parent` 等访问细节。
- Snapshot 沙箱通过 window 快照 diff 在低版本浏览器里恢复全局状态。
- patchers 覆盖：
  - interval
  - window listener
  - history listener
  - dynamic append
  - CSS/scoped CSS 相关能力
- dynamic append 会参与 `document.createElement`、`document.querySelector("head")`、`HTMLHeadElement.appendChild` 等路径，追踪动态插入资源。
- strict sandbox 下会把动态资源关联到子应用容器，支持样式和资源在子应用切换时重建。

qiankun 的代价也更高：

- 运行模型默认假设子应用资源由 qiankun loader 接管。
- DOM、样式、脚本动态插入都会被运行时 patch。
- 对框架、组件库、CSS-in-JS、动态脚本和嵌套沙箱的兼容逻辑复杂。
- 如果直接搬到 Federlet，会把 HTML Entry、动态资源治理和 DOM patch 成本带入 Module Federation 架构。

## lego-sandbox

`lego-sandbox` 是从 qiankun sandbox 裁剪出的轻量包。它保留了部分 JS 全局隔离主干，但去掉了 qiankun 中和 HTML Entry、动态资源、DOM 容器、样式隔离强绑定的能力。

保留能力：

- `createSandboxContainer(appName, opts)` 生命周期。
- `StandardSandbox` / membrane 风格的 Proxy global。
- `window/self/globalThis` 指向沙箱代理。
- `extraGlobals` 注入。
- 部分原生函数重绑定，避免 illegal invocation。
- mount 阶段 patch：
  - `setInterval`
  - `window.addEventListener`

缺失能力：

- bootstrapping 阶段 patch 为空。
- 没有 `setTimeout` 清理。
- 没有 `requestAnimationFrame` 清理。
- 没有 global handler 清理。
- history patch 被注释。
- 没有 dynamic append。
- 没有 `document.head/body` 代理。
- 没有 CSSOM patch 或样式重建。
- 删除了 qiankun 中更完整的执行工厂和部分沙箱类型分发能力。

因此 `lego-sandbox` 可以作为轻量 JS 沙箱起点，但如果直接用在 Federlet 第一版里，还需要补齐 Federlet 更常遇到的 timeout、raf、global handler 和 remote 级诊断。

## 关键差异

| 能力 | Federlet 当前沙箱 | lego-sandbox | qiankun 沙箱 |
| --- | --- | --- | --- |
| 默认运行模型 | Module Federation + `mount(context)` | 通用轻量容器 | HTML Entry + qiankun loader |
| 生命周期接入 | 包装 remote mount/unmount | `createSandboxContainer` | `createSandboxContainer` |
| Proxy global | 轻量支持 | 支持 | 完整支持 |
| Snapshot 沙箱 | 不支持 | 不支持 | 支持 |
| `setInterval` 清理 | 支持 | 支持 | 支持 |
| `setTimeout` 清理 | 支持 | 不支持 | 间接可通过 patch 扩展，主线 patcher 更偏 interval |
| `requestAnimationFrame` 清理 | 支持 | 不支持 | ProxySandbox 中有全局处理，patcher 侧不是第一层能力 |
| window listener 清理 | 支持 | 支持 | 支持 |
| `window.onerror` / `onunhandledrejection` | 支持 | 不支持 | 不是 lego 裁剪层的核心能力，qiankun 可通过完整 runtime 处理更多全局路径 |
| history listener | 不支持 | 不支持 | 支持 |
| dynamic append | 不支持 | 不支持 | 支持 |
| `document.head/body` 代理 | 不支持 | 不支持 | 支持 |
| 动态 style/script/link 追踪 | 不支持 | 不支持 | 支持 |
| CSS scoped / CSSOM patch | 不支持 | 不支持 | 支持 |
| remote 级诊断 | 支持 | 不支持 | 有内部记录，但不是面向 Federlet remote 诊断 API |
| 强安全隔离 | 不支持 | 不支持 | 不支持，仍不能替代 iframe/CSP |

## 为什么 Federlet 没有直接复用 lego-sandbox

Federlet 当前需要的是“刚好覆盖 P1 目标”的能力，而不是复用一个 qiankun 裁剪版抽象后再继续补洞。

主要原因：

- Federlet 的接入点是 `RemoteAppBoundary` 和 `mountRemoteApp()`，不需要 `createSandboxContainer` 的 bootstrap/mount 双阶段模型。
- Federlet 需要第一版就覆盖 `setTimeout`、raf、global handler 和诊断，而 `lego-sandbox` 默认只 patch interval 和 window listener。
- Federlet 需要把沙箱实例和 `MicroAppInstance.unmount()` 绑定，确保 remote 自身卸载后再释放全局副作用。
- Federlet 不采用 HTML Entry，因此 `lego-sandbox` 保留下来的 qiankun 生命周期语义对当前架构收益有限。
- 自研轻量实现更容易明确边界：只治理生命周期副作用，不暗示 DOM/CSS/资源加载也被隔离。

## Federlet 后续可演进方向

当前实现完成的是第一阶段：可信 remote 的副作用治理。

后续如果需要增强，可以按风险逐层推进：

1. 补 history 相关治理：`pushState`、`replaceState`、`popstate` listener。
2. 补 DOM 逃逸治理：给逃逸节点打 owner 标记，unmount 后输出诊断或可选清理。
3. 补更多浏览器副作用：`MutationObserver`、`ResizeObserver`、`IntersectionObserver`。
4. 为 manifest/route 增加 `sandbox.mode` 配置。
5. 对高风险 remote 引入 iframe 模式，而不是继续扩大 Proxy 沙箱的安全承诺。

## 最终判断

Federlet 当前沙箱比 `lego-sandbox` 更窄但更贴合 Federlet，重点补齐 remote 生命周期副作用治理；比 qiankun 沙箱轻很多，也明确不接管 HTML Entry、动态资源和 DOM/CSS 运行时隔离。

如果目标是让可信团队的 Module Federation remote 更可控，当前方向是合适的。如果目标是加载不可信 remote 或复制 qiankun 的完整运行时隔离，需要另起 iframe/CSP/来源校验方案，而不是继续把当前 Proxy 沙箱扩成安全容器。
