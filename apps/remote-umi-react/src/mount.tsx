import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "./router-compat";
import type {
  MicroAppContext,
  MicroAppInstance,
} from "@federlet/shared-types";
import { RemoteApp } from "./RemoteApp";
import { createRemoteEventBusLifecycle } from "./remote-event-bus";

const REMOTE_NAME = "remote_umi_react";

interface RemoteRuntimeErrorBoundaryProps {
  children: React.ReactNode;
  onMountError: (error: unknown) => void;
  onError: (error: unknown) => void;
  shouldRethrow: () => boolean;
}

class RemoteRuntimeErrorBoundary extends React.Component<RemoteRuntimeErrorBoundaryProps> {
  componentDidCatch(error: unknown) {
    this.props.onError(error);

    if (this.props.shouldRethrow()) {
      this.props.onMountError(error);
    }
  }

  render() {
    return this.props.children;
  }
}

export function mount(context: MicroAppContext): MicroAppInstance {
  const eventBusLifecycle = createRemoteEventBusLifecycle(context, REMOTE_NAME);
  let hasMountError = false;
  let isMounting = false;
  let mountError: unknown;

  try {
    isMounting = true;
    ReactDOM.render(
      <BrowserRouter basename={context.basename}>
        <RemoteRuntimeErrorBoundary
          onMountError={(error) => {
            hasMountError = true;
            mountError = error;
          }}
          onError={(error) => {
            context.onError?.(error);
          }}
          shouldRethrow={() => isMounting}
        >
          <RemoteApp
            basename={context.basename}
            mountedAt={
              typeof context.props?.mountedAt === "string"
                ? context.props.mountedAt
                : undefined
            }
            portalContainer={context.container}
          />
        </RemoteRuntimeErrorBoundary>
      </BrowserRouter>,
      context.container,
    );
    if (hasMountError) {
      ReactDOM.unmountComponentAtNode(context.container);
      throw mountError;
    }
  } catch (error) {
    ReactDOM.unmountComponentAtNode(context.container);
    throw error;
  } finally {
    isMounting = false;
  }

  try {
    eventBusLifecycle.notifyMounted();
  } catch (error) {
    ReactDOM.unmountComponentAtNode(context.container);
    throw error;
  }

  return {
    unmount() {
      eventBusLifecycle.cleanup();
      try {
        eventBusLifecycle.notifyUnmounted();
      } finally {
        ReactDOM.unmountComponentAtNode(context.container);
      }
    },
  };
}
