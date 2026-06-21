import { describe, expect, it, vi } from "vitest";
import { registerRemotes } from "@module-federation/enhanced/runtime";
import { registerRuntimeRemoteEntries } from "./runtime-remotes";

vi.mock("@module-federation/enhanced/runtime", () => ({
  registerRemotes: vi.fn(),
}));

const mockedRegisterRemotes = vi.mocked(registerRemotes);

describe("registerRuntimeRemoteEntries", () => {
  it("registers dynamic remoteEntry URLs with Module Federation runtime", () => {
    registerRuntimeRemoteEntries([
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

  it("passes remote entry type hints to Module Federation runtime", () => {
    registerRuntimeRemoteEntries([
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
});
