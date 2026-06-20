import type { MicroAppContext } from "@federlet/shared-types";

export function createRemoteEventBusLifecycle(
  context: MicroAppContext,
  remoteName: string,
) {
  let unsubscribeAuthSession: (() => void) | undefined;

  function cleanup() {
    unsubscribeAuthSession?.();
    unsubscribeAuthSession = undefined;
  }

  function notifyMounted() {
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
