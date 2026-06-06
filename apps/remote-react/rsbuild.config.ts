import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactRemoteConfig } from "@federlet/rsbuild-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default createReactRemoteConfig({
  appDir,
  name: "remote_react",
  port: 3001,
  exposes: {
    "./mount": "./src/mount.tsx",
  },
});
