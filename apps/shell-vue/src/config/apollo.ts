import type { FederletRuntimeEnvironment } from "@federlet/shared-types";
import {
  DEFAULT_RUNTIME_ENV,
  SHELL_REMOTE_PROTOCOL_VERSION,
} from "./constants";

export const DEFAULT_APOLLO_RUNTIME_CONFIG: FederletRuntimeEnvironment = {
  manifest: {
    remotes: [
      {
        basename: "/react",
        components: [
          {
            description: "Remote React settings page exposed as a reusable React component.",
            expose: "./components/SettingsPage",
            framework: "react",
            name: "SettingsPage",
          },
        ],
        entryBaseUrl: "http://localhost:3001/",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        status: "active",
        supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
        title: "React Remote",
      },
      {
        basename: "/vue",
        entryBaseUrl: "http://localhost:3002/",
        id: "vue-analytics",
        path: "/vue/*",
        remoteName: "remote_vue",
        status: "active",
        supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
        title: "Vue Remote",
      },
      {
        basename: "/umi",
        entryBaseUrl: "http://localhost:3003/",
        entryGlobalName: "remote_umi_react",
        id: "umi-react",
        path: "/umi/*",
        remoteEntryType: "var",
        remoteName: "remote_umi_react",
        status: "active",
        supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
        title: "Umi React Remote",
      },
    ],
  },
  runtimeEnv: DEFAULT_RUNTIME_ENV,
};
