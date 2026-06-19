import type { MicroAppContext } from "@federlet/shared-types";

export function createRemoteEventBusLifecycle(
  context: MicroAppContext,
  remoteName: string,
) {
  // 取消订阅 auth.session.updated 事件。
  let unsubscribeAuthSession: (() => void) | undefined;

  /**
   * 清理资源。
   */
  function cleanup() {
    unsubscribeAuthSession?.();
    unsubscribeAuthSession = undefined;
  }

  /**
   * 通知 Shell 应用 remote 已挂载。
   */
  function notifyMounted() {
    // 订阅 auth.session.updated 事件，返回取消订阅函数。
    unsubscribeAuthSession = context.eventBus?.on(
      "auth.session.updated",
      (payload, meta) => {
        console.info(
          `${remoteName} received auth.session.updated`,
          payload,
          meta,
        );
      },
    );

    try {
      // 通知 Shell 应用 remote 已挂载。
      context.eventBus?.emit(
        "remote.lifecycle.mounted",
        {
          basename: context.basename,
          remoteName,
        },
        {
          source: remoteName,
        },
      );
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  /**
   * 通知 Shell 应用 remote 已卸载。
   */
  function notifyUnmounted() {
    context.eventBus?.emit(
      "remote.lifecycle.unmounted",
      {
        basename: context.basename,
        remoteName,
      },
      {
        source: remoteName,
      },
    );
  }

  return {
    cleanup,
    notifyMounted,
    notifyUnmounted,
  };
}
