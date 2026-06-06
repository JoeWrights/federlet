import { describe, expect, it } from "vitest";
import { createReactRemoteConfig } from "../src/index";

describe("rspack config factories", () => {
  it("disables lazy compilation so federated remote route chunks resolve in dev", () => {
    const config = createReactRemoteConfig({
      appDir: "/workspace/apps/remote-react",
      name: "remote_react",
      port: 3001,
      exposes: {
        "./mount": "./src/mount.tsx",
      },
    });

    expect(config.lazyCompilation).toBe(false);
  });
});
