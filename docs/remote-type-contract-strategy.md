# Remote 类型契约生成策略

## 背景

Federlet 的 Shell 不在构建时写死 remote 地址，而是在启动时读取运行时 manifest，再把 remoteEntry 注册到 Module Federation runtime。这个架构让 remote 可以独立发布、按环境切换和按策略禁用，但也带来一个类型问题：Shell 在编译期并不知道未来会加载哪些 remote，也无法通过普通静态 import 获得 remote 暴露模块的类型。

ROADMAP 中的“类型生成策略”要解决的是：Shell 与 remote 之间的 TypeScript 边界应该由 Module Federation 自动生成 DTS，还是由 Federlet 维护一套手写契约包。

这份文档只做策略评估和推荐，不展开具体改造步骤。

## 当前基线

当前项目已经有一套稳定的手写契约包：`@federlet/shared-types`。它定义了 Shell 与 remote 的核心协议：

- `MicroAppContext`：Shell 挂载 remote 时注入的上下文，包括 `basename`、`container`、`props`、`eventBus` 和 `onError`。
- `MicroAppInstance` 与 `MicroAppMount`：remote 必须实现的挂载/卸载生命周期。
- `RemoteMountModule`：Module Federation 加载出来的暴露模块形状，目前要求包含 `mount` 函数。
- `RemoteRouteConfig`、`RuntimeRemoteManifest` 和 `RuntimeRemoteManifestItem`：Shell 路由与运行时 manifest 的数据契约。
- `FederletEventMap` 与 `MicroEventBus`：跨应用事件总线的类型契约。

构建侧当前没有启用 Module Federation DTS。Rspack、Vite、Webpack 和 Rsbuild 的共享配置里都显式设置了 `dts: false`，同时 Shell 的 `remotes` 为空，由运行时 manifest 完成注册。

加载侧由 `@federlet/mf-runtime` 调用 `loadRemote<RemoteMountModule>()`，并在真正挂载前校验远程模块是否导出了 `mount` 函数。也就是说，当前类型安全主要来自共享契约包和运行时协议校验，而不是 remote 构建产物自动生成的 DTS。

## 类型边界

类型策略需要先区分两类边界。

第一类是 Federlet 框架协议契约。这些类型描述 Shell 与 remote 如何协作，包括 `mount(context)` 的签名、卸载句柄、manifest 结构、协议版本、事件总线和来源治理策略。它们不是某个 remote 暴露模块的自然产物，而是 Federlet 平台主动设计出来的稳定 API。这类契约应该继续由手写共享包维护。

第二类是 Module Federation 暴露模块类型。这些类型描述某个 remote 通过 `exposes` 暴露了哪些模块，以及每个模块具体导出了什么。当前 Federlet 对 Shell 只约定统一入口 `./mount`，因此这层类型很薄；如果未来出现 remote-to-remote 的业务模块复用，例如某个 remote 暴露 `./widgets`、`./charts`、`./settings-panel` 给其他 remote 使用，自动 DTS 的价值会明显上升。

这两类边界不能混为一谈。MF DTS 可以补充“某个 remote 暴露了什么”，但不能替代“Federlet 允许 remote 如何接入 Shell”的平台协议。

## 方案一：Module Federation DTS

Module Federation DTS 的目标是让 remote 在构建时产出 `.d.ts`，让其他 remote 或明确声明的消费者在开发期获得类似静态 import 的类型提示。

它的主要收益是编译期体验更接近普通包依赖：remote 新增、删除或修改暴露模块后，类型声明可以随构建产物一起更新；消费方在调用 `remoteName/exposedModule` 时可以发现导出名称和签名错误；当 remote 之间开始复用多个业务组件或工具模块时，手写声明的维护成本会下降。

它的限制也很明确。Federlet 当前采用运行时 manifest 注册，Shell 的 remote 列表不是构建期固定输入；而 MF DTS 通常更适合构建时已知 remotes 的场景。即使启用 DTS，也需要额外回答类型如何分发、消费方 CI 何时拉取、跨环境 remote 版本不一致时以哪个类型为准等问题。

在多构建器场景下还需要逐一验证插件行为。Federlet 同时保留 Rspack、Vite、Webpack、Rsbuild 和 Umi/legacy remote 的 POC 路线，DTS 生成和消费能力不一定在这些构建器之间完全一致。贸然把 DTS 设为主路径，会让开发者体验能力绑定到构建器细节上。

因此，MF DTS 适合作为后续增强能力，而不适合作为当前唯一契约来源。

## 方案二：手写契约包

手写契约包以 `@federlet/shared-types` 作为 Shell、remote 和运行时包共同依赖的 SSOT。它把接入 Federlet 所需遵守的协议显式写出来，并通过包版本管理契约演进。

这个方案与当前架构天然匹配。Shell 可以继续运行时注册 remote，不需要在构建时知道所有 remote；remote 只要依赖同一份 `shared-types`，就能实现 `MicroAppMount` 并接收稳定的 `MicroAppContext`；运行时也可以使用同一组类型做 manifest 标准化、协议版本过滤和加载前校验。

手写契约包的另一个优势是治理边界清晰。`MicroAppContext.props`、事件总线、自定义事件、manifest 元数据和协议版本都属于平台层约定，需要文档、测试和版本策略，而不是由每个 remote 的构建产物隐式决定。

它的缺点是不会自动反映每个 remote 的私有暴露面。如果未来 remote 之间需要复用多个业务组件，就需要继续手写扩展类型、增加 per-remote 契约包，或引入 MF DTS 作为补充。

