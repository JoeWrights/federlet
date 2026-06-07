import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createReactRemoteConfig } from "@federlet/rspack-config";

const appDir = dirname(fileURLToPath(import.meta.url));

interface RspackCliOptions {
  mode?: string;
}

function shouldProvideSharedUi(argv: RspackCliOptions) {
  return (
    process.env.FEDERLET_PROVIDE_SHARED_UI !== "false" &&
    argv.mode !== "production"
  );
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
    provideSharedUi: shouldProvideSharedUi(argv),
  });
}
