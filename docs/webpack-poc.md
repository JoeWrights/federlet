# Webpack 并行 POC 结果

## 结论

Webpack 可以作为当前微前端架构的并行构建 POC 接入。当前实现保留默认 Rspack 脚本和 `@federlet/rspack-config`，新增 `@federlet/webpack-config` 与各应用的 `webpack.config.ts`，用于独立验证 Webpack dev/build 行为。

POC 推荐继续保留并行状态一段时间，再决定是否将默认 `dev` / `build` 切换到 Webpack 或继续维持 Rspack 默认路径。

## 接入范围

- 新增 `packages/webpack-config`，提供 `createReactHostConfig`、`createReactRemoteConfig`、`createVueRemoteConfig`。
- 新增 3 个应用的 `webpack.config.ts`，参数与原 `rspack.config.ts` 对齐。
- 新增根级和应用级 `dev:webpack` / `build:webpack` 脚本，不影响现有 `dev` 和 `build`。
- 使用 `@module-federation/enhanced/webpack` 接入 enhanced Module Federation，保留 `remoteEntry.js`、`dts: false` 和 `manifest: false`。

## 版本选择

当前 POC 使用 `webpack@5.105.4`。`@module-federation/enhanced@0.21.6` 的 Webpack 插件仍依赖 `webpack/lib/util/create-schema-validation`，该内部文件在 Webpack 5.106.0 起被移除。为保持 Module Federation 版本与现有 Rspack/Rsbuild 路径一致，Webpack 侧先固定在 5.105.4。

Webpack 配置包还显式依赖以下 Webpack 生态包：

- `webpack-cli`
- `webpack-dev-server`
- `html-webpack-plugin`
- `swc-loader` 与 `@swc/core`
- `style-loader` 与 `css-loader`
- `vue-loader`

## 验证结果

- `pnpm --filter @federlet/webpack-config test` 通过。
- `pnpm typecheck` 通过。
- `pnpm --filter @federlet/remote-react build:webpack` 通过，生成 `dist/remoteEntry.js`。
- `pnpm --filter @federlet/remote-vue build:webpack` 通过，生成 `dist/remoteEntry.js`。
- `pnpm --filter @federlet/shell-react build:webpack` 通过。
- `pnpm build:webpack` 可作为根级 POC 聚合构建入口。
- `pnpm test` 通过。
- `pnpm lint` 通过。

## 已知差异

- Webpack loader 从应用 `context` 解析。`@federlet/webpack-config` 将 `swc-loader`、`style-loader`、`css-loader` 和 `vue-loader` 解析为绝对路径，避免每个应用重复声明 loader 依赖。
- `@module-federation/enhanced/webpack` 会在构建阶段预检查 `exposes`。配置工厂将 exposed module 路径解析为绝对路径，避免相对路径在应用侧构建时被判定为找不到模块。
- 应用级 `dev:webpack` 显式传 `--mode development`，`build:webpack` 显式传 `--mode production`，避免 Webpack 使用默认 mode 并输出警告。
- React/Vue remote 的 `test` 脚本显式加载 `tsx` loader。Vitest 会读取现有 `vite.config.ts`，该配置会直接引用 workspace 内的 TypeScript 配置包。
- `apps/remote-umi-react` 继续使用 Umi 自带 Webpack 配置，不纳入本次 `@federlet/webpack-config` POC。

## 后续建议

短期建议继续保留 Rspack 默认脚本，将 Webpack 作为并行验证路径。若后续要完整迁移，可以按以下顺序推进：

1. 用浏览器自动化补一条 Shell 加载 React/Vue remote 的端到端 smoke。
2. 关注 `@module-federation/enhanced` 对 Webpack 5.106+ 的兼容版本，验证后再解除 `webpack@5.105.4` 固定。
3. 在 CI 中增加 `pnpm build:webpack` 验证任务。
4. 验证稳定后，再决定是否将默认 `dev` / `build` 切到 Webpack。
