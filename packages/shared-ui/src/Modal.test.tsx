// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "./index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function render(element: React.ReactNode) {
  const app = document.createElement("div");
  document.body.append(app);

  act(() => {
    root = createRoot(app);
    root.render(element);
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

describe("Modal", () => {
  it("renders into document.body by default", () => {
    const app = render(
      createElement(
        Modal,
        {
          open: true,
          title: "Default modal",
          children: "Body mounted content",
        },
      ),
    );

    const dialog = document.body.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Body mounted content");
    expect(app.contains(dialog)).toBe(false);
  });

  it("renders into the container returned from getContainer", () => {
    const shellRemoteContainer = document.createElement("div");
    shellRemoteContainer.setAttribute("data-shell-remote-container", "true");
    document.body.append(shellRemoteContainer);

    render(
      createElement(
        Modal,
        {
          open: true,
          title: "Shell-scoped modal",
          children: "Container mounted content",
          getContainer: () => shellRemoteContainer,
        },
      ),
    );

    const dialog = shellRemoteContainer.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Container mounted content");
    expect(document.body.querySelector('[role="dialog"]')).toBe(dialog);
  });
});
