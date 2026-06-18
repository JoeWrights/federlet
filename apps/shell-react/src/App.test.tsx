// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createRemoteRouteElement, readSandboxRiskSnapshot } from "./App";

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: {
    clickCount?: number;
    intervalId?: number;
    source?: string;
  };
}

describe("createRemoteRouteElement", () => {
  it("keys each remote boundary by route id so containers are not reused across remotes", () => {
    const element = createRemoteRouteElement({
      id: "vue-analytics",
      path: "/vue/*",
      title: "Vue Remote",
      remoteName: "remote_vue",
      exposedModule: "./mount",
      basename: "/vue",
    });

    expect(element.key).toBe("vue-analytics");
  });
});

describe("readSandboxRiskSnapshot", () => {
  it("reports side effects left on shared browser globals", () => {
    (window as SandboxRiskWindow).__FEDERLET_SANDBOX_RISK__ = {
      clickCount: 2,
      intervalId: 1,
      source: "remote-react/settings",
    };
    document.body.append(document.createElement("div"));
    document.body.lastElementChild?.setAttribute(
      "data-federlet-sandbox-risk",
      "body-node",
    );
    const style = document.createElement("style");
    style.dataset.federletSandboxRisk = "head-style";
    document.head.append(style);

    expect(readSandboxRiskSnapshot()).toEqual({
      bodyNodeLeak: true,
      clickListenerCount: 2,
      globalPollution: true,
      leakingTimer: true,
      runtimeStyleLeak: true,
      source: "remote-react/settings",
    });

    delete (window as SandboxRiskWindow).__FEDERLET_SANDBOX_RISK__;
    document.body.replaceChildren();
    style.remove();
  });
});