当前仓库还暴露出一个维护风险：`packages/shared-types/src/index.ts` 比同目录下的 `index.d.ts` 更新，后者缺少部分较新的 manifest、runtime env 和来源治理类型。既然手写契约包是当前主路径，就应确保声明产物与源码保持同步。

## 推荐结论

当前阶段推荐采用“手写契约包为主，MF DTS 暂缓”的策略。

原因有三点：

1. Federlet 的核心边界是运行时 manifest 注册和统一 `./mount` 生命周期协议，不是构建期静态 remote import。
2. `MicroAppContext`、`MicroAppMount`、manifest、事件总线、协议版本和来源治理都属于平台协议，必须由 `@federlet/shared-types` 明确维护。
3. 当前 remote 暴露面很小，只有统一挂载入口；启用 MF DTS 的收益有限，但会增加多构建器验证、类型分发和版本对齐成本。

MF DTS 不应被排除，但应作为后续 POC 条件触发：

- remote 开始向其他 remote 暴露多个业务组件或工具模块，消费方需要这些模块的具体导出类型。
- remote 逐步拆出 monorepo，类型不能再天然通过 workspace 依赖共享。
- 团队希望把 remote 暴露面当作独立 npm 包一样消费，并愿意在 CI 中引入类型产物拉取和版本校验。

在这些条件出现前，类型策略应保持简单：平台协议进 `@federlet/shared-types`，remote 内部实现和内部路由保持私有，Shell 只依赖统一挂载契约。

## 治理规则

以下类型必须进入 `@federlet/shared-types`：

- Shell 调用 remote 所需的生命周期类型，例如 `MicroAppContext`、`MicroAppInstance`、`MicroAppMount` 和 `RemoteMountModule`。
- Shell 运行时治理需要读取或校验的数据结构，例如 `RuntimeRemoteManifest`、`RuntimeRemoteManifestItem`、`RemoteSourcePolicy` 和 `RemoteEntryType`。
- 跨应用通信协议，例如内置事件名、事件 payload、事件 meta 和 `MicroEventBus`。
- 会影响兼容性的协议字段，例如 `supportedShellProtocolVersions`。

以下类型不应默认泄漏给 Shell：

- remote 内部页面路由、页面组件 props、局部状态和框架实例类型。
- 只服务于某个 remote 内部实现的 helper 类型。
- 尚未被 Shell 或其他 remote 直接消费的业务模块导出类型。

如果某个 remote 确实需要向其他 remote 暴露业务组件，应优先判断它是否已经成为平台协议的一部分。属于平台协议的类型进入 `@federlet/shared-types`；只属于单个业务 remote 的类型可以通过 per-remote 契约包或未来 MF DTS POC 解决。Shell 默认不消费这些业务组件，只消费统一的 `./mount` 接入协议。

`MicroAppContext.props` 仍应保持保守。通用字段可以升级为共享契约；只属于某个 remote 的字段，应由该 remote 在本地收窄并在运行时校验，避免把每个业务 remote 的私有参数都塞进平台类型。

## 协议版本

`supportedShellProtocolVersions` 是运行时兼容控制，不是 DTS 可以自动推导出来的类型。只要 `MicroAppContext`、`MicroAppMount`、manifest 结构或生命周期语义发生破坏性变化，就应该考虑提升 Shell remote 协议版本。

协议版本治理应遵循两条规则：

- 类型兼容不等于协议兼容。TypeScript 能通过，只代表结构匹配；语义变化仍需要版本标识和运行时过滤。
- 运行时配置不等于可信输入。manifest 来自 Apollo 或发布流水线注入，仍需要结构校验、协议版本过滤和 remoteEntry 来源校验。

## 后续观察点

短期应优先修正并固化手写契约包：

- 确保 `packages/shared-types/src/index.d.ts` 与 `index.ts` 产物同步，避免消费者拿到过期声明。
- 保持 `event-bus-types.test-d.ts` 这类类型测试，覆盖内置事件、挂载协议和 manifest 关键字段。
- 在 remote 示例中继续显式使用 `MicroAppContext` 和 `MicroAppInstance`，让接入方复制模板时自动遵守协议。

中期可以为 MF DTS 建立小范围 POC，但 POC 不应替代共享契约包。验证重点包括：

- 在运行时 manifest + 构建期空 remotes 的架构下，remote-to-remote 如何稳定消费 DTS。
- Rspack、Vite、Webpack、Rsbuild 和 Umi/legacy remote 的 DTS 行为是否一致。
- 类型产物如何分发到消费方 CI，以及如何处理 remote 版本与类型版本不一致。
- DTS 是否只覆盖 remote 暴露模块，而不重新定义 Federlet 平台协议。

长期如果 Federlet 演进为多团队、多仓库 remote 平台，可以形成分层类型模型：

- `@federlet/shared-types` 继续作为平台协议 SSOT。
- per-remote 契约包描述单个 remote 的业务暴露面。
- MF DTS 用于辅助生成或校验 per-remote 暴露模块声明。

## 结论

Federlet 当前最重要的不是让 Shell 自动知道每个 remote 的内部类型，而是保证所有 remote 通过同一套稳定协议接入 Shell。手写契约包已经覆盖这个目标，并且更适合运行时 manifest 注册、多构建器并存和平台治理能力逐步增强的现状。

因此，ROADMAP 第 93 行的评估结论是：当前阶段继续以 `@federlet/shared-types` 作为唯一权威类型契约；暂不启用 Module Federation DTS 作为默认策略；未来在 remote 暴露面扩大或跨仓库类型分发需求明确后，再以补充能力的方式评估 MF DTS。
