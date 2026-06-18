// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  captureRemoteDomSnapshot,
  detectRemoteDomEscapes,
} from "../src/index";

describe("remote DOM container isolation", () => {
  it("reports body nodes created outside the remote container after mount", () => {
    document.body.innerHTML = `
<main class="shell">
  <div class="remote-boundary__container" data-federlet-remote="remote_react"></div>
</main>
`;
    const container = document.querySelector<HTMLElement>(
      "[data-federlet-remote='remote_react']",
    );

    if (!container) {
      throw new Error("Missing remote container");
    }

    const snapshot = captureRemoteDomSnapshot({ container });
    const leakedNode = document.createElement("div");
    leakedNode.className = "remote-toast";
    document.body.append(leakedNode);

    expect(
      detectRemoteDomEscapes({
        container,
        phase: "mount",
        remoteName: "remote_react",
        snapshot,
      }),
    ).toEqual([
      expect.objectContaining({
        node: leakedNode,
        phase: "mount",
        reason: "node-outside-remote-container",
        remoteName: "remote_react",
      }),
    ]);
  });

  it("does not report nodes created inside the remote container", () => {
    document.body.innerHTML = `
<main class="shell">
  <div class="remote-boundary__container" data-federlet-remote="remote_vue"></div>
</main>
`;
    const container = document.querySelector<HTMLElement>(
      "[data-federlet-remote='remote_vue']",
    );

    if (!container) {
      throw new Error("Missing remote container");
    }

    const snapshot = captureRemoteDomSnapshot({ container });
    container.append(document.createElement("section"));

    expect(
      detectRemoteDomEscapes({
        container,
        phase: "mount",
        remoteName: "remote_vue",
        snapshot,
      }),
    ).toEqual([]);
  });
});
