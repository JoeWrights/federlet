import { describe, expect, it } from "vitest";
import { createRemoteDebugSnapshot } from "./debug";
import { createRuntimeRemoteRegistry } from "./remote-registry";

describe("createRemoteDebugSnapshot", () => {
  it("returns registered remote entry and health details from the registry", () => {
    const registry = createRuntimeRemoteRegistry(() => 1000);
    const error = new Error("remote entry rejected");

    registry.registerMany([
      {
        basename: "/react",
        entry: "http://localhost:3001/remoteEntry.js",
        exposedModule: "./mount",
        id: "react-dashboard",
        path: "/react/*",
        remoteEntryType: "module",
        remoteName: "remote_react",
        title: "React Remote",
      },
    ]);
    registry.updateHealth("remote_react", {
      lastError: error,
      loadHealth: "unavailable",
      registrationStatus: "failed",
    });

    expect(createRemoteDebugSnapshot(registry)).toEqual({
      remotes: [
        {
          entry: "http://localhost:3001/remoteEntry.js",
          exposedModule: "./mount",
          id: "react-dashboard",
          lastErrorMessage: "remote entry rejected",
          loadHealth: "unavailable",
          registrationStatus: "failed",
          remoteEntryType: "module",
          remoteName: "remote_react",
          title: "React Remote",
          updatedAt: 1000,
        },
      ],
    });
  });

  it("keeps fallback routes visible when entry metadata is unavailable", () => {
    const registry = createRuntimeRemoteRegistry(() => 2000);

    registry.registerMany([
      {
        basename: "/vue",
        exposedModule: "./mount",
        id: "vue-dashboard",
        path: "/vue/*",
        remoteName: "remote_vue",
        title: "Vue Remote",
      },
    ]);

    expect(createRemoteDebugSnapshot(registry)).toEqual({
      remotes: [
        {
          entry: undefined,
          exposedModule: "./mount",
          id: "vue-dashboard",
          lastErrorMessage: undefined,
          loadHealth: "unknown",
          registrationStatus: "registered",
          remoteEntryType: undefined,
          remoteName: "remote_vue",
          title: "Vue Remote",
          updatedAt: 2000,
        },
      ],
    });
  });
});
