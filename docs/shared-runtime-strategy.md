# Federlet 共享运行时策略

本文档说明 Federlet 中 Shell 与各 remote 如何共享或隔离 JavaScript 运行时（React、Vue 等），以及不同 React 大版本并存时的风险边界与接入约束。

## 目标

- 明确哪些依赖应通过 Module Federation `shared` 做单例共享。
- 明确哪些 legacy remote 应独立打包运行时，避免版本冲突。
- 列出跨应用边界时的禁止事项，减少 `Invalid hook call`、Context 失效和样式/runtime 污染。

## 当前版本与策略

| 应用 | 框架运行时 | 版本 | Module Federation `shared` |
|------|-----------|------|---------------------------|
| `shell-react` | React | ^19.2.1 | host，共享 `react` / `react-dom` singleton |
| `remote-react` | React | ^19.2.1 | 与 Shell 共享 `react` / `react-dom` singleton |
| `remote-vue` | Vue | ^3.5.25 | 与 Shell 共享 `vue` singleton |
| `remote-umi-react` | React | 17.0.2 | **`shared: {}`，不共享 React** |

`remote-react` 与 Shell 的 React 共享配置由 `@federlet/rspack-config` 的 `reactShared()` 提供：

```ts
function reactShared(): SharedConfig {
  return {
    react: {
      singleton: true,
      requiredVersion: "^19.2.1",
    },
    "react-dom": {
      singleton: true,
      requiredVersion: "^19.2.1",
    },
  };
}
```

`remote-umi-react` 在 Umi `chainWebpack` 中显式使用空 shared，独立打包 React 17：

```ts
config.plugin("module-federation").use(webpack.container.ModuleFederationPlugin, [
  {
    name: "remote_umi_react",
    filename: "remoteEntry.js",
    exposes: {
      "./mount": "./src/mount.tsx",
    },
    shared: {},
  },
]);
```

## React 19 与 React 17 并存：设计意图

`remote-react` 与 `remote-umi-react` 的 React 版本不一致，**不是疏漏，而是为兼容 Umi 3 + React 17 老项目而有意设计**。

- Shell 与新版 React remote 统一使用 React 19，并通过 MF singleton 共享同一份 runtime。
- Umi 3 remote 保留 React 17，通过 `ReactDOM.render` 挂载到 Shell 注入的独立容器，不与 Shell 共享 React。

Umi remote 的挂载方式：

```ts
export function mount(context: MicroAppContext): MicroAppInstance {
  ReactDOM.render(
    <BrowserRouter basename={context.basename}>
      <RemoteApp portalContainer={context.container} />
    </BrowserRouter>,
    context.container,
  );

  return {
    unmount() {
      ReactDOM.unmountComponentAtNode(context.container);
    },
  };
}
```

只要 Umi remote **只渲染在 `context.container` 内**，Shell（React 19）与 Umi（React 17）各自子树中的 hooks、Context、生命周期可以正常工作。

## Vue singleton 策略

Vue remote 与 React Shell 不在同一组件树内，但同样通过 Module Federation 共享 `vue` singleton：

```ts
function vueShared(): SharedConfig {
  return {
    vue: {
      singleton: true,
      requiredVersion: "^3.5.25",
    },
  };
}
```

Vue remote 通过 `createApp(...).mount(context.container)` 挂载到 Shell 容器，与 React remote 一样遵守 [remote DOM 容器隔离规范](./remote-dom-container-isolation.md)。

## 其他共享依赖

除框架 runtime 外，Shell 与 `remote-react` 还通过 MF 共享：

| 依赖 | 策略 | 说明 |
|------|------|------|
| `antd` | singleton + `strictVersion` | Shell 与 `remote-react` 共用 antd 5 |
| `@federlet/shared-ui` | singleton + `strictVersion` | 要求 React ^19.2.1，仅新版 React remote 使用 |

`remote-umi-react` **不**参与上述共享：`shared: {}` 使其独立打包 antd 与 React 17。样式冲突通过 antd `prefixCls` 和 scope class 隔离，见 [样式隔离文档](./style-isolation.md)。

