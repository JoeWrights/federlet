export interface RemoteLifecycleEventPayload {
  /** remote 内部路由的基础路径，例如 `/react` 或 `/vue`。 */
  basename: string;

  /** Module Federation 中注册的 remote 名称。 */
  remoteName: string;
}

export interface AuthSessionUpdatedEventPayload {
  /** 当前用户 id；退出登录时为 `null`。 */
  userId: string | null;

  /** 当前 Shell 会话是否已认证。 */
  isAuthenticated: boolean;

  /** Shell 下发给 remote 的角色集合。 */
  roles?: string[];
}

export interface FederletEventMap {
  "auth.session.updated": AuthSessionUpdatedEventPayload;
  "remote.lifecycle.mounted": RemoteLifecycleEventPayload;
  "remote.lifecycle.unmounted": RemoteLifecycleEventPayload;
}

export type FederletEventName = keyof FederletEventMap;

export type FederletCustomEventName = string & {};

export type FederletEventNameInput =
  | FederletEventName
  | FederletCustomEventName;

export interface FederletEventMeta {
  /** 事件发送方，例如 `shell-react`、`remote_react`。 */
  source?: string;

  /** 跨应用链路追踪 id，由 Shell 或业务侧按需生成。 */
  traceId?: string;

  /** 事件发送时间戳，由事件总线在派发时补齐。 */
  timestamp?: number;
}

export type FederletEventListener<TPayload = unknown> = (
  payload: TPayload,
  meta: FederletEventMeta,
) => void;

export type FederletEventPayloadValidator = (
  eventName: string,
  payload: unknown,
) => boolean;

/**
 * Shell 与 remote 之间可选的轻量事件总线。
 *
 * 用于跨微应用传递简单事件，避免业务应用之间直接互相 import。
 */
export interface MicroEventBus {
  /** 发布事件。内置事件会按事件名约束 payload，业务扩展事件使用 unknown payload。 */
  emit<TEventName extends FederletEventNameInput>(
    eventName: TEventName,
    payload: TEventName extends FederletEventName
      ? FederletEventMap[TEventName]
      : unknown,
    meta?: FederletEventMeta,
  ): void;

  /**
   * 订阅事件。内置事件会按事件名约束 payload，业务扩展事件使用 unknown payload。
   *
   * @returns 取消订阅函数，Shell 或 remote 卸载时应调用它清理监听器。
   */
  on<TEventName extends FederletEventNameInput>(
    eventName: TEventName,
    listener: FederletEventListener<
      TEventName extends FederletEventName
        ? FederletEventMap[TEventName]
        : unknown
    >,
  ): () => void;
}

/**
 * Shell 挂载 remote 时注入的上下文。
 */
export interface MicroAppContext {
  /** remote 内部路由的基础路径，例如 `/react` 或 `/vue`。 */
  basename: string;

  /** remote 应用需要渲染到的 DOM 容器。 */
  container: HTMLElement;

  /** Shell 传给 remote 的扩展参数，业务侧可按需约定字段。 */
  props?: Record<string, unknown>;

  /** 可选的跨应用事件总线。 */
  eventBus?: MicroEventBus;

  /** remote 渲染期或框架生命周期异常上报给 Shell 的回调。 */
  onError?: (error: unknown) => void;
}

/**
 * remote 挂载后返回给 Shell 的实例句柄。
 */
export interface MicroAppInstance {
  /** 清理 remote 创建的框架实例、路由监听和其他副作用。 */
  unmount(): void | Promise<void>;
}

/**
 * 每个 remote 必须从暴露模块中导出的统一挂载函数签名。
 */
export type MicroAppMount = (
  context: MicroAppContext,
) => MicroAppInstance | Promise<MicroAppInstance>;

/**
 * Shell 维护的 remote 路由注册信息。
 */
export interface RemoteRouteConfig {
  /** Shell 内部使用的稳定路由 id。 */
  id: string;

  /** React Router 匹配路径，通常带 `/*` 交给 remote 处理子路由。 */
  path: string;

  /** 展示在 Shell 菜单和标题中的名称。 */
  title: string;

  /** Module Federation 中注册的 remote 名称。 */
  remoteName: string;

  /** remote 暴露的模块名，例如 `./mount`。 */
  exposedModule: string;

  /** 注入给 remote 路由系统的基础路径。 */
  basename: string;
}

/**
 * Shell 运行时环境配置，由发布流水线从 Apollo 配置中心读取后注入。
 */
export interface FederletRuntimeEnvironment {
  /** 当前运行环境，例如 `local`、`test`、`staging` 或 `prod`。 */
  runtimeEnv?: string;

