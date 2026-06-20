# Federlet Roadmap

本 roadmap 基于当前代码状态，并参考主流微前端框架的能力演进路径整理：

- `single-spa`：生命周期协议和应用编排。
- `qiankun`、`micro-app`、`wujie`：运行时治理、隔离、降级和本地联调体验。
- `Module Federation`：远程模块加载、依赖共享、构建时集成和版本治理。
- 生产级微前端平台：发布、灰度、监控、回滚和跨团队治理。

## 阶段一：最小可运行闭环

- [x] Monorepo：使用 `pnpm workspace` 管理多应用和共享包。
- [x] 构建编排：使用 `Turbo` 管理 `dev`、`build`、`test`、`lint`、`typecheck`。
- [x] 默认构建链路：基于 `Rspack + Module Federation`。
- [x] Shell 主应用：React Shell，负责布局、导航、路由和 remote 挂载。
- [x] React Remote：支持独立运行和被 Shell 挂载。
- [x] Vue Remote：支持独立运行和被 Shell 挂载。
- [x] Umi 3 React Remote：兼容旧 React 17 项目接入。
- [x] 统一生命周期协议：remote 暴露 `mount(context)`，返回 `unmount()`。
- [x] 基础运行时包：`@federlet/mf-runtime`。
- [x] 共享类型包：`@federlet/shared-types`。
- [x] 共享构建配置包：`@federlet/rspack-config`。
- [x] Shell 加载态和错误态。
- [x] 子路由 basename 适配。
- [x] remote 卸载清理。
- [x] 基础单元测试。
- [x] 阶段一架构文档。

## 阶段一补强：让 MVP 更可靠

- [ ] 补 E2E smoke：验证 Shell 能加载 React、Vue、Umi remote。
- [ ] 补子路由刷新测试：`/react`、`/vue`、`/umi` 刷新不白屏。
- [ ] 补 remote 不可用降级测试：remoteEntry 失败时 Shell 显示错误态和重试。
- [ ] 补 remote 契约测试：每个 remote 必须导出合法 `mount` 并返回 `unmount`。
- [ ] 补 CI 验证：运行 `pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm lint`。
- [ ] 同步阶段一文档：把 Umi、Vite、Rsbuild、Webpack POC 状态写进架构文档。
- [ ] 给 Shell 和 remote 补 favicon，减少无关控制台噪音。

## 阶段二：多构建器兼容与迁移策略

- [x] Vite。
- [x] Rsbuild。
- [x] Webpack。
- [x] 根级 `dev:vite` / `build:vite`。
- [x] 根级 `dev:rsbuild` / `build:rsbuild`。
- [x] 根级 `dev:webpack` / `build:webpack`。
- [ ] 在 CI 中加入 `build:vite`。
- [ ] 在 CI 中加入 `build:rsbuild`。
- [ ] 在 CI 中加入 `build:webpack`。
- [ ] 明确默认构建器长期策略：继续 Rspack，还是迁移 Rsbuild、Webpack 或 Vite。
- [ ] 建立构建器兼容矩阵：React、Vue、Umi 在各构建器下的支持状态。
- [ ] 抽象 remote 配置结构，减少不同构建器配置重复。
- [ ] 评估 Node.js 基线升级到 Node 20+，为新版 Rsbuild、Rspack、Vitest 做准备。

## 阶段三：运行时治理

- [x] 动态 remote manifest：Shell 不再写死 remoteEntry URL。
- [x] 环境化 remote 地址（部分完成）：当前由 Apollo 集群隔离环境配置，Shell 本地维护默认 Apollo 配置注入。
- [x] remote 版本治理：声明 Shell 与 remote 的协议版本兼容关系。
- [x] remote 注册中心：Apollo manifest 集中维护 remote 名称、入口、路由和状态，`@federlet/mf-runtime` 提供运行时 registry 统一管理 remote 元数据与 health 状态。
- [x] remote 加载超时控制。
- [x] remote 加载失败重试策略。
- [x] remote 熔断和降级策略。
- [x] remote 预加载：进入页面前提前加载 remoteEntry 或关键 chunk。
- [x] remote 资源缓存策略：remoteEntry 短缓存，chunk 长缓存。
- [x] 跨应用事件总线规范化：已定义 `domain.topic.action` 事件命名、`FederletEventMap` payload 类型、运行时 payload 校验、审计 meta 和 remote 订阅生命周期规范。
- [x] 全局错误边界：RemoteAppBoundary 统一处理加载、mount 和 remote 渲染期异常。

## 阶段四：样式、隔离与安全

- [x] 样式隔离策略：先选 CSS Modules、命名空间、Shadow DOM 或约定式隔离。
- [x] 全局样式污染检测。
- [x] remote DOM 容器隔离规范：见 `docs/remote-dom-container-isolation.md`。
- [ ] JS 运行时隔离/沙箱策略：明确是否采用快照沙箱、Proxy 沙箱、iframe 沙箱或无沙箱约束。
- [ ] remote 全局副作用治理：限制 `window`、`document`、全局事件、定时器、存储等资源使用和清理。
- [ ] 第三方依赖共享白名单。
- [x] React、Vue singleton 策略文档化：见 `docs/shared-runtime-strategy.md`。
- [x] 老项目兼容策略：例如 Umi React 17 不共享 React runtime，见 `docs/shared-runtime-strategy.md`。
- [ ] 权限模型：Shell 统一下发用户、权限、租户等上下文。
- [ ] remote 权限边界：remote 不直接读取全局敏感状态。
- [ ] CSP 和脚本来源治理。
- [ ] remote 加载来源校验。

## 阶段五：开发者体验

- [ ] 新建 remote 模板：React、Vue、Umi/legacy。
- [ ] 接入脚手架 CLI：`create remote`、`register remote`。
- [ ] 本地联调命令：只启动 Shell + 指定 remote。
- [ ] remote 接入指南升级为标准 checklist。
- [ ] 构建器选择指南：Rspack、Vite、Rsbuild、Webpack 适用场景。
- [ ] 统一日志格式。
- [ ] 本地调试面板：显示已注册 remote、加载状态、remoteEntry 地址。
- [ ] 类型生成策略：评估 Module Federation DTS 或手写契约包。
- [ ] 示例业务场景：dashboard、settings、reports 等跨 remote demo。

## 阶段六：生产化与平台能力

- [ ] 发布流水线：Shell 和 remote 独立构建、独立发布。
- [ ] 灰度发布：按用户、租户、比例切 remote 版本。
- [ ] 回滚机制：remote 版本可快速回退。
- [ ] 监控指标：remote 加载耗时、失败率、mount 耗时、unmount 异常。
- [ ] 错误监控接入：按 remote 维度聚合错误。
- [ ] 性能预算：remoteEntry 大小、首屏耗时、chunk 数量。
- [ ] 发布健康检查：remoteEntry 可访问、暴露模块存在、协议校验通过。
- [ ] 依赖版本治理：共享依赖冲突检测。
- [ ] 应用目录/门户：展示所有 remote、负责人、版本、环境、健康状态。
- [ ] 跨团队治理规范：命名、路由、发布、回滚、监控责任边界。

## 推荐近期优先级

当前优先推进阶段一补强，让框架从 POC 可运行进入团队可持续使用状态：

1. 补 E2E smoke，覆盖 Shell 加载 React、Vue、Umi remote。
2. 补 remote 契约测试，锁定 `mount/unmount` 协议。
3. 把核心命令接入 CI。
4. 同步阶段一文档，避免文档和实现脱节。
