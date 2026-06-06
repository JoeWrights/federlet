import { describe, expect, it } from "vitest";
import { umiRemoteRoutes } from "./routes";

describe("umiRemoteRoutes", () => {
  it("defines overview, reports and settings child routes", () => {
    expect(umiRemoteRoutes.map((route) => route.path)).toEqual([
      "/",
      "/reports",
      "/settings",
    ]);
    expect(umiRemoteRoutes.every((route) => route.Component)).toBe(true);
  });
});
