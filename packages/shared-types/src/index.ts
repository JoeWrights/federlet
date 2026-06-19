/**
 * Shell 与 remote 之间可选的轻量事件总线。
 *
 * 用于跨微应用传递简单事件，避免业务应用之间直接互相 import。
 */
export interface MicroEventBus {
  /** 发布一个事件，并把 payload 传给当前所有监听器。 */
  emit<TPayload = unknown>(eventName: string, payload: TPayload): void;

  /**
   * 订阅一个事件。
   *
   * @returns 取消订阅函数，Shell 或 remote 卸载时应调用它清理监听器。
   */
  on<TPayload = unknown>(
    eventName: string,
    listener: (payload: TPayload) => void,
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

}

/**
 * manifest 中声明的单个 remote。
 */
export interface RuntimeRemoteManifestItem
  extends Omit<RemoteRouteConfig, "exposedModule"> {
  /** remote 暴露模块名，默认约定为 `./mount`。 */
  exposedModule?: string;

  /** remoteEntry.js 的完整访问地址，可以包含版本查询参数。 */
  entry?: string;

  /** remote 站点根地址，运行时会拼接 remoteEntry 文件名和版本参数。 */
  entryBaseUrl?: string;

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
 * Shell 内部使用的动态 remote 定义。
 */
export interface RuntimeRemoteRouteConfig extends RemoteRouteConfig {
  /** 用于动态注册 Module Federation remote 的 remoteEntry 地址。 */
  entry: string;
}

/**
 * Module Federation 加载出来的 remote 模块形状。
 */
export interface RemoteMountModule {
  mount: MicroAppMount;
}
