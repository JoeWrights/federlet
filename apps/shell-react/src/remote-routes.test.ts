import { describe, expect, it } from "vitest";
import { remoteRoutes } from "./remote-routes";

describe("remoteRoutes", () => {
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
