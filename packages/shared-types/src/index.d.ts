/**
 * Shell 与 remote 之间可选的轻量事件总线。
 */
export interface MicroEventBus {
    /** 发布事件。 */
    emit<TPayload = unknown>(eventName: string, payload: TPayload): void;
    /** 订阅事件，并返回取消订阅函数。 */
    on<TPayload = unknown>(eventName: string, listener: (payload: TPayload) => void): () => void;
}
/**
 * Shell 挂载 remote 时注入的上下文。
 */
export interface MicroAppContext {
    /** remote 内部路由的基础路径。 */
    basename: string;
    /** remote 应用需要渲染到的 DOM 容器。 */
    container: HTMLElement;
    /** Shell 传给 remote 的扩展参数。 */
    props?: Record<string, unknown>;
    /** 可选的跨应用事件总线。 */
    eventBus?: MicroEventBus;
}
/**
 * remote 挂载后返回给 Shell 的实例句柄。
 */
export interface MicroAppInstance {
    /** 清理 remote 创建的框架实例和副作用。 */
    unmount(): void | Promise<void>;
}
/**
 * 每个 remote 必须导出的统一挂载函数签名。
 */
export type MicroAppMount = (context: MicroAppContext) => MicroAppInstance | Promise<MicroAppInstance>;
/**
 * Shell 维护的 remote 路由注册信息。
 */
export interface RemoteRouteConfig {
    /** Shell 内部使用的稳定路由 id。 */
    id: string;
    /** React Router 匹配路径。 */
    path: string;
    /** 展示在 Shell 菜单和标题中的名称。 */
    title: string;
    /** Module Federation 中注册的 remote 名称。 */
    remoteName: string;
    /** remote 暴露的模块名。 */
    exposedModule: string;
    /** 注入给 remote 路由系统的基础路径。 */
    basename: string;
}
/**
 * Module Federation 加载出来的 remote 模块形状。
 */
export interface RemoteMountModule {
    mount: MicroAppMount;
}
//# sourceMappingURL=index.d.ts.map