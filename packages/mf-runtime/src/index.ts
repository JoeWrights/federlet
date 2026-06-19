/**
 * mf-runtime 对外入口。
 *
 * Shell 侧只需要从这里消费 remote 加载、挂载和事件总线能力。
 */
export {
  createEventBus,
  validateFederletEventPayload,
  type CreateEventBusOptions,
  type EventBusAuditEvent,
  type EventBusInvalidEvent,
} from "./event-bus";
export {
  createCircuitBreakerStore,
  defaultRemoteLoader,
  mountRemoteApp,
  normalizeExposedModule,
  preloadRemoteApp,
  RemoteLoadError,
  RemoteLoadErrorCode,
  type RemoteCircuitBreakerOptions,
  type RemoteCircuitBreakerStore,
  type RemoteCircuitSnapshot,
  type RemoteCircuitStatus,
  type RemoteLoadOptions,
  type RemoteModuleLoader,
  type RemoteRetryOptions,
} from "./loader";
export {
  registerRuntimeRemoteEntries,
  type RuntimeRemoteEntry,
} from "./runtime-remotes";
