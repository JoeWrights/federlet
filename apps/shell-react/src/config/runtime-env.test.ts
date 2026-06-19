import { describe, expect, it } from "vitest";
import { DEFAULT_APOLLO_RUNTIME_CONFIG } from "./apollo";
import {
  createLocalRuntimeEnvironment,
  injectRuntimeEnvironment,
} from "./runtime-env";

describe("runtime environment config", () => {
  it("keeps Apollo defaults as JSON-compatible base URL config", () => {
    expect(DEFAULT_APOLLO_RUNTIME_CONFIG.manifest?.remotes[0]).toEqual(
      expect.objectContaining({
        entryBaseUrl: "http://localhost:3001/",
      }),
    );
  });

  it("creates local runtime environment from Apollo config defaults", () => {
    expect(createLocalRuntimeEnvironment()).toEqual({
      manifest: {
        remotes: [
          {
            basename: "/react",
            entryBaseUrl: "http://localhost:3001/",
            id: "react-dashboard",
            path: "/react/*",
            remoteName: "remote_react",
            status: "active",
            title: "React Remote",
          },
          {
            basename: "/vue",
            entryBaseUrl: "http://localhost:3002/",
            id: "vue-analytics",
            path: "/vue/*",
            remoteName: "remote_vue",
            status: "active",
            title: "Vue Remote",
          },
          {
            basename: "/umi",
            entryBaseUrl: "http://localhost:3003/",
            id: "umi-react",
            path: "/umi/*",
            remoteName: "remote_umi_react",
            status: "active",
            title: "Umi React Remote",
          },
        ],
      },
      runtimeEnv: "local",
    });
  });

  it("keeps one default Apollo config because Apollo clusters separate environments", () => {
    expect(createLocalRuntimeEnvironment("prod")).toEqual(
      createLocalRuntimeEnvironment(),
    );
  });

  it("injects local defaults without overriding pipeline-injected globals", () => {
    const target: {
      __FEDERLET_ENV__?: ReturnType<typeof createLocalRuntimeEnvironment>;
    } = {
      __FEDERLET_ENV__: {
        manifest: {
          remotes: [],
        },
        runtimeEnv: "prod",
      },
    };

    injectRuntimeEnvironment(target);

    expect(target.__FEDERLET_ENV__).toEqual({
      manifest: {
        remotes: [],
      },
      runtimeEnv: "prod",
    });
  });
});
