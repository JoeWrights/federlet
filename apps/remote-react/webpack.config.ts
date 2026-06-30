import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createReactRemoteConfig } from "@federlet/webpack-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default createReactRemoteConfig({
  appDir,
  name: "remote_react",
  port: 3001,
  exposes: {
    "./components/SettingsPage": "./src/pages/SettingsPage.tsx",
    "./mount": "./src/mount.tsx",
  },
});
