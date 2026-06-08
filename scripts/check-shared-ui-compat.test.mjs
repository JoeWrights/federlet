import { describe, expect, it } from "vitest";
import { checkSharedUiCompatibility } from "./check-shared-ui-compat.mjs";

describe("checkSharedUiCompatibility", () => {
  it("accepts remotes whose shared-ui range is satisfied by the Shell version", () => {
    const result = checkSharedUiCompatibility({
      shellSharedUiVersion: "1.5.2",
      remotes: [
        {
          name: "@federlet/remote-react",
          sharedUiRequiredVersion: "^1.4.0",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects remotes whose shared-ui range is not satisfied by the Shell version", () => {
    const result = checkSharedUiCompatibility({
      shellSharedUiVersion: "1.5.2",
      remotes: [
        {
          name: "@federlet/remote-react",
          sharedUiRequiredVersion: "^2.0.0",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "@federlet/remote-react requires @federlet/shared-ui ^2.0.0, but Shell provides 1.5.2.",
    ]);
  });

  it("rejects remotes that consume shared-ui without declaring a runtime range", () => {
    const result = checkSharedUiCompatibility({
      shellSharedUiVersion: "1.5.2",
      remotes: [
        {
          name: "@federlet/remote-react",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "@federlet/remote-react consumes @federlet/shared-ui but does not declare federlet.sharedUiRequiredVersion.",
    ]);
  });
});
