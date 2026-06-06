/**
 * mf-runtime 对外入口。
 *
 * Shell 侧只需要从这里消费 remote 加载、挂载和事件总线能力。
 */
export { createEventBus } from "./event-bus";
export {
  defaultRemoteLoader,
  mountRemoteApp,
  normalizeExposedModule,
  type RemoteModuleLoader,
} from "./loader";
