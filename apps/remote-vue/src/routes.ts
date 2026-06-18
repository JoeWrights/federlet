import type { RouteRecordRaw } from "vue-router";

export function createVueRemoteRoutes(): RouteRecordRaw[] {
  return [
    {
      path: "/",
      component: () => import("./pages/OverviewPage.vue"),
    },
    {
      path: "/reports",
      component: () => import("./pages/ReportsPage.vue"),
    },
  ];
}
