import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactHostConfig } from "@federlet/vite-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default createReactHostConfig({
  appDir,
  name: "shell_react",
  port: 3000,
  publicPath: "/",
  remotes: {
    remote_react: "remote_react@http://localhost:3001/remoteEntry.js",
    remote_vue: "remote_vue@http://localhost:3002/remoteEntry.js",
    remote_umi_react: {
      type: "var",
      name: "remote_umi_react",
      entry: "http://localhost:3003/remoteEntry.js",
      entryGlobalName: "remote_umi_react",
    },
  },
});
