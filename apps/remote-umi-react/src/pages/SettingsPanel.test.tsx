// @vitest-environment jsdom

import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: {
    seckillIntervalId?: number;
    seckillRemainingSeconds?: number;
    source?: string;
  };
}

let root: HTMLDivElement | null = null;

function getRiskWindow() {
  return window as SandboxRiskWindow;
}

function renderSettingsPanel() {
  root = document.createElement("div");
  document.body.append(root);

  act(() => {
    ReactDOM.render(<SettingsPanel />, root);
  });

  return root;
}

afterEach(() => {
  const risk = getRiskWindow().__FEDERLET_SANDBOX_RISK__;

  if (risk?.seckillIntervalId !== undefined) {
    clearInterval(risk.seckillIntervalId);
  }

  if (root) {
    act(() => {
      ReactDOM.unmountComponentAtNode(root as HTMLDivElement);
    });
  }

  root = null;
  delete getRiskWindow().__FEDERLET_SANDBOX_RISK__;
  vi.useRealTimers();
});

describe("SettingsPanel seckill sandbox demo", () => {
  it("automatically runs a twelve-hour seckill countdown through a global interval", () => {
    vi.useFakeTimers();
    const host = renderSettingsPanel();

    expect(host.textContent).toContain("Legacy seckill countdown");
    expect(host.textContent).toContain("Sale starts in 12:00:00");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(host.textContent).toContain("Sale starts in 11:59:59");
    expect(getRiskWindow().__FEDERLET_SANDBOX_RISK__).toMatchObject({
      seckillRemainingSeconds: 43_199,
      source: "remote-umi-react/settings",
    });
  });
});
