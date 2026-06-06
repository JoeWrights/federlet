import type { MicroEventBus } from "@federlet/shared-types";

type Listener = (payload: unknown) => void;

/**
 * 创建一个进程内事件总线。
 *
 * Shell 可以把它放进 `MicroAppContext`，让多个 remote 通过事件通信，
 * 同时仍然保持应用之间没有直接代码依赖。
 */
export function createEventBus(): MicroEventBus {
  const listeners = new Map<string, Set<Listener>>();

  return {
    emit(eventName, payload) {
      listeners.get(eventName)?.forEach((listener) => listener(payload));
    },
    on(eventName, listener) {
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
}
