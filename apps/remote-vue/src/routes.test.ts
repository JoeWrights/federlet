import { describe, expect, it } from "vitest";
import { createVueRemoteRoutes } from "./routes";

describe("createVueRemoteRoutes", () => {
  it("defines async route components", () => {
    const routes = createVueRemoteRoutes();

    expect(routes.map((route) => route.path)).toEqual(["/", "/reports"]);
    expect(routes.every((route) => typeof route.component === "function")).toBe(
      true,
    );
  });
});
