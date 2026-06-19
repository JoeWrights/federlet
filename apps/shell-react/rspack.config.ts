import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { createReactHostConfig } from "@federlet/rspack-config";

const appDir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const appPackage = require("./package.json") as {
  dependencies?: Record<string, string>;
};
const sharedUiPackage = require("../../packages/shared-ui/package.json") as {
  version: string;
};

export default createReactHostConfig({
  appDir,
  name: "shell_react",
  port: 3000,
  publicPath: "/",
  shared: {
    "@federlet/shared-ui": {
      singleton: true,
      requiredVersion: sharedUiPackage.version,
      strictVersion: true,
    },
    antd: {
      singleton: true,
      requiredVersion: appPackage.dependencies?.antd ?? "^5",
      strictVersion: true,
    },
  },
  // remoteEntry 地址由 Apollo 注入的 manifest 在运行时动态注册。
  remotes: {},
});
