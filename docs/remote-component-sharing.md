# Remote 组件共享方案

## 背景

Federlet 当前的稳定接入协议是应用级协议：每个 remote 暴露 `./mount`，Shell
根据运行时 manifest 注册 remoteEntry 并挂载 remote 应用。这个协议适合路由级微前端，
但不解决 remote 之间复用组件的问题。

组件级共享需要回答两个问题：

- 消费方如何知道某个 remote 暴露了哪些组件。
- 消费方如何获得这些组件的 TypeScript 契约。

第一版采用“组件清单 + 手动类型包”的方式：remote 在运行时 manifest 中声明可消费组件，
类型通过共享 workspace/npm 包同步。这样可以先打通发现和加载能力，同时避免把实现绑死在
某一个构建器的自动 dts 行为上。

## 目标

- remote 可以在 manifest 中声明组件清单。
- Shell 或其他 remote 可以从 runtime registry 查询可消费组件。
- 消费方可以按 `remoteName + componentName` 加载对应 federated module。
- 组件 props/types 通过显式类型包同步，保持类型契约可审查、可版本化。

## 非目标

- 第一版不自动扫描 `exposes` 生成组件清单。
- 第一版不启用 Module Federation 自动 dts 拉取。
- 第一版不提供组件市场 UI、截图、评分、灰度发布等平台能力。
- 第一版不跨框架自动适配渲染。React 组件仍由 React consumer 消费，Vue 组件仍由 Vue consumer 消费。

## Manifest 契约

remote 仍然在构建配置中声明真实的 Module Federation `exposes`：

```ts
export default createReactRemoteConfig({
  appDir,
  name: "remote_react",
  port: 3001,
  exposes: {
    "./mount": "./src/mount.tsx",
    "./components/PrimaryButton": "./src/components/PrimaryButton.tsx",
  },
});
```

运行时 manifest 负责发布组件清单：

```ts
export const DEFAULT_APOLLO_RUNTIME_CONFIG = {
  manifest: {
    remotes: [
      {
        basename: "/react",
        entryBaseUrl: "http://localhost:3001/",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        status: "active",
        title: "React Remote",
        components: [
          {
            name: "PrimaryButton",
            expose: "./components/PrimaryButton",
            framework: "react",
            typePackage: "@federlet/remote-react-contracts",
            contractVersion: "^1.0.0",
            exportName: "default",
            description: "React remote 提供的主按钮组件",
          },
        ],
      },
    ],
  },
};
```

字段说明：

- `name`：消费方使用的稳定组件名，在同一个 remote 内唯一。
- `expose`：remote 构建配置中的 Module Federation 暴露模块名。
- `framework`：组件运行时框架，支持 `react`、`vue`、`web-component`、`unknown`。
- `typePackage`：组件类型契约包，例如 workspace 包或发布到 npm 的包。
- `contractVersion`：类型/props 契约版本，建议使用 semver 范围。
- `exportName`：组件模块导出名；未声明时消费方通常读取 default export。
- `description`、`meta`：可选展示和治理信息。

## 类型同步

第一版不从 remoteEntry 自动同步类型。组件提供方需要发布一个稳定类型包：

```ts
// packages/remote-react-contracts/src/index.ts
export interface PrimaryButtonProps {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}
```

消费方显式依赖该包：

```ts
import type { PrimaryButtonProps } from "@federlet/remote-react-contracts";
import { loadRemoteComponent } from "@federlet/mf-runtime";

type PrimaryButtonModule = {
  default: React.ComponentType<PrimaryButtonProps>;
};

const { default: PrimaryButton } =
  await loadRemoteComponent<PrimaryButtonModule>(
    "remote_react",
    "PrimaryButton",
  );
```

类型包是组件契约的来源。remote 发布组件破坏性变更时，应同步提升类型包主版本，并更新
manifest 中的 `contractVersion`。

## Runtime API

`@federlet/mf-runtime` 提供组件发现和加载 API：

```ts
import {
  getRemoteComponent,
  listRemoteComponents,
  loadRemoteComponent,
} from "@federlet/mf-runtime";

const components = listRemoteComponents();

const definition = getRemoteComponent("remote_react", "PrimaryButton");

const module = await loadRemoteComponent("remote_react", "PrimaryButton");
```

`listRemoteComponents()` 返回 registry 展开的组件定义，其中包含可直接传给 Module
Federation runtime 的 `moduleName`：

```ts
{
  remoteName: "remote_react",
  name: "PrimaryButton",
  expose: "./components/PrimaryButton",
  moduleName: "remote_react/components/PrimaryButton",
  framework: "react",
  typePackage: "@federlet/remote-react-contracts",
  contractVersion: "^1.0.0"
}
```

`loadRemoteComponent(remoteName, componentName)` 会先检查组件是否已经在 registry 中声明。
未声明的组件不会被加载，避免消费方绕过 manifest 治理直接拼接模块名。

## Remote 间消费流程

1. 组件提供方在构建配置中增加 `exposes`。
2. 组件提供方发布或更新类型契约包。
3. 组件提供方在运行时 manifest 的 `components` 中声明组件元数据。
4. Shell 启动时注册 manifest，runtime registry 保存组件清单。
5. 消费方通过 `listRemoteComponents` 或 `getRemoteComponent` 做发现。
6. 消费方引入类型包，并通过 `loadRemoteComponent` 加载组件模块。

## 约束和治理建议

- 不建议业务 remote 随意互相依赖。优先共享稳定基础组件、业务能力组件或跨应用插件点。
- `remoteName + name` 应作为组件稳定标识；`expose` 可以随着内部文件结构调整，但需要保持 manifest 同步。
- 类型包和 remoteEntry 应一起发布、一起回滚。生产环境可以用 `contractVersion` 做兼容校验。
- 跨框架消费应优先通过 web component 或独立 mount 协议，不要让 React remote 直接渲染 Vue 组件模块。
- 如果后续要提升开发体验，可以在第二版引入 Module Federation 自动 dts，并让 CI 校验 manifest 组件和 `exposes` 是否一致。
