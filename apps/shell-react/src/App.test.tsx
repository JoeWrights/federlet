import { describe, expect, it } from "vitest";
import { createRemoteRouteElement } from "./App";

describe("createRemoteRouteElement", () => {
  it("keys each remote boundary by route id so containers are not reused across remotes", () => {
    const element = createRemoteRouteElement({
      id: "vue-analytics",
      path: "/vue/*",
      title: "Vue Remote",
      remoteName: "remote_vue",
      exposedModule: "./mount",
      basename: "/vue",
    });

    expect(element.key).toBe("vue-analytics");
  });
});
