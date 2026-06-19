import type {
  FederletEventListener,
  FederletEventMeta,
  FederletEventPayloadValidator,
  MicroEventBus,
} from "@federlet/shared-types";

type Listener = FederletEventListener<unknown>;

export interface EventBusInvalidEvent {
  eventName: string;
  payload: unknown;
  reason: "invalid-event-name" | "invalid-payload";
}

export interface EventBusAuditEvent {
  eventName: string;
  meta: FederletEventMeta;
  payload: unknown;
}

export interface CreateEventBusOptions {
  /**
   * 可选 payload 运行时校验器。类型约束由 TypeScript 提供，运行时校验由 Shell 按需注入。
   */
  validatePayload?: FederletEventPayloadValidator;
  /** 事件被治理规则拒绝时的回调，便于测试或接入开发期告警。 */
  onInvalidEvent?: (event: EventBusInvalidEvent) => void;
  /** 每次成功派发事件后的审计回调。 */
  onAuditEvent?: (event: EventBusAuditEvent) => void;
  /** 注入时间源，测试时可固定 timestamp。 */
  now?: () => number;
}

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*\.[a-z][a-z0-9]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export const validateFederletEventPayload: FederletEventPayloadValidator = (
  eventName,
  payload,
) => {
  if (
    eventName === "remote.lifecycle.mounted" ||
    eventName === "remote.lifecycle.unmounted"
  ) {
    return (
      isRecord(payload) &&
      typeof payload.basename === "string" &&
      typeof payload.remoteName === "string"
    );
  }

  if (eventName === "auth.session.updated") {
    return (
      isRecord(payload) &&
      (typeof payload.userId === "string" || payload.userId === null) &&
      typeof payload.isAuthenticated === "boolean" &&
      (payload.roles === undefined || isStringArray(payload.roles))
    );
  }

  return true;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isValidEventName(eventName: string) {
  return EVENT_NAME_PATTERN.test(eventName);
}

function reportInvalidEvent(
  event: EventBusInvalidEvent,
  options: CreateEventBusOptions,
) {
  options.onInvalidEvent?.(event);

  const message =
    event.reason === "invalid-event-name"
      ? `Invalid event name ${event.eventName}`
      : `Invalid payload for event ${event.eventName}`;

  if (!isProduction()) {
    throw new Error(message);
  }

  console.warn(message, event);
}

/**
 * 创建一个进程内事件总线。
 *
 * Shell 可以把它放进 `MicroAppContext`，让多个 remote 通过事件通信，
 * 同时仍然保持应用之间没有直接代码依赖。
 */
export function createEventBus(
  options: CreateEventBusOptions = {},
): MicroEventBus {
  const listeners = new Map<string, Set<Listener>>();
  const now = options.now ?? Date.now;

  const eventBus = {
    emit(
      eventName: string,
      payload: unknown,
      meta: FederletEventMeta = {},
    ) {
      if (!isValidEventName(eventName)) {
        reportInvalidEvent(
          {
            eventName,
            payload,
            reason: "invalid-event-name",
          },
          options,
        );
        return;
      }

      if (
        options.validatePayload &&
        !options.validatePayload(eventName, payload)
      ) {
        reportInvalidEvent(
          {
            eventName,
            payload,
            reason: "invalid-payload",
          },
          options,
        );
        return;
      }

      const eventMeta: FederletEventMeta = {
        ...meta,
        timestamp: meta.timestamp ?? now(),
      };

      listeners
        .get(eventName)
        ?.forEach((listener) => listener(payload, eventMeta));

      options.onAuditEvent?.({
        eventName,
        meta: eventMeta,
        payload,
      });
    },
    on(eventName: string, listener: Listener) {
      const eventListeners = listeners.get(eventName) ?? new Set<Listener>();
      eventListeners.add(listener as Listener);
      listeners.set(eventName, eventListeners);

      // 返回取消订阅函数，便于 remote 卸载时清理自己的监听器。
      return () => {
        eventListeners.delete(listener as Listener);

        if (eventListeners.size === 0) {
          listeners.delete(eventName);
        }
      };
    },
  };

  return eventBus as MicroEventBus;
}
