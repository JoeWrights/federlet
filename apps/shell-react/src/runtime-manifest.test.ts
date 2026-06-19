import { afterEach, describe, expect, it, vi } from "vitest";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

const fallbackRoutes: RemoteRouteConfig[] = [
  {
    basename: "/react",
    exposedModule: "./mount",
    id: "react-dashboard",
    path: "/react/*",
    remoteName: "remote_react",
    title: "React Remote",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadRuntimeRemoteRoutes", () => {
  it("loads routes from an Apollo-injected inline manifest without fetching JSON", async () => {
    const registerRemoteEntries = vi.fn();

    const routes = await loadRuntimeRemoteRoutes({
      fallbackRoutes,
      registerRemoteEntries,
      runtimeEnv: {
        manifest: {
          generatedAt: "local",
          manifestVersion: "local",
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
        remoteVersion: "local",
        runtimeEnv: "local",
      },
    });

    expect(registerRemoteEntries).toHaveBeenCalledWith([
      {
        entry: "http://localhost:3001/remoteEntry.js?v=local",
        remoteName: "remote_react",
      },
      {
        entry: "http://localhost:3002/remoteEntry.js?v=local",
        remoteName: "remote_vue",
      },
      {
        entry: "http://localhost:3003/remoteEntry.js?v=local",
        remoteName: "remote_umi_react",
      },
    ]);
    expect(routes).toEqual([
      {
        basename: "/react",
        exposedModule: "./mount",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        title: "React Remote",
      },
      {
        basename: "/vue",
        exposedModule: "./mount",
        id: "vue-analytics",
        path: "/vue/*",
        remoteName: "remote_vue",
        title: "Vue Remote",
      },
      {
        basename: "/umi",
        exposedModule: "./mount",
        id: "umi-react",
        path: "/umi/*",
        remoteName: "remote_umi_react",
        title: "Umi React Remote",
      },
    ]);
  });

  it("normalizes entryBaseUrl without a trailing slash", async () => {
    const registerRemoteEntries = vi.fn();

    await loadRuntimeRemoteRoutes({
      fallbackRoutes,
      registerRemoteEntries,
      runtimeEnv: {
        manifest: {
          generatedAt: "local",
          manifestVersion: "local",
          remotes: [
            {
              basename: "/react",
              entryBaseUrl: "http://localhost:3001",
              id: "react-dashboard",
              path: "/react/*",
              remoteName: "remote_react",
              status: "active",
              title: "React Remote",
            },
          ],
        },
        remoteVersion: "local",
        runtimeEnv: "local",
      },
    });

    expect(registerRemoteEntries).toHaveBeenCalledWith([
      {
        entry: "http://localhost:3001/remoteEntry.js?v=local",
        remoteName: "remote_react",
      },
    ]);
  });

  it("falls back to static routes when the injected manifest is invalid", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const registerRemoteEntries = vi.fn();

    const routes = await loadRuntimeRemoteRoutes({
      fallbackRoutes,
      registerRemoteEntries,
      runtimeEnv: {
        manifest: { manifestVersion: "1.0.0" },
        runtimeEnv: "test",
      } as never,
    });

    expect(routes).toBe(fallbackRoutes);
    expect(registerRemoteEntries).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Injected runtime remote manifest is invalid",
      expect.objectContaining({
        runtimeEnv: "test",
      }),
    );
  });
});
