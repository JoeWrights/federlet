import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { createReactRemoteConfig } from "@federlet/rspack-config";

const appDir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const appPackage = require("./package.json") as {
  dependencies?: Record<string, string>;
  federlet?: {
    sharedUiRequiredVersion?: string;
  };
};

interface RspackCliOptions {
  mode?: string;
}

function shouldProvideSharedUi(argv: RspackCliOptions) {
  return (
    process.env.FEDERLET_PROVIDE_SHARED_UI !== "false" &&
    argv.mode !== "production"
  );
}

function sharedUiConfig(argv: RspackCliOptions) {
  const requiredVersion = appPackage.federlet?.sharedUiRequiredVersion;

  return {
    singleton: true,
    requiredVersion,
    ...(requiredVersion ? { strictVersion: true as const } : {}),
    ...(shouldProvideSharedUi(argv) ? {} : { import: false as const }),
  };
}

function antdConfig(argv: RspackCliOptions) {
  return {
    singleton: true,
    requiredVersion: appPackage.dependencies?.antd ?? "^5",
    strictVersion: true,
    ...(argv.mode === "production" ? { import: false as const } : {}),
  };
}

export default function createConfig(
  _env: unknown,
  argv: RspackCliOptions = {},
) {
  return createReactRemoteConfig({
    appDir,
    name: "remote_react",
    port: 3001,
    exposes: {
      "./mount": "./src/mount.tsx",
    },
    shared: {
      "@federlet/shared-ui": sharedUiConfig(argv),
      antd: antdConfig(argv),
    },
  });
}
