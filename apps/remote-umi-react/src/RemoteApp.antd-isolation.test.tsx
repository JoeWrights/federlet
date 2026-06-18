// @vitest-environment jsdom

import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import OverviewPanel from "./pages/OverviewPanel";
import { RemoteAppProvider } from "./RemoteAppContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let appRoot: HTMLDivElement | null = null;

function renderUmiRemote() {
  window.history.pushState(null, "", "/umi");
  document.body.innerHTML = `
<main class="shell">
  <div
    class="remote-boundary__container federlet-scope-remote-umi-react"
    data-federlet-remote="remote_umi_react"
  ></div>
</main>
`;

  const remoteContainer = document.querySelector<HTMLElement>(
    "[data-federlet-remote='remote_umi_react']",
  );

  if (!remoteContainer) {
    throw new Error("Missing Umi remote container");
  }

  appRoot = document.createElement("div");
  remoteContainer.append(appRoot);

  act(() => {
    ReactDOM.render(
      <RemoteAppProvider portalContainer={remoteContainer}>
        <OverviewPanel />
      </RemoteAppProvider>,
      appRoot,
    );
  });

  return remoteContainer;
}

afterEach(() => {
  if (appRoot) {
    act(() => {
      ReactDOM.unmountComponentAtNode(appRoot as HTMLDivElement);
    });
  }

  appRoot = null;
  document.body.replaceChildren();
});

describe("RemoteApp Ant Design style isolation", () => {
  it("uses a remote-umi-react Ant Design prefix that differs from remote-react", async () => {
    const remoteContainer = renderUmiRemote();

    const openButton = Array.from(remoteContainer.querySelectorAll("button")).find(
      (button) => button.textContent === "Open Umi AntD modal",
    );

    expect(openButton).toBeDefined();

    act(() => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = remoteContainer.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Umi-scoped Ant Design modal");
    expect(
      remoteContainer.querySelector(
        ".federlet-scope-remote-umi-react-ant-modal-root",
      ),
    ).not.toBeNull();
    expect(
      remoteContainer.querySelector(
        ".federlet-scope-remote-react-ant-modal-root",
      ),
    ).toBeNull();
    expect(remoteContainer.querySelector(".ant-modal-root")).toBeNull();
  });
});
