# Rsbuild 并行 POC 结果

## 结论

Rsbuild 可以作为当前 Rspack 微前端架构的并行构建 POC 接入。当前实现保留默认 Rspack 脚本和 `@federlet/rspack-config`，新增 `@federlet/rsbuild-config` 与各应用的 `rsbuild.config.ts`，用于独立验证 Rsbuild dev/build 行为。

POC 推荐继续保留并行状态一段时间，再决定是否把默认 `dev` / `build` 切换到 Rsbuild。

## 接入范围

- 新增 `packages/rsbuild-config`，提供 `createReactHostConfig`、`createReactRemoteConfig`、`createVueRemoteConfig`。
- 新增 3 个应用的 `rsbuild.config.ts`，参数与原 `rspack.config.ts` 对齐。
- 新增根级和应用级 `dev:rsbuild` / `build:rsbuild` 脚本，不影响现有 `dev` 和 `build`。
- 使用 `@module-federation/rsbuild-plugin` 接入 enhanced Module Federation，保留 `remoteEntry.js`、`dts: false` 和 `manifest: false`。

## 版本选择

当前项目声明 Node.js `>=18`，本地验证环境为 Node.js 18.15.0。Rsbuild 2.x 依赖的 Rspack 2.x 要求 Node.js 20.19+，因此 POC 使用 Rsbuild 1.x：

- `@rsbuild/core@^1.7.5`
- `@rsbuild/plugin-react@^1.4.6`
- `@rsbuild/plugin-vue@^1.2.9`
- `@module-federation/rsbuild-plugin@^0.21.6`

这样可以避免为了 POC 同时升级 Node.js、Rspack 和 Module Federation 运行时大版本。

## 验证结果

- `pnpm --filter @federlet/rsbuild-config test` 通过。
- `pnpm typecheck` 通过。
- `pnpm --filter @federlet/remote-react build:rsbuild` 通过，生成 `dist/remoteEntry.js`。
- `pnpm --filter @federlet/remote-vue build:rsbuild` 通过，生成 `dist/remoteEntry.js`。
- `pnpm --filter @federlet/shell-react build:rsbuild` 通过。
- `pnpm build:rsbuild` 可作为根级 POC 聚合构建入口。
- 临时端口 dev smoke 通过：Shell 根路径返回 200，React/Vue remote 的 `remoteEntry.js` 返回 200。
- 使用浏览器式 `Accept: text/html` 请求时，Shell `/react/` 和 `/vue/` 子路由可以回退到 HTML。
- `pnpm test` 通过。
- `pnpm lint` 通过。

## 已知差异

- Rsbuild dev server 对 history fallback 的行为依赖请求的 `Accept` 头。普通脚本请求 `/react/` 或 `/vue/` 且不带 HTML Accept 时会返回 404；浏览器访问会正常回退。
- Rsbuild 默认按入口名生成页面路由。POC 将入口名固定为 `index`，并将 HTML 输出固定为 `index.html`，避免页面挂在 `/main`。
- 当前配置使用 `resolve.aliasStrategy: "prefer-alias"`。这是为了避免 Rsbuild 读取 workspace tsconfig paths 时，把 `@federlet/tsconfig` 的继承路径误解析到应用的 `node_modules` 下。
- `@federlet/rsbuild-config` 显式依赖 `@rspack/core@^1.7.11`，用于让 Rsbuild 1.x、Vue 插件和 Module Federation 插件的 peer 解析稳定落到 Rspack 1.x。

## 后续建议

短期建议继续保留 Rspack 默认脚本，将 Rsbuild 作为并行验证路径。若后续要完整迁移，可以按以下顺序推进：

1. 在 CI 中增加 `pnpm build:rsbuild` 验证任务。
2. 用浏览器自动化补一条 Shell 加载 React/Vue remote 的端到端 smoke。
3. 统一 Node.js 基线后，再评估是否升级到 Rsbuild 2.x 和 Module Federation 2.x。
4. 验证稳定后，将默认 `dev` / `build` 切到 Rsbuild，再清理 Rspack 配置和文档中的默认路径。
