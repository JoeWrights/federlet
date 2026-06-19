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

export function mount(context: MicroAppContext): MicroAppInstance {
  const eventBusLifecycle = createRemoteEventBusLifecycle(context, REMOTE_NAME);

  try {
    ReactDOM.render(
      <BrowserRouter basename={context.basename}>
        <RemoteApp
          basename={context.basename}
          mountedAt={
            typeof context.props?.mountedAt === "string"
              ? context.props.mountedAt
              : undefined
          }
          portalContainer={context.container}
        />
      </BrowserRouter>,
      context.container,
    );
  } catch (error) {
    ReactDOM.unmountComponentAtNode(context.container);
    throw error;
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
