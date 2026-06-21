import type { FederletRuntimeEnvironment } from "@federlet/shared-types";
import {
  DEFAULT_RUNTIME_ENV,
  SHELL_REMOTE_PROTOCOL_VERSION,
} from "./constants";

/**
 * 本地模拟 Apollo 当前集群下发的运行时配置。
 *
 * 真实 Apollo 通常通过 test/staging/prod 集群隔离环境，因此 Shell 本地只维护
 * “当前集群”的默认配置，不在代码里再维护多环境映射。
 */
export const DEFAULT_APOLLO_RUNTIME_CONFIG: FederletRuntimeEnvironment = {
  manifest: {
    remotes: [
      {
        basename: "/react",
        entryBaseUrl: "http://localhost:3001/",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        status: "active",
        supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
        title: "React Remote",
      },
      // {
      //   basename: "/react-nosandbox",
      //   entryBaseUrl: "http://localhost:3001/",
      //   id: "react-dashboard-nosandbox",
      //   path: "/react-nosandbox/*",
      //   remoteName: "remote_react",
      //   status: "active",
      //   supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
      //   title: "React Remote No Sandbox",
      // },
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
        id: "umi-react",
        path: "/umi/*",
        remoteName: "remote_umi_react",
        status: "active",
        supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
        title: "Umi React Remote",
      },
      // {
      //   basename: "/umi-nosandbox",
      //   entryBaseUrl: "http://localhost:3003/",
      //   id: "umi-react-nosandbox",
      //   path: "/umi-nosandbox/*",
      //   remoteName: "remote_umi_react",
      //   status: "active",
      //   supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],
      //   title: "Umi React Remote No Sandbox",
      // },
    ],
  },
  runtimeEnv: DEFAULT_RUNTIME_ENV,
};