## 风险矩阵

| 场景 | 风险 | 说明 |
|------|------|------|
| Umi remote 独立运行，只渲染在 `context.container` 内 | 低 | 当前设计目标 |
| Shell + `remote-react` 共享 React 19 singleton | 低 | 标准 Module Federation 做法 |
| 跨 Shell / remote 边界传递 React 组件或 Context | 高 | 会引发 hook 异常、Context 读不到 |
| 将 Umi remote 改为共享 `react` singleton | 高 | 19 vs 17 版本冲突，运行时极易崩溃 |
| 让 Umi remote 使用 `@federlet/shared-ui` | 高 | shared-ui 依赖 React ^19.2.1 |
| 同一页面加载 Umi remote | 中（可接受） | 存在两份 React runtime，体积增大 |

## 禁止事项

跨应用边界时，禁止以下做法：

1. **跨边界传递 React 元素或组件**  
   不要把 Shell 或 `remote-react` 渲染出的 React 节点传给 `remote-umi-react`，也不要反向传递。

2. **跨边界共享 React Context**  
   Provider 与 Consumer 必须在同一 React 实例、同一组件树内。

3. **让 legacy remote 参与 React singleton**  
   React 17 的 Umi remote 必须保持 `shared: {}` 或至少不共享 `react` / `react-dom`。

4. **让 legacy remote 依赖 `@federlet/shared-ui`**  
   该包面向 React 19，与 React 17 runtime 不兼容。

5. **在 legacy remote 中使用 Shell 的 React 19 API**  
   例如 `createRoot`、React 19 专属 API，应留在 Shell 或 `remote-react` 内。

## 接入指南

### 新版 React remote（与 Shell 同 major 版本）

1. 使用 `createReactRemoteConfig`，确保 `react` 与 `react-dom` 作为 singleton shared。
2. 在 `mount` 中使用 `createRoot(context.container).render(...)`。
3. 如需共享 UI，声明 `@federlet/shared-ui` 的 `requiredVersion` 并与 Shell 对齐。

### Umi 3 + React 17 legacy remote

1. 在 `chainWebpack` 中注入 `ModuleFederationPlugin`，**`shared` 留空或不包含 `react` / `react-dom`**。
2. 暴露 `./mount`，接收 Shell 的 `container` 和 `basename`。
3. 使用 `ReactDOM.render` / `ReactDOM.unmountComponentAtNode` 挂载与卸载。
4. antd 等 UI 库独立打包，并通过 `prefixCls` 做样式隔离。
5. Node 18+ 如遇 OpenSSL 错误，可在脚本中设置 `NODE_OPTIONS=--openssl-legacy-provider`。

更完整的 Umi 接入步骤见 [README](../README.md#接入现有-umi-3-react-项目)。

### Vue remote

1. 使用 `createVueRemoteConfig`，确保 `vue` 作为 singleton shared。
2. 在 `mount` 中调用 `createApp(...).mount(context.container)`，在 `unmount` 中调用 `app.unmount()`。

## 运行时拓扑

访问 `/umi/*` 时，页面上大致存在以下 runtime：

```text
document
└── Shell (React 19, singleton shared)
    ├── Shell 布局 / 导航 / RemoteAppBoundary
    └── context.container
        └── Umi remote (React 17, bundled locally)
            └── Umi 业务组件树
```

访问 `/react/*` 时：

```text
document
└── Shell + remote-react（共用 React 19 singleton）
    ├── Shell 布局 / 导航 / RemoteAppBoundary
    └── context.container
        └── remote-react 组件树（同一 React 实例）
```

## 相关文档

- [remote DOM 容器隔离规范](./remote-dom-container-isolation.md)
- [样式隔离文档](./style-isolation.md)
- [阶段一架构文档](./architecture-stage-1.md)
- [README：接入现有 Umi 3 React 项目](../README.md#接入现有-umi-3-react-项目)
