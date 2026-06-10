// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
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
