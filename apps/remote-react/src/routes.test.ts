import { describe, expect, it } from "vitest";
import { reactRemoteRoutes } from "./routes";

describe("reactRemoteRoutes", () => {
  it("defines lazy-loaded route components", () => {
    expect(reactRemoteRoutes).toHaveLength(2);
    expect(reactRemoteRoutes.map((route) => route.label)).toEqual([
      "Overview",
      "Settings",
    ]);
    expect(reactRemoteRoutes.every((route) => route.Component)).toBe(true);
  });
});