  /** Apollo 直接注入的 remote manifest。 */
  manifest?: RuntimeRemoteManifest;

  /** remoteEntry 来源治理策略。 */
  remoteSourcePolicy?: RemoteSourcePolicy;
}

/**
 * remoteEntry 的运行时加载格式。
 */
export type RemoteEntryType = "module" | "var";

/**
 * remoteEntry 来源治理策略。
 */
export interface RemoteSourcePolicy {
  /** 允许加载 remoteEntry 的 origin，例如 `https://remote-cdn.example.com`。 */
  allowedOrigins?: string[];

  /** 允许加载的 remoteEntry 完整 URL，用于灰度、回滚或单版本白名单。 */
  allowedEntryUrls?: string[];

  /** 是否允许本地开发来源，例如 localhost、127.0.0.1 和 ::1。 */
  allowLocalhost?: boolean;

  /** 是否要求非本地 remoteEntry 使用 HTTPS。 */
  enforceHttps?: boolean;
}

/**
 * manifest 中声明的单个 remote。
 */
export interface RuntimeRemoteManifestItem
  extends Omit<RemoteRouteConfig, "exposedModule"> {
  /** remote 对外暴露的组件清单，用于其他 remote 或 Shell 发现可消费组件。 */
  components?: RemoteComponentManifestItem[];

  /** remote 暴露模块名，默认约定为 `./mount`。 */
  exposedModule?: string;

  /** remoteEntry.js 的完整访问地址，可以包含版本查询参数。 */
  entry?: string;

  /** remote 站点根地址，运行时会拼接 remoteEntry 文件名和版本参数。 */
  entryBaseUrl?: string;

  /** remoteEntry 的运行时加载格式；Vite remote 需要 `module`，webpack/Umi var remote 需要 `var`。 */
  remoteEntryType?: RemoteEntryType;

  /** var remote 挂载到全局对象上的名称。 */
  entryGlobalName?: string;

  /** remote 声明兼容的 Shell 挂载协议版本。 */
  supportedShellProtocolVersions?: string[];

  /** remote 当前是否允许被 Shell 加载。 */
  status?: "active" | "disabled";

  /** 运行时治理扩展元数据，后续用于版本、缓存、熔断等策略。 */
  meta?: Record<string, unknown>;
}

/**
 * Shell 启动时读取的 remote manifest。
 */
export interface RuntimeRemoteManifest {
  remotes: RuntimeRemoteManifestItem[];
}

/**
 * remote 暴露组件所属的运行时框架。
 */
export type RemoteComponentFramework = "react" | "vue" | "web-component" | "unknown";

/**
 * remote manifest 中声明的可消费组件。
 */
export interface RemoteComponentManifestItem {
  /** 面向消费方的稳定组件名称，在同一个 remote 内唯一。 */
  name: string;

  /** Module Federation 暴露模块名，例如 `./components/Button`。 */
  expose: string;

  /** 组件运行时框架，用于消费方判断是否能直接渲染。 */
  framework?: RemoteComponentFramework;

  /** 组件模块中的导出名；未声明时消费方通常使用 default export。 */
  exportName?: string;

  /** 组件契约版本，通常对应类型包或 props 协议的 semver 范围。 */
  contractVersion?: string;

  /** 提供组件 props/types 的 npm 或 workspace 包名。 */
  typePackage?: string;

  /** 面向开发者或组件目录展示的简短说明。 */
  description?: string;

  /** 业务扩展元数据，例如 owner、tags、designNodeId。 */
  meta?: Record<string, unknown>;
}

/**
 * runtime registry 展开的组件定义。
 */
export interface RuntimeRemoteComponent extends RemoteComponentManifestItem {
  /** Module Federation 中注册的 remote 名称。 */
  remoteName: string;

  /** Module Federation runtime 可直接加载的模块名，例如 `remote_ui/components/Button`。 */
  moduleName: string;
}

/**
 * Shell 内部使用的动态 remote 定义。
 */
export interface RuntimeRemoteRouteConfig extends RemoteRouteConfig {
  /** 用于动态注册 Module Federation remote 的 remoteEntry 地址。 */
  entry: string;

  /** remoteEntry 的运行时加载格式。 */
  remoteEntryType?: RemoteEntryType;

  /** var remote 挂载到全局对象上的名称。 */
  entryGlobalName?: string;
}

/**
 * Module Federation 加载出来的 remote 模块形状。
 */
export interface RemoteMountModule {
  mount: MicroAppMount;
}
