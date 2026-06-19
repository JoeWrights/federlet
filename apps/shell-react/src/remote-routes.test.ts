import { describe, expect, it } from "vitest";
import { createFallbackRemoteRoutes, remoteRoutes } from "./remote-routes";

describe("remoteRoutes", () => {
  it("creates fallback routes from Apollo runtime manifest config", () => {
    expect(
      createFallbackRemoteRoutes({
        manifest: {
          remotes: [
            {
              basename: "/orders",
              entryBaseUrl: "http://localhost:3010/",
              id: "orders",
              path: "/orders/*",
              remoteName: "remote_orders",
              status: "active",
              title: "Orders",
            },
          ],
        },
        runtimeEnv: "test",
      }),
    ).toEqual([
      {
        basename: "/orders",
        exposedModule: "./mount",
        id: "orders",
        path: "/orders/*",
        remoteName: "remote_orders",
        title: "Orders",
      },
    ]);
  });

  it("registers the Umi React remote under the /umi basename", () => {
    expect(remoteRoutes).toContainEqual({
      id: "umi-react",
      path: "/umi/*",
      title: "Umi React Remote",
      remoteName: "remote_umi_react",
      exposedModule: "./mount",
      basename: "/umi",
    });
  });
});
