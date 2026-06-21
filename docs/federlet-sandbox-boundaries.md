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

这些写入在 remote 挂载期间仍会落到真实宿主环境上。当前短期方案已经补了 `window` 属性快照恢复，因此新增或改写的 `window` 自有属性会在最后一个 sandbox 卸载后回滚，但运行期间仍不是隔离的。

## 当前沙箱防不住的典型场景

以下场景目前只能被 demo 检测到，不能被当前沙箱完整隔离；其中 `window` 自有属性写入已经具备卸载后的快照恢复能力：

- remote 直接写 `window.foo = ...`：运行时不隔离，但最后一个 sandbox 卸载后会快照恢复。
- remote 直接改 `document.body`、`document.head`。
- remote 动态插入 `style`、`link`、`script`。
- remote 写入 `localStorage`、`sessionStorage`、`cookie`。
- remote 修改内建原型，例如 `Array.prototype.xxx = ...`。

这些场景已经在 `apps/remote-react` 的 Sandbox Risk Lab 中提供演示，Shell 首页会展示对应污染状态。

## window 属性快照恢复

`window` 属性快照恢复是“事后治理”方案，当前已在 `@federlet/sandbox` 中实现。

基本思路：

1. 第一个 sandbox activate 前记录真实 `window` 的自有属性和 descriptor。
2. 最后一个 sandbox deactivate 后重新扫描 `window`。
3. 删除 mount 后新增的属性。
4. 恢复 mount 期间被修改的属性 descriptor/value。

它能解决的问题是：

- 避免 `window.foo = ...` 这类污染在所有 sandbox 卸载后继续留在 Shell。
- 接入成本较低，不需要重构 remote 加载/执行链路。
- 可以作为强隔离方案之前的低风险增强。

它不能解决的问题是：

- remote 运行期间污染已经发生。
- Shell 或其他 remote 在同一时间仍可能读到污染后的真实 `window`。
- 多 remote 并发时，为避免一个 remote 卸载误删另一个仍运行 remote 的属性，当前在最后一个 sandbox 卸载后统一恢复。
- 对复杂对象内部变更无能为力，例如 `window.someObject.deep = ...`。
- 对原型链污染、storage/cookie、DOM/head 节点污染没有天然治理能力。

因此，快照恢复适合作为 Federlet 当前阶段的补救型防污染能力，但不能称为真正的运行时隔离。

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

即使未来 Federlet 做了真正的 Proxy 执行上下文，快照恢复仍然有价值，可以作为兜底能力，用来处理：

- 白名单同步变量。
- 第三方库绕过 proxy 的逃逸写入。
- 执行链路外发生的全局污染。

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

1. **已完成：补 window 属性快照恢复。**
   - 第一个 sandbox activate 前记录真实 `window`。
   - 最后一个 sandbox deactivate 后清理新增属性，恢复被改属性。
   - 作为当前副作用治理沙箱的自然增强。

2. **短期：继续完善 DOM/head 节点检测与清理。**
   - 对明确由 remote 创建的 `style`、`link`、`script`、body portal 节点做标记和清理。
   - 对无法安全清理的节点保留诊断。

3. **中期：评估执行上下文 Proxy 化。**
   - 参考 `lego-sandbox` 的 membrane 设计。
   - 结合 Module Federation 加载链路设计 Federlet 自己的 proxy global 接入方式。

4. **中期：storage/cookie 命名空间治理。**
   - 默认先做 key namespace 规范和诊断。
   - 严格模式再考虑阻断非 namespace 写入。

5. **后续：原型链污染治理。**
   - dev/test 下先做原型快照检测和告警。
   - 是否在生产强冻结内建原型需要谨慎评估兼容性。

## 总结

Federlet 当前沙箱已经能解决 remote 生命周期中的常见全局副作用清理问题，并已能在卸载后回滚 `window` 自有属性新增和改写。但它仍不能在运行期间隔离 `window.xxx` 写入，也不能完整防止 DOM/head、storage/cookie、prototype 这类污染。

下一步更务实的增强是继续做 DOM/head 节点追踪清理与 storage/cookie 命名空间治理；`window` 属性快照恢复与未来的执行上下文 Proxy 化不冲突，反而可以作为后者的兜底层。
