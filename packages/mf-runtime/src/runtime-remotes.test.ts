import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerRemotes } from "@module-federation/enhanced/runtime";
import { registerRuntimeRemoteEntries } from "./runtime-remotes";

vi.mock("@module-federation/enhanced/runtime", () => ({
  registerRemotes: vi.fn(),
}));

const mockedRegisterRemotes = vi.mocked(registerRemotes);

describe("registerRuntimeRemoteEntries", () => {
  beforeEach(() => {
    mockedRegisterRemotes.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers dynamic remoteEntry URLs with Module Federation runtime", async () => {
    vi.stubGlobal("fetch", undefined);

    await registerRuntimeRemoteEntries([
      {
        entry: "https://cdn.example.com/orders/remoteEntry.js",
        remoteName: "remote_orders",
      },
    ]);

    expect(mockedRegisterRemotes).toHaveBeenCalledWith(
      [
        {
          entry: "https://cdn.example.com/orders/remoteEntry.js",
          name: "remote_orders",
        },
      ],
      { force: true },
    );
  });

  it("passes remote entry type hints to Module Federation runtime", async () => {
    await registerRuntimeRemoteEntries([
      {
        entry: "http://localhost:3001/remoteEntry.js",
        remoteEntryType: "module",
        remoteName: "remote_react",
      },
      {
        entry: "http://localhost:3003/remoteEntry.js",
        entryGlobalName: "remote_umi_react",
        remoteEntryType: "var",
        remoteName: "remote_umi_react",
      },
    ]);

    expect(mockedRegisterRemotes).toHaveBeenCalledWith(
      [
        {
          entry: "http://localhost:3001/remoteEntry.js",
          name: "remote_react",
          type: "module",
        },
        {
          entry: "http://localhost:3003/remoteEntry.js",
          entryGlobalName: "remote_umi_react",
          name: "remote_umi_react",
          type: "var",
        },
      ],
      { force: true },
    );
  });

  it("detects Vite ESM remote entries when no type hint is provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        text: async () => `
          // Vite remoteEntry
          import { init as runtimeInit } from "/node_modules/.vite/deps/@module-federation_runtime.js";
          export { get, init };
        `,
      })),
    );

    await registerRuntimeRemoteEntries([
      {
        entry: "http://localhost:3001/remoteEntry.js",
        remoteName: "remote_react",
      },
    ]);

    expect(mockedRegisterRemotes).toHaveBeenCalledWith(
      [
        {
          entry: "http://localhost:3001/remoteEntry.js",
          name: "remote_react",
          type: "module",
        },
      ],
      { force: true },
    );
  });

  it("keeps var remotes as script entries when no module syntax is detected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        text: async () => "var remote_vue; (() => { /* webpack runtime */ })();",
      })),
    );

    await registerRuntimeRemoteEntries([
      {
        entry: "http://localhost:3002/remoteEntry.js",
        remoteName: "remote_vue",
      },
    ]);

    expect(mockedRegisterRemotes).toHaveBeenCalledWith(
      [
        {
          entry: "http://localhost:3002/remoteEntry.js",
          name: "remote_vue",
        },
      ],
      { force: true },
    );
  });
});
