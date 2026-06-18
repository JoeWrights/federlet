import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "./router-compat";
import type {
  MicroAppContext,
  MicroAppInstance,
} from "@federlet/shared-types";
import { RemoteApp } from "./RemoteApp";

export function mount(context: MicroAppContext): MicroAppInstance {
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

  return {
    unmount() {
      ReactDOM.unmountComponentAtNode(context.container);
    },
  };
}
