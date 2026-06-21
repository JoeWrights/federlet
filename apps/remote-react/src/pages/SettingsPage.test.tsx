// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./SettingsPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: {
    clickCount?: number;
    intervalId?: number;
    onWindowClick?: EventListener;
    rafFired?: boolean;
    source?: string;
    timeoutFired?: boolean;
    timeoutId?: number;
    ticks?: number;
    seckillRemainingSeconds?: number;
    seckillIntervalId?: number;
  };
  __FEDERLET_UNSANDBOXED_WINDOW_WRITE__?: string;
}

let root: Root | null = null;

function getRiskWindow() {
  return window as SandboxRiskWindow;
}

function renderSettingsPage() {
  const host = document.createElement("div");
  document.body.append(host);

  act(() => {
    root = createRoot(host);
    root.render(<SettingsPage />);
  });

  return host;
}

function clickButton(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  );

  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

afterEach(() => {
  const risk = getRiskWindow().__FEDERLET_SANDBOX_RISK__;

  if (risk?.intervalId !== undefined) {
    clearInterval(risk.intervalId);
  }

  if (risk?.onWindowClick) {
    window.removeEventListener("click", risk.onWindowClick);
  }

  if (risk?.timeoutId !== undefined) {
    clearTimeout(risk.timeoutId);
  }

  if (risk?.seckillIntervalId !== undefined) {
    clearInterval(risk.seckillIntervalId);
  }

  act(() => {
    root?.unmount();
  });
  root = null;
  delete getRiskWindow().__FEDERLET_SANDBOX_RISK__;
  delete getRiskWindow().__FEDERLET_UNSANDBOXED_WINDOW_WRITE__;
  delete (Array.prototype as { __federletSandboxRisk__?: string })
    .__federletSandboxRisk__;
  document.head
    .querySelector("[data-federlet-sandbox-risk='head-style']")
    ?.remove();
  document.head
    .querySelector("[data-federlet-sandbox-risk='head-link']")
    ?.remove();
  document.head
    .querySelector("[data-federlet-sandbox-risk='head-script']")
    ?.remove();
  document.body.replaceChildren();
  localStorage.removeItem("federlet:sandbox-risk");
  sessionStorage.removeItem("federlet:sandbox-risk");
  document.cookie = "federlet_sandbox_risk=; Max-Age=0; path=/";
  document.title = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SettingsPage sandbox risk lab", () => {
  it("shows controls for risks that a JS sandbox should contain", () => {
    const host = renderSettingsPage();

    expect(host.textContent).toContain("Sandbox Risk Lab");
    expect(host.textContent).toContain("Pollute window");
    expect(host.textContent).toContain("Schedule timeout");
    expect(host.textContent).toContain("Schedule raf");
    expect(host.textContent).toContain("Pollute direct window property");
    expect(host.textContent).toContain("Inject dynamic link");
    expect(host.textContent).toContain("Inject dynamic script");
    expect(host.textContent).toContain("Write browser storage");
    expect(host.textContent).toContain("Pollute Array prototype");
    expect(host.textContent).toContain("Inject runtime style");
  });

  it("can create global, listener, DOM, timer, raf, timeout, and style side effects outside the remote container", () => {
    vi.useFakeTimers();
    const host = renderSettingsPage();

    clickButton(host, "Pollute window");
    clickButton(host, "Start leaking timer");
    clickButton(host, "Register window click listener");
    clickButton(host, "Schedule timeout");
    clickButton(host, "Schedule raf");
    clickButton(host, "Append body node");
    clickButton(host, "Inject runtime style");

    act(() => {
      window.dispatchEvent(new MouseEvent("click"));
      vi.advanceTimersByTime(1000);
    });

    const risk = getRiskWindow().__FEDERLET_SANDBOX_RISK__;

    expect(risk?.source).toBe("remote-react/settings");
    expect(risk?.clickCount).toBeGreaterThanOrEqual(1);
    expect(risk?.ticks).toBe(1);
    expect(risk?.timeoutFired).toBe(true);
    expect(risk?.rafFired).toBe(true);
    expect(document.title).toBe("remote-react timer leak 1");
    expect(
      document.body.querySelector("[data-federlet-sandbox-risk='body-node']"),
    ).not.toBeNull();
    expect(
      document.head.querySelector("[data-federlet-sandbox-risk='head-style']"),
    ).not.toBeNull();
  });

  it("shows live risk state so the shell can compare sandbox on and off", () => {
    vi.useFakeTimers();
    const host = renderSettingsPage();

    clickButton(host, "Start leaking timer");
    clickButton(host, "Schedule timeout");
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(host.textContent).toContain("interval ticks");
    expect(host.textContent).toContain("1");
    expect(host.textContent).toContain("timeout fired");
    expect(host.textContent).toContain("yes");
  });

  it("demonstrates blind spots the current sandbox cannot contain", () => {
    const host = renderSettingsPage();

    clickButton(host, "Pollute direct window property");
    clickButton(host, "Inject dynamic link");
    clickButton(host, "Inject dynamic script");
    clickButton(host, "Write browser storage");
    clickButton(host, "Pollute Array prototype");

    expect(getRiskWindow().__FEDERLET_UNSANDBOXED_WINDOW_WRITE__).toBe(
      "remote-react/settings",
    );
    expect(
      document.head.querySelector("[data-federlet-sandbox-risk='head-link']"),
    ).not.toBeNull();
    expect(
      document.head.querySelector("[data-federlet-sandbox-risk='head-script']"),
    ).not.toBeNull();
    expect(localStorage.getItem("federlet:sandbox-risk")).toBe(
      "remote-react/settings",
    );
    expect(sessionStorage.getItem("federlet:sandbox-risk")).toBe(
      "remote-react/settings",
    );
    expect(document.cookie).toContain("federlet_sandbox_risk=remote-react");
    expect(
      (Array.prototype as { __federletSandboxRisk__?: string })
        .__federletSandboxRisk__,
    ).toBe("remote-react/settings");
    expect(host.textContent).toContain("direct window write");
    expect(host.textContent).toContain("detected");
  });

  it("automatically runs a one-day seckill countdown through a global interval", () => {
    vi.useFakeTimers();
    const host = renderSettingsPage();

    expect(host.textContent).toContain("Product seckill countdown");
    expect(host.textContent).toContain("Sale starts in 24:00:00");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(host.textContent).toContain("Sale starts in 23:59:59");
    expect(getRiskWindow().__FEDERLET_SANDBOX_RISK__).toMatchObject({
      seckillRemainingSeconds: 86_399,
    });
  });
});
