import { lazy, type ComponentType } from "react";

export interface UmiRemoteRoute {
  path: string;
  label: string;
  exact?: boolean;
  Component: ComponentType;
}

export const umiRemoteRoutes: UmiRemoteRoute[] = [
  {
    path: "/",
    label: "Overview",
    exact: true,
    Component: lazy(() => import("./pages/OverviewPanel")),
  },
  {
    path: "/reports",
    label: "Reports",
    Component: lazy(() => import("./pages/ReportsPanel")),
  },
  {
    path: "/settings",
    label: "Settings",
    Component: lazy(() => import("./pages/SettingsPanel")),
  },
];
