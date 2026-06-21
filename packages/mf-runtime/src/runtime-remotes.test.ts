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

  it("rejects remote entries from untrusted origins before registering them", async () => {
    await expect(
      registerRuntimeRemoteEntries(
        [
          {
            entry: "https://evil.example.com/orders/remoteEntry.js",
            remoteName: "remote_orders",
          },
        ],
        {
          sourcePolicy: {
            allowedOrigins: ["https://cdn.example.com"],
            enforceHttps: true,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "REMOTE_SOURCE_NOT_ALLOWED",
      entry: "https://evil.example.com/orders/remoteEntry.js",
      remoteName: "remote_orders",
    });

    expect(mockedRegisterRemotes).not.toHaveBeenCalled();
  });

  it("allows localhost remotes only when the source policy permits local development", async () => {
    vi.stubGlobal("fetch", undefined);

    await registerRuntimeRemoteEntries(
      [
        {
          entry: "http://localhost:3001/remoteEntry.js",
          remoteName: "remote_react",
        },
      ],
      {
        sourcePolicy: {
          allowLocalhost: true,
          allowedOrigins: [],
          enforceHttps: true,
        },
      },
    );

    expect(mockedRegisterRemotes).toHaveBeenCalledWith(
      [
        {
          entry: "http://localhost:3001/remoteEntry.js",
          name: "remote_react",
        },
      ],
      { force: true },
    );
  });

  it("rejects localhost remotes that are not listed when broad localhost access is disabled", async () => {
    await expect(
      registerRuntimeRemoteEntries(
        [
          {
            entry: "http://localhost:3999/remoteEntry.js",
            remoteName: "remote_unknown",
          },
        ],
        {
          sourcePolicy: {
            allowLocalhost: false,
            allowedOrigins: ["http://localhost:3001"],
            enforceHttps: true,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "REMOTE_SOURCE_NOT_ALLOWED",
      entry: "http://localhost:3999/remoteEntry.js",
      remoteName: "remote_unknown",
    });

    expect(mockedRegisterRemotes).not.toHaveBeenCalled();
  });
});
