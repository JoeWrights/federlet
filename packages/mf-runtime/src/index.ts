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
  createRemoteDebugSnapshot,
  type RemoteDebugSnapshot,
  type RemoteDebugSnapshotItem,
} from "./debug";
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
  RemoteSourcePolicyError,
  assertRemoteEntrySourceAllowed,
  validateRemoteEntrySource,
  type RemoteSourcePolicyErrorCode,
  type RemoteSourcePolicyValidationResult,
} from "./remote-source-policy";
export {
  registerRuntimeRemoteEntries,
  type RegisterRuntimeRemoteEntriesOptions,
  type RuntimeRemoteEntry,
} from "./runtime-remotes";
export {
  bootstrapRuntimeRemoteRegistry,
  createRemoteDefinitionsFromManifest,
  createRuntimeRemoteRegistry,
  runtimeRemoteRegistry,
  type BootstrapRuntimeRemoteRegistryOptions,
  type RuntimeRemoteDefinition,
  type RuntimeRemoteHealth,
  type RuntimeRemoteHealthPatch,
  type RuntimeRemoteLoadHealth,
  type RuntimeRemoteRecord,
  type RuntimeRemoteRegistry,
  type RuntimeRemoteRegistrationStatus,
} from "./remote-registry";
export {
  createFederletLogger,
  federletLogger,
  type FederletLogger,
  type FederletLogEvent,
  type FederletLogLevel,
} from "./logger";
