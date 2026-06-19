import mitt from "mitt";
import type {
  FederletEventListener,
  FederletEventMeta,
  FederletEventPayloadValidator,
  MicroEventBus,
} from "@federlet/shared-types";

/**
 * 事件总线监听器。
 */
type Listener = FederletEventListener<unknown>;

/**
 * 事件总线传输事件。
 */
type EventBusTransportEvent = {
  meta: FederletEventMeta;
  payload: unknown;
};
type EventBusTransportEvents = Record<string, EventBusTransportEvent>;

/**
 * 事件总线无效事件。
 */
export interface EventBusInvalidEvent {
  eventName: string;
  payload: unknown;
  reason: "invalid-event-name" | "invalid-payload";
}

/**
 * 事件总线审计事件。
 */
export interface EventBusAuditEvent {
  eventName: string;
  meta: FederletEventMeta;
  payload: unknown;
}

/**
 * 创建事件总线选项。
 */
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

/**
 * 事件名称模式。
 */
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*\.[a-z][a-z0-9]*$/;

/**
 * 是否为记录类型。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 是否为字符串数组。
 */
function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * 验证联邦事件负载。
 */
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

/**
 * 是否为生产环境。
 */
function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * 是否为有效事件名称。
 */
function isValidEventName(eventName: string) {
  return EVENT_NAME_PATTERN.test(eventName);
}

/**
 * 报告无效事件。
 */
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
  const transport = mitt<EventBusTransportEvents>();
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

      transport.emit(eventName, {
        meta: eventMeta,
        payload,
      });

      options.onAuditEvent?.({
        eventName,
        meta: eventMeta,
        payload,
      });
    },
    on(eventName: string, listener: Listener) {
      const handler = (event: EventBusTransportEvent) => {
        listener(event.payload, event.meta);
      };

      transport.on(eventName, handler);

      // 返回取消订阅函数，便于 remote 卸载时清理自己的监听器。
      return () => {
        transport.off(eventName, handler);
      };
    },
  };

  return eventBus as MicroEventBus;
}
