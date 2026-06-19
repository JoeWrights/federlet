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
        entry: "https://cdn.example.com/orders/remoteEntry.js?v=20260619",
        remoteName: "remote_orders",
      },
    ]);

    expect(mockedRegisterRemotes).toHaveBeenCalledWith(
      [
        {
          entry: "https://cdn.example.com/orders/remoteEntry.js?v=20260619",
          name: "remote_orders",
        },
      ],
      { force: true },
    );
  });
});
