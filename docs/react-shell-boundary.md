# React Shell Boundary

`@federlet/react-shell` 提供 React Shell 应用可直接复用的 remote 挂载边界。它把 `RemoteAppBoundary`、加载韧性默认策略、DOM 逃逸诊断、错误态文案和手动重试收敛到 package 中，避免 CLI 创建出来的 Shell 应用复制运行时 glue code。

## CLI 默认模板

生成的 React Shell 应用默认只需要在路由里使用 `RemoteAppBoundary`：

```tsx
import { RemoteAppBoundary } from "@federlet/react-shell";

<Route
  path={route.path}
  element={<RemoteAppBoundary key={route.id} route={route} />}
/>;
```

默认行为包括：

- remote 加载超时 `8000ms`。
- 自动重试最多 `3` 次总尝试。
- 连续失败 `3` 次后熔断，冷却 `30000ms`。
- 开发环境报告 remote DOM 逃逸。
- 保留 Loading、Error 和 Retry 默认 UI。

## 公共能力

`@federlet/react-shell` 的框架无关工具由 `@federlet/shell-core` 提供，包括 `DEFAULT_REMOTE_LOAD_OPTIONS`、`createRemotePreloader()`、`createRemoteErrorMessage()`、`createRemoteErrorDetails()`、`formatRemoteErrorDetails()`、`reportRemoteDomEscapes()` 和 `scheduleRemoteUnmount()`。

为了兼容已有调用方，这些工具仍然可以继续从 `@federlet/react-shell` 导入；新的跨框架代码可以直接依赖 `@federlet/shell-core`。

## 自定义加载策略

业务可以通过 `loadOptions` 覆盖默认策略：

```tsx
<RemoteAppBoundary
  route={route}
  loadOptions={{
    retry: {
      maxAttempts: 1,
    },
    timeoutMs: 3000,
  }}
/>;
```

## 自定义错误文案

```tsx
import { RemoteLoadErrorCode } from "@federlet/mf-runtime";

<RemoteAppBoundary
  route={route}
  messages={{
    [RemoteLoadErrorCode.Timeout]: "应用加载超时，请稍后重试。",
    default: "应用暂不可用。",
  }}
/>;
```

## 自定义 UI

如果默认错误态不满足业务需求，可以只覆盖错误渲染：

```tsx
<RemoteAppBoundary
  route={route}
  renderError={({ errorMessage, retry }) => (
    <section role="alert">
      <p>{errorMessage}</p>
      <button type="button" onClick={retry}>
        重新加载
      </button>
    </section>
  )}
/>;
```

## 自定义挂载上下文

当 Shell 需要给 remote 注入额外上下文时，可以覆盖 `createMountContext`：

```tsx
<RemoteAppBoundary
  route={route}
  createMountContext={({ container, route }) => ({
    basename: route.basename,
    container,
    props: {
      tenantId: "tenant-a",
    },
  })}
/>;
```

## 完全自定义布局

需要完全控制 UI 时，使用 `useRemoteAppMount`：

```tsx
import { useRemoteAppMount } from "@federlet/react-shell";

function CustomRemoteBoundary({ route }: { route: RemoteRouteConfig }) {
  const remote = useRemoteAppMount({ route });

  return (
    <section aria-busy={remote.status === "loading"}>
      {remote.status === "error" ? (
        <button type="button" onClick={remote.retry}>
          Retry
        </button>
      ) : null}
      <div ref={remote.containerRef} className={remote.containerClassName} />
    </section>
  );
}
```
