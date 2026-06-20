import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createVueHostConfig } from "@federlet/rspack-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default createVueHostConfig({
  appDir,
  name: "shell_vue",
  port: 3004,
  publicPath: "/",
  remotes: {},
  shared: false,
});
