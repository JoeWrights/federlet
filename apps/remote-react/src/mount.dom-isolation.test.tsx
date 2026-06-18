// @vitest-environment jsdom

import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  captureRemoteDomSnapshot,
  detectRemoteDomEscapes,
} from "@federlet/style-isolation";
import type { MicroAppInstance } from "@federlet/shared-types";
import { mount } from "./mount";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let instance: MicroAppInstance | null = null;

function createShellRemoteContainer(search = "") {
  window.history.pushState(null, "", `/react${search}`);
  document.body.innerHTML = `
<main class="shell">
  <div
    class="remote-boundary__container federlet-scope-remote-react"
    data-federlet-remote="remote_react"
  ></div>
</main>
`;

  const container = document.querySelector<HTMLElement>(
    "[data-federlet-remote='remote_react']",
  );

  if (!container) {
    throw new Error("Missing remote-react shell container");
  }

  return container;
}

afterEach(() => {
  act(() => {
    instance?.unmount();
  });
  instance = null;
  document.body.replaceChildren();
});

describe("remote-react DOM container isolation", () => {
  it("mounts the real remote without creating DOM outside its shell container", () => {
    const container = createShellRemoteContainer();
    const snapshot = captureRemoteDomSnapshot({ container });

    act(() => {
      instance = mount({
        basename: "/react",
        container,
      });
    });

    expect(container.textContent).toContain("Dashboard powered by React");
    expect(
      detectRemoteDomEscapes({
        container,
        phase: "mount",
        remoteName: "remote_react",
        snapshot,
      }),
    ).toEqual([]);
  });

  it("reports the mount-level DOM escape probe without preventing mount", () => {
    const container = createShellRemoteContainer(
      "?federletDomEscapeProbe=remote_react",
    );
    const snapshot = captureRemoteDomSnapshot({ container });

    act(() => {
      instance = mount({
        basename: "/react",
        container,
      });
    });

    const leakedPortal = document.querySelector(
      "[data-federlet-dom-escape-probe='remote_react']",
    );

    expect(container.textContent).toContain("Dashboard powered by React");
    expect(leakedPortal?.textContent).toBe("remote-react DOM escape probe");
    expect(
      detectRemoteDomEscapes({
        container,
        phase: "mount",
        remoteName: "remote_react",
        snapshot,
      }),
    ).toEqual([
      expect.objectContaining({
        node: leakedPortal,
        phase: "mount",
        reason: "node-outside-remote-container",
        remoteName: "remote_react",
      }),
    ]);

    act(() => {
      instance?.unmount();
    });
    instance = null;

    expect(
      document.querySelector("[data-federlet-dom-escape-probe='remote_react']"),
    ).toBeNull();
  });
});
