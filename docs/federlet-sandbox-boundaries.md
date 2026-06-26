# Federlet 沙箱能力边界说明

本文总结当前 Federlet 沙箱在全局污染治理上的能力边界，并说明 `window` 属性快照恢复、执行上下文 Proxy 化、`lego-sandbox` 可参考点之间的关系。

## 当前结论

当前 Federlet 沙箱更准确的定位是：

> 生命周期副作用治理沙箱 + 诊断型 Proxy 沙箱。

它已经能在 remote 生命周期内追踪并清理：

- `setTimeout`
- `setInterval`
- `requestAnimationFrame`
- `window.addEventListener`
- `window.onerror`
- `window.onunhandledrejection`

但它还不是完整的 JS 执行上下文隔离沙箱。remote 如果直接写真实浏览器全局对象，例如：

```js
window.foo = "remote";
globalThis.bar = "remote";
Array.prototype.extra = "polluted";
```

这些写入在 remote 挂载期间仍会落到真实宿主环境上。曾经尝试过通过 `window` 属性快照恢复在最后一个 sandbox 卸载后回滚新增或改写的 `window` 自有属性，但该方案已经确认会误删大量构建器和 Module Federation 运行时全局，现阶段不应作为默认能力启用。

## 当前沙箱防不住的典型场景

以下场景目前只能被 demo 检测到，不能被当前沙箱完整隔离；其中 `window` 自有属性写入暂不建议通过全量快照恢复治理：

- remote 直接写 `window.foo = ...`：运行时不隔离；全量快照恢复存在误删运行时全局风险，现阶段默认关闭。
- remote 直接改 `document.body`、`document.head`。
- remote 动态插入 `style`、`link`、`script`。
- remote 写入 `localStorage`、`sessionStorage`、`cookie`。
- remote 修改内建原型，例如 `Array.prototype.xxx = ...`。

这些场景已经在 `apps/remote-react` 的 Sandbox Risk Lab 中提供演示，Shell 首页会展示对应污染状态。

## window 属性快照恢复

`window` 属性快照恢复是“事后治理”方案，当前在 `@federlet/sandbox` 中有实验性实现，但现阶段不建议默认启用。

基本思路：

1. 第一个 sandbox activate 前记录真实 `window` 的自有属性和 descriptor。
2. 最后一个 sandbox deactivate 后重新扫描 `window`。
3. 删除 mount 后新增的属性。
4. 恢复 mount 期间被修改的属性 descriptor/value。

它能解决的问题是：

- 避免 `window.foo = ...` 这类污染在所有 sandbox 卸载后继续留在 Shell。
- 接入成本较低，不需要重构 remote 加载/执行链路。
- 可以作为调试手段，用来确认某个 remote 是否存在直接 `window` 污染。

它不能解决的问题是：

- remote 运行期间污染已经发生。
- Shell 或其他 remote 在同一时间仍可能读到污染后的真实 `window`。
- 多 remote 并发时，为避免一个 remote 卸载误删另一个仍运行 remote 的属性，当前在最后一个 sandbox 卸载后统一恢复。
- 对复杂对象内部变更无能为力，例如 `window.someObject.deep = ...`。
- 对原型链污染、storage/cookie、DOM/head 节点污染没有天然治理能力。
- 会误删或回滚构建器、Module Federation 和 dev runtime 在 `window` / `self` 上新增的运行时全局属性。
- 运行时全局命名不稳定，无法长期依赖黑名单完整保护。

已经确认会被误删或需要特殊保护的运行时全局包括：

- `__FEDERATION__`
- `webpackChunk*`
- `webpackHotUpdate*`
- `__webpack*`
- `remote_*`
- `chunk_*`

其中 `chunk_*` 是 Rsbuild/Rspack async chunk JSONP 运行时常见全局，例如 `chunk_remote_vue`。一旦被删除，后续 remote 异步 chunk 可能出现 `ChunkLoadError`。类似地，Webpack、Vite、React Refresh、Vue HMR、Module Federation runtime 也可能在 dev 模式写入额外全局，快照恢复很容易把这些全局误判成 remote 污染。

因此，快照恢复最多只能作为实验性诊断能力，不能作为 Federlet 当前阶段的默认补救型防污染能力，也不能称为真正的运行时隔离。当前更稳妥的方向是：默认关闭全量快照恢复，优先通过诊断、remote key 命名规范、显式白名单和未来的执行上下文 Proxy 化治理直接 `window` 写入。几种方向的详细对比见 `docs/window-global-governance-options.md`。

## 执行上下文 Proxy 化

执行上下文 Proxy 化是“运行时隔离”方案。

基本思路：

1. 为每个 remote 创建一个 proxy global。
2. 让 remote 代码看到的 `window`、`self`、`globalThis` 都指向这个 proxy。
3. `window.foo = ...` 写入 proxy target，而不写入真实 `window`。
4. 读取真实浏览器 API 时通过 proxy 回退到宿主 `window`，必要时绑定正确的调用上下文。

它能解决的问题是：

- remote 运行期间的全局变量写入不污染真实 `window`。
- Shell 和其他 remote 默认看不到该 remote 的私有全局变量。
- 可以更接近 qiankun/lego-sandbox 的 Proxy global 模型。

它的代价是：

- 需要接入 remote 脚本执行链路。
- Federlet 当前基于 Module Federation，不是 HTML Entry 模型，不能简单用 `with(proxyWindow) { ... }` 包一段脚本。
- 需要处理大量浏览器 API 的 `this` 绑定、不可配置属性、白名单变量、第三方库兼容问题。

