// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRemoteScopeClass,
  detectRuntimeStylePollution,
} from "@federlet/style-isolation";
import {
  createRemoteContainerClassName,
  scheduleRemoteUnmount,
} from "./RemoteAppBoundary";

describe("createRemoteContainerClassName", () => {
  it("adds a stable style isolation scope class for the remote container", () => {
    expect(createRemoteContainerClassName("remote_react")).toBe(
      "remote-boundary__container federlet-scope-remote-react",
    );
  });
});

describe("scheduleRemoteUnmount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defers remote unmount until the current React commit has finished", () => {
    vi.useFakeTimers();
    const unmount = vi.fn();

    scheduleRemoteUnmount({ unmount });

    expect(unmount).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(unmount).toHaveBeenCalledTimes(1);
  });
});

describe("detectRuntimeStylePollution", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("reports dynamic style tags that contain unscoped selectors", () => {
    const style = document.createElement("style");
    style.textContent = `
.leaked-toast {
  color: red;
}
`;
    document.head.append(style);

    const issues = detectRuntimeStylePollution({
      root: document,
      scopeClass: createRemoteScopeClass("remote_react"),
    });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "error",
        selector: ".leaked-toast",
        reason: "unscoped-selector",
      }),
    ]);
  });

  it("allows dynamic style tags that stay scoped to the remote container", () => {
    const style = document.createElement("style");
    style.dataset.federletRemote = "remote_react";
    style.textContent = `
.federlet-scope-remote-react .remote-toast {
  color: blue;
}
`;
    document.head.append(style);

    expect(
      detectRuntimeStylePollution({
        root: document,
        remoteName: "remote_react",
        scopeClass: createRemoteScopeClass("remote_react"),
      }),
    ).toEqual([]);
  });
});
