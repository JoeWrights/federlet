// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import OverviewPage from "./OverviewPage";
import { RemoteAppProvider } from "../RemoteAppContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function renderWithShellContainer(shellRemoteContainer: HTMLElement) {
  const app = document.createElement("div");
  shellRemoteContainer.append(app);

  act(() => {
    root = createRoot(app);
    root.render(
      <RemoteAppProvider portalContainer={shellRemoteContainer}>
        <OverviewPage />
      </RemoteAppProvider>,
    );
  });

  return app;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("OverviewPage", () => {
  it("shows the shared UI example content", () => {
    const shellRemoteContainer = document.createElement("div");
    document.body.append(shellRemoteContainer);

    renderWithShellContainer(shellRemoteContainer);

    expect(shellRemoteContainer.textContent).toContain("Shared UI card");
    expect(shellRemoteContainer.textContent).toContain("Open shared dashboard");
    expect(shellRemoteContainer.textContent).toContain(
      "Ant Design 5 is provided by the Shell",
    );
  });

  it("mounts the Ant Design modal inside the shell remote container", () => {
    const shellRemoteContainer = document.createElement("div");
    shellRemoteContainer.className = "remote-boundary__container";
    document.body.append(shellRemoteContainer);

    renderWithShellContainer(shellRemoteContainer);

    const openButton = shellRemoteContainer.querySelector("button");

    act(() => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = shellRemoteContainer.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Shell-scoped Ant Design modal");
    expect(
      shellRemoteContainer.querySelector(
        ".federlet-scope-remote-react-ant-modal-root",
      ),
    ).not.toBeNull();
    expect(shellRemoteContainer.querySelector(".ant-modal-root")).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBe(dialog);
  });
});
