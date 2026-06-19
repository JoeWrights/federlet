# Vue Shell Boundary

`@federlet/vue-shell` 提供 Vue Shell 应用可直接复用的 remote 挂载边界。它和 `@federlet/react-shell` 保持同一组运行时语义：默认加载韧性策略、DOM 逃逸诊断、错误态文案和手动重试都收敛在 package 中。

## CLI 默认模板

Vue Shell 应用默认只需要在页面中使用 `RemoteAppBoundary`：

```vue
<script setup lang="ts">
import { RemoteAppBoundary } from "@federlet/vue-shell";
</script>

<template>
  <RemoteAppBoundary :route="route" />
</template>
```

默认行为包括：

- remote 加载超时 `8000ms`。
- 自动重试最多 `3` 次总尝试。
- 连续失败 `3` 次后熔断，冷却 `30000ms`。
- 开发环境报告 remote DOM 逃逸。
- 保留 Loading、Error 和 Retry 默认 UI。

## Vue runtime 隔离

当 Vue Shell 承载一个完整的 Vue remote 应用时，不要把 `vue` 作为 Module Federation singleton shared 依赖共享。Vue remote 应该被当作独立应用挂载到 `RemoteAppBoundary` 创建的容器里，而不是复用 Shell 的 Vue runtime。

推荐在 Vue Shell 和 Vue remote 的 Rspack 配置里关闭默认 shared：

```ts
export default createVueHostConfig({
  appDir,
  name: "shell_vue",
  port: 3004,
  publicPath: "/",
  remotes: {},
  shared: false,
});
```

```ts
export default createVueRemoteConfig({
  appDir,
  name: "remote_vue",
  port: 3002,
  exposes: {
    "./mount": "./src/mount.ts",
  },
  shared: false,
});
```

这个约束只针对“完整 Vue remote app”场景。纯 JS 工具包、类型包、设计 token 等通常可以共享；Vue 组件库要谨慎，因为它们通常通过 peer dependency 依赖 `vue`，错误地共享 `vue` singleton 后可能让 remote 的 `app.mount(container)` 影响 Shell 的根渲染树，表现为加载完成后 `#root` 下的 `.shell` 被 remote 内容替换，sidebar 消失。

## 自定义策略

```vue
<RemoteAppBoundary
  :route="route"
  :load-options="{
    retry: { maxAttempts: 1 },
    timeoutMs: 3000,
  }"
/>
```

## 自定义挂载上下文

```vue
<RemoteAppBoundary
  :route="route"
  :create-mount-context="
    ({ container, route }) => ({
      basename: route.basename,
      container,
      props: { tenantId: 'tenant-a' },
    })
  "
/>
```

## 完全自定义 UI

需要完全控制 UI 时，使用 `useRemoteAppMount`：

```ts
import { useRemoteAppMount } from "@federlet/vue-shell";

const remote = useRemoteAppMount({ route });
```

`remote.containerRef` 和 `remote.containerClassName` 用于渲染 remote 容器，`remote.status`、`remote.errorMessage` 和 `remote.retry()` 用于自定义 loading/error UI。
