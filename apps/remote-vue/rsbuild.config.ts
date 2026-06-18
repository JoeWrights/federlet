import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createVueRemoteConfig } from "@federlet/rsbuild-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default createVueRemoteConfig({
  appDir,
  name: "remote_vue",
  port: 3002,
  exposes: {
    "./mount": "./src/mount.ts",
  },
});
