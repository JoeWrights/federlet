# Federlet Remote DOM Container Isolation

本文档定义 Federlet 的 remote DOM 容器隔离规范。目标是在不引入 Shadow DOM 或 iframe 作为默认边界的前提下，明确 Shell 与 remote 的 DOM 所有权、挂载位置、浮层归属和卸载清理责任。

## 目标

- Shell 统一创建并持有 remote 根容器。
- remote 只能渲染到 Shell 注入的 `context.container` 内。
- remote 内部 Portal、Modal、Toast、Dropdown 等浮层必须挂到自身容器内。
- 路由切换、重试或卸载时，remote 必须清理自己创建的 DOM 和监听器。
- 避免 remote 直接污染 Shell DOM、其他 remote DOM 或全局 document。

## 容器契约

Shell 为每个 remote 创建独立容器，并注入给 remote 的 `mount(context)`：

```tsx
<div
  className="remote-boundary__container federlet-scope-remote-react"
  data-federlet-remote="remote_react"
/>
```

容器必须具备：

- 稳定的基础 class：`remote-boundary__container`。
- 稳定的样式隔离 class：`federlet-scope-<remote-name>`。
- remote 标识：`data-federlet-remote="<remoteName>"`。

remote 只能使用 `context.container` 作为框架实例挂载根节点：

```ts
export function mount(context: MicroAppContext): MicroAppInstance {
  app.mount(context.container);

  return {
    unmount() {
      app.unmount();
    },
  };
}
```

禁止 remote 自行查找或创建全局挂载点，例如 `#root`、`#app`、`document.body`、Shell 布局节点或其他 remote 容器。

## DOM 所有权边界

Shell 拥有：

- Shell 布局、导航、路由出口和 remote 外层边界。
- remote 根容器的创建、展示、错误态和重试入口。
- `data-federlet-remote`、scope class、容器基础尺寸等外层属性。

remote 拥有：

- `context.container` 内部的框架根节点和业务 DOM。
- remote 内部路由、组件树和业务交互。
- remote 自己创建的 Portal 容器、浮层节点和临时 DOM。

remote 不得修改：

- `document.body`、`document.documentElement` 的 class、style 或 dataset。
- Shell 的导航、布局、错误边界、加载态节点。
- 其他 remote 的 `data-federlet-remote` 容器。
- 全局 `#root`、`#app` 等应用根节点。

## 浮层和 Portal 规则

remote 中所有脱离普通 DOM 层级的 UI 都必须挂到 `context.container` 或其内部子节点：

- Modal
- Drawer
- Toast
- Tooltip
- Dropdown
- Popover
- DatePicker 面板
- React Portal / Vue Teleport

推荐做法是在 remote 内部统一提供浮层容器：

```ts
function getOverlayContainer(context: MicroAppContext) {
  let overlayRoot = context.container.querySelector<HTMLElement>(
    "[data-federlet-overlay-root]",
  );

  if (!overlayRoot) {
    overlayRoot = document.createElement("div");
    overlayRoot.dataset.federletOverlayRoot = "true";
    context.container.append(overlayRoot);
  }

  return overlayRoot;
}
```

第三方组件库如果默认把浮层挂到 `document.body`，remote 必须显式配置 `getContainer`、`appendTo`、`teleport` 或等价选项，把浮层重定向到 `context.container` 内。

## 卸载清理规则

remote 的 `mount(context)` 必须返回 `unmount()`，并在其中清理：

- 框架实例，例如 React root、Vue app、Umi/legacy render root。
- remote 创建的 Portal、Toast、Modal、Dropdown 等浮层 DOM。
- 绑定在 `window`、`document`、`body` 上的事件监听。
- 定时器、轮询、订阅、观察器和异步任务。
- remote 自己创建的 `<style>` 或其他临时资源。

Shell 在路由切换、重试或边界卸载时调用 remote 返回的 `unmount()`。如果 remote 在加载完成前 Shell 已经卸载，Shell 会调度释放刚创建的 remote 实例。

## 禁止模式

以下模式默认视为违反容器隔离规范：

```ts
document.body.appendChild(node);
document.querySelector("#root")?.appendChild(node);
document.querySelector(".shell")?.classList.add("remote-active");
document.body.classList.add("remote-theme-dark");
```

如确实需要全局能力，应先通过 Shell 注入的上下文、事件总线或后续权限模型声明，不允许 remote 隐式修改全局 DOM。

## 框架层校验策略

Shell 应在框架层对 DOM 逃逸做非阻断式检测。检测到 remote 在 `context.container` 外创建或遗留 DOM 时，框架输出 `console.error`，但不阻断 remote 渲染，也不把边界切换到错误态。

首期采用快照式检测，避免 monkey patch `appendChild`、`removeChild` 等 DOM API 影响 React、Vue 或第三方组件库内部行为：

- mount 前记录 `document.body` 下已有节点。
- mount 后对比新增节点，若新增节点不在当前 remote 的 `context.container` 内，则报告 DOM 逃逸。
- unmount 后再次对比 mount 前快照，若容器外仍有新增节点，则报告卸载残留。
- 优先报告带 `data-federlet-remote`、`data-federlet-overlay-root`、remote namespace class 或其他可识别标记的节点。

默认处理策略：

- development/test：输出 `console.error`，测试可断言该错误。
- production：不阻断渲染；后续接入监控后按 remote 维度上报。
- CI/E2E：明确的 DOM 逃逸或 unmount 残留用例应作为失败项。

## 与样式隔离的关系

DOM 容器隔离和样式隔离必须同时成立：

- 样式隔离保证 CSS selector 限定在 `.federlet-scope-<remote>` 下。
- DOM 容器隔离保证 remote 的 DOM 和浮层实际位于该 scope class 内。

如果 remote 把 Modal 或 Toast 挂到 `document.body`，即使 CSS 已经前缀化，样式也可能无法命中，或者为了修复样式而引入新的全局 selector。因此 Portal/浮层容器必须纳入 DOM 隔离规范。

## 验证策略

- Shell 单测覆盖 remote 容器 class 和 `data-federlet-remote` 生成。
- remote 契约测试覆盖 `mount(context)` 必须使用 `context.container` 并返回 `unmount()`。
- 组件测试覆盖浮层类组件必须挂到 remote 容器内，而不是 `document.body`。
- 运行时 smoke 在 mount/unmount 后检查 remote 容器外没有残留由 remote 创建的 DOM。
- 样式污染检测继续覆盖动态 `<style>` 和未 scoped selector，避免 DOM 逃逸后引发全局样式污染。

## 非目标

- 首期不把所有 remote 强制迁移到 Shadow DOM。
- 首期不把 remote 放入 iframe。
- 本规范不替代 JS 沙箱；全局变量、全局事件和存储访问由后续 JS 运行时隔离/副作用治理规范覆盖。
