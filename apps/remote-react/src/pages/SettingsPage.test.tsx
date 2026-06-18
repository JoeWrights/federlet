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
    source?: string;
  };
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

  act(() => {
    root?.unmount();
  });
  root = null;
  delete getRiskWindow().__FEDERLET_SANDBOX_RISK__;
  document.head
    .querySelector("[data-federlet-sandbox-risk='head-style']")
    ?.remove();
  document.body.replaceChildren();
  document.title = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SettingsPage sandbox risk lab", () => {
  it("shows controls for risks that a JS sandbox should contain", () => {
    const host = renderSettingsPage();

    expect(host.textContent).toContain("Sandbox Risk Lab");
    expect(host.textContent).toContain("Pollute window");
    expect(host.textContent).toContain("Inject runtime style");
  });

  it("can create global, listener, DOM, timer, and style side effects outside the remote container", () => {
    vi.useFakeTimers();
    const host = renderSettingsPage();

    clickButton(host, "Pollute window");
    clickButton(host, "Start leaking timer");
    clickButton(host, "Register window click listener");
    clickButton(host, "Append body node");
    clickButton(host, "Inject runtime style");

    window.dispatchEvent(new MouseEvent("click"));
    vi.advanceTimersByTime(1000);

    const risk = getRiskWindow().__FEDERLET_SANDBOX_RISK__;

    expect(risk?.source).toBe("remote-react/settings");
    expect(risk?.clickCount).toBeGreaterThanOrEqual(1);
    expect(document.title).toBe("remote-react timer leak 1");
    expect(
      document.body.querySelector("[data-federlet-sandbox-risk='body-node']"),
    ).not.toBeNull();
    expect(
      document.head.querySelector("[data-federlet-sandbox-risk='head-style']"),
    ).not.toBeNull();
  });
});