因此，执行上下文 Proxy 化是更完整的方向，但不是一个只改 `@federlet/sandbox` 就能完全落地的能力。

## 两者是否重合

两者有目标重合，但职责不同：

```text
window 快照恢复：防止污染“卸载后继续存在”
Proxy 执行上下文：防止污染“运行时发生”
```

快照恢复是补救，Proxy 化是隔离。

即使未来 Federlet 做了真正的 Proxy 执行上下文，快照恢复也只能谨慎作为调试或极小范围兜底能力，用来处理：

- 白名单同步变量。
- 第三方库绕过 proxy 的逃逸写入。
- 执行链路外发生、且 key 空间明确可归属 remote 的全局污染。

不应再采用“扫描整个 `window` 并删除所有非基线属性”的默认策略。

## lego-sandbox 的参考价值

`lego-sandbox` 可以作为 Federlet 设计 Proxy global/membrane 的参考，但不建议直接照搬。

值得参考的点：

- 创建 `realmGlobal = new Proxy(target, traps)`。
- 让 `window`、`self`、`globalThis` 返回 proxy 自身，避免通过 `window.window` 逃回真实 window。
- 在 proxy 上处理 `get`、`set`、`has`、`defineProperty`、`deleteProperty`、`ownKeys`、`getOwnPropertyDescriptor`。
- 对真实 window 上已有属性读取时回退到宿主 `incubatorContext`。
- 对部分浏览器 API 做正确的函数绑定，避免 illegal invocation。
- 通过白名单允许少量变量同步到真实 window。

不应直接照搬的原因：

- `lego-sandbox` 主要提供 Proxy global/membrane 和副作用 patch 容器。
- 真正是否隔离取决于外部加载器是否把 remote 代码放进 `sandbox.globalThis` 下执行。
- Federlet 的 remote 来自 Module Federation，加载模型与 HTML Entry 不同。

换句话说，`lego-sandbox` 的 `Membrane` 思路值得参考，但 Federlet 还需要自己的 Module Federation 执行链路适配。

## lego-sandbox 是否防原型链污染

从当前 `lego-sandbox/lib` 实现看，它没有专门做原型链污染防护。

没有看到以下能力：

- 冻结 `Array.prototype`、`Object.prototype`、`Function.prototype` 等内建原型。
- 对内建原型做快照。
- 在 sandbox inactive/unmount 时恢复原型修改。
- 拦截 `Array.prototype.foo = ...` 这类写入。

它的 `freeze(descriptor)` 主要是冻结 descriptor，避免 descriptor 被第三方库修改，不等于冻结内建原型对象。

因此，如果 micro app 拿到的是同一个宿主 realm 的内建对象，类似下面的污染仍可能影响真实宿主环境：

```js
Array.prototype.__risk__ = "polluted";
Object.prototype.__risk__ = "polluted";
```

这一点 Federlet 也一样。如果后续要治理原型链污染，应单独设计 prototype snapshot 或严格模式冻结策略。

## 推荐演进路线

建议 Federlet 分阶段演进，而不是一次性追求强隔离：

1. **暂缓默认启用 window 属性快照恢复。**
   - 全量 `window` 快照恢复会误删 Module Federation、Webpack/Rspack/Rsbuild/Vite、HMR 等运行时全局。
   - 当前仅保留为实验性诊断能力，不作为默认沙箱能力。
   - 后续若恢复该能力，应改成 remote 自有 key 空间治理、显式白名单或 opt-in 模式，而不是全局扫描删除。

2. **短期：继续完善 DOM/head 节点检测与清理。**
   - 对明确由 remote 创建的 `style`、`link`、`script`、body portal 节点做标记和清理。
   - 对无法安全清理的节点保留诊断。

3. **中期：评估执行上下文 Proxy 化。**
   - 参考 `lego-sandbox` 的 membrane 设计。
   - 结合 Module Federation 加载链路设计 Federlet 自己的 proxy global 接入方式。
   - 当前结论：可做 POC 和部分治理，但不适合作为默认生产沙箱；完整方案必须同时改造 `@federlet/sandbox`、`@federlet/mf-runtime`、Shell preload 策略和 remote mount context，不能只在 sandbox 包内完成。
   - 详细方案见 `docs/proxy-global-feasibility.md`。

4. **中期：storage/cookie 命名空间治理。**
   - 默认先做 key namespace 规范和诊断。
   - 严格模式再考虑阻断非 namespace 写入。

5. **后续：原型链污染治理。**
   - dev/test 下先做原型快照检测和告警。
   - 是否在生产强冻结内建原型需要谨慎评估兼容性。

## 总结

Federlet 当前沙箱已经能解决 remote 生命周期中的常见全局副作用清理问题，但现阶段不应默认依赖 `window` 属性快照恢复来回滚 `window` 自有属性新增和改写。该方案会误删大量运行时全局属性，导致 remote 加载、异步 chunk、HMR 或 Module Federation runtime 异常。它仍不能在运行期间隔离 `window.xxx` 写入，也不能完整防止 DOM/head、storage/cookie、prototype 这类污染。

下一步更务实的增强是继续做 DOM/head 节点追踪清理、storage/cookie 命名空间治理和执行上下文 Proxy 化评估；`window` 属性快照恢复只能在 key 空间明确、风险可控的场景下作为调试或 opt-in 兜底层。
