# Federlet Style Isolation

本文档定义 Federlet 的默认样式隔离策略：Shell 在运行时为每个 remote 挂载容器提供稳定的隔离 class，remote 在构建期把业务 CSS 选择器自动前缀化到该 class 下。

## 目标

- 阻止 remote 业务样式影响 Shell 或其他 remote。
- 保持 React、Vue、Umi legacy remote 的接入方式一致。
- 复用当前 Module Federation 与多构建器配置，不引入 Shadow DOM 作为默认运行时边界。
- 让新 remote 默认获得样式隔离能力，减少手写命名空间遗漏。

## Scope Class 规范

隔离 class 由 Module Federation remote name 派生：

```ts
createRemoteScopeClass("remote_react");
// "federlet-scope-remote-react"
```

规则：

- 小写化 remote name。
- 将非字母数字字符折叠成 `-`。
- 去掉首尾 `-`。
- 加上固定前缀 `federlet-scope-`。

Shell 在 remote 容器上同时写入 class 和数据属性：

```tsx
<div
  className="remote-boundary__container federlet-scope-remote-react"
  data-federlet-remote="remote_react"
/>
```

remote 的 `context.container` 必须指向这个容器。remote 内部 Portal、Modal、Toast、Dropdown 等浮层也必须挂到 `context.container`，否则前缀化后的样式无法命中。

## CSS 前缀化规则

构建期把 remote 业务 CSS：

```css
button {
  color: red;
}

.react-remote p {
  color: blue;
}
```

改写为：

```css
.federlet-scope-remote-react button {
  color: red;
}

.federlet-scope-remote-react .react-remote p {
  color: blue;
}
```

规则：

- 普通 selector 自动添加 `.<scopeClass>` 前缀。
- selector 已经以该 scope class 开头时跳过，避免重复前缀。
- `@media`、`@supports` 内部规则递归处理。
- `@keyframes`、`@font-face` 不做 selector 前缀化。
- `:root`、`html`、`body` 这类 document 级 selector 不改写，后续由污染检测能力报错或告警。
- `node_modules` CSS 默认不处理，避免误伤第三方组件库样式。

## Package 设计

核心能力封装在 `@federlet/style-isolation`：

```ts
export function createRemoteScopeClass(remoteName: string): string;

export function createRemoteContainerClassName(
  baseClassName: string,
  remoteName: string,
): string;

export function shouldPrefixCssFile(filename: string): boolean;

export function createStyleIsolationPostcssPlugin(options: {
  scopeClass: string;
}): {
  postcssPlugin: string;
  Once(root: unknown): void;
};
```

构建配置包只负责把 PostCSS 插件接入对应构建器，不复制 selector 改写逻辑。

## 构建器接入

Remote 配置默认开启样式隔离，Host 配置默认关闭。

```ts
createReactRemoteConfig({
  name: "remote_react",
  styleIsolation: true,
  // ...
});
```

构建配置包支持：

```ts
styleIsolation?: boolean | {
  scopeClass?: string;
};
```

默认 `scopeClass` 由 `options.name` 派生。

- Rspack：在 CSS loader 链中接入 `postcss-loader` 和 `createStyleIsolationPostcssPlugin`。
- Webpack：使用同样的 `postcss-loader` 接入方式。
- Rsbuild：通过 `tools.postcss.postcssOptions.plugins` 接入。
- Vite：通过 `css.postcss.plugins` 接入。

## 非目标

- 不在首期实现 Shadow DOM。
- 不处理 `node_modules` 第三方 CSS 前缀化。
- 不自动重命名 `@keyframes` 动画名。
- 不在构建期改写 remote 的 React/Vue/Umi DOM 结构。

## 验证策略

- `@federlet/style-isolation` 单测覆盖 class 派生、容器 class 拼接、CSS 文件过滤和 selector 前缀化。
- Shell 测试覆盖 remote 容器 class 生成。
- 各构建配置包测试覆盖 remote 默认启用样式隔离，host 不启用。
- `@federlet/style-isolation` 单测覆盖污染检测规则，禁止 remote 业务 CSS 使用裸 `body`、`:root`、`html`、`#root`、`#app` 或 `:global(...)` 等会逃出容器的 selector。
- 构建后运行 `pnpm check:styles`，扫描 remote `dist/**/*.css`，确认业务 selector 已加 `.federlet-scope-<remote>` 前缀。该命令需要先运行 `pnpm build`。
- Shell 运行时 smoke 覆盖动态 `<style>` 注入：remote 注入的内联样式必须限定在自身 scope class 下，避免 Portal、Toast、Modal 等运行时样式污染 Shell 或其他 remote。

## 污染检测规则

检测能力分为三层：

1. 源码级检测：`detectGlobalStylePollution(css, { scopeClass })` 返回结构化问题列表。`document-level-selector`、`global-root-selector`、`global-pseudo-selector` 为 error；`global-font-face`、`global-keyframes` 为 warn。
2. 产物级检测：`detectUnscopedStyleSelectors(css, { scopeClass })` 用于构建后 CSS，普通业务 selector 必须以当前 remote 的 scope class 开头；兼容 legacy 项目时，可以显式配置 `allowedSelectorPrefixes` 放行已约定的 remote namespace，例如 Umi legacy 的 `.umi-remote`。
3. 运行时检测：`detectRuntimeStylePollution({ root, remoteName, scopeClass })` 扫描 `<style>` 标签内容，捕捉动态插入的未 scoped selector。

污染检测的失败项应作为 CI 阻断项；warn 先用于提示跨 remote 命名冲突风险，后续可按团队规范升级为 error。
