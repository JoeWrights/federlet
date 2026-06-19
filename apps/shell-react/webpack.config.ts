import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createReactHostConfig } from "@federlet/webpack-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default createReactHostConfig({
  appDir,
  name: "shell_react",
  port: 3000,
  publicPath: "/",
  // remoteEntry 地址由 Apollo 注入的 manifest 在运行时动态注册。
  remotes: {},
});
