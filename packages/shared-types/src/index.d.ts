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
export type FederletEventNameInput = FederletEventName | FederletCustomEventName;
export interface FederletEventMeta {
    /** 事件发送方，例如 `shell-react`、`remote_react`。 */
    source?: string;
    /** 跨应用链路追踪 id，由 Shell 或业务侧按需生成。 */
    traceId?: string;
    /** 事件发送时间戳，由事件总线在派发时补齐。 */
    timestamp?: number;
}
export type FederletEventListener<TPayload = unknown> = (payload: TPayload, meta: FederletEventMeta) => void;
export type FederletEventPayloadValidator = (eventName: string, payload: unknown) => boolean;
/**
 * Shell 与 remote 之间可选的轻量事件总线。
 *
 * 用于跨微应用传递简单事件，避免业务应用之间直接互相 import。
 */
export interface MicroEventBus {
    /** 发布事件。内置事件会按事件名约束 payload，业务扩展事件使用 unknown payload。 */
    emit<TEventName extends FederletEventNameInput>(eventName: TEventName, payload: TEventName extends FederletEventName ? FederletEventMap[TEventName] : unknown, meta?: FederletEventMeta): void;
    /**
     * 订阅事件。内置事件会按事件名约束 payload，业务扩展事件使用 unknown payload。
     *
     * @returns 取消订阅函数，Shell 或 remote 卸载时应调用它清理监听器。
     */
    on<TEventName extends FederletEventNameInput>(eventName: TEventName, listener: FederletEventListener<TEventName extends FederletEventName ? FederletEventMap[TEventName] : unknown>): () => void;
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
    /** remote 渲染期或框架生命周期异常上报给 Shell 的回调。 */
    onError?: (error: unknown) => void;
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