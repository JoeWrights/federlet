import type { RemoteRouteConfig } from "@federlet/shared-types";

/**
 * Shell 当前接入的 remote 路由表。
 *
 * 新增 remote 时优先在这里登记入口路径、Module Federation 名称和暴露模块，
 * Shell 其他位置只消费这份稳定配置。
 */
export const remoteRoutes: RemoteRouteConfig[] = [
  {
    id: "react-dashboard",
    path: "/react/*",
    title: "React Remote",
    remoteName: "remote_react",
    exposedModule: "./mount",
    basename: "/react",
  },
  {
    id: "vue-analytics",
    path: "/vue/*",
    title: "Vue Remote",
    remoteName: "remote_vue",
    exposedModule: "./mount",
    basename: "/vue",
  },
];
