import { lazy, type ComponentType } from "react";

interface ReactRemoteRouteBase {
  label: string;
  Component: ComponentType;
}

interface ReactRemoteIndexRoute extends ReactRemoteRouteBase {
  index: true;
  path?: never;
}

interface ReactRemotePathRoute extends ReactRemoteRouteBase {
  index?: false;
  path: string;
}

export type ReactRemoteRoute = ReactRemoteIndexRoute | ReactRemotePathRoute;

export const reactRemoteRoutes: ReactRemoteRoute[] = [
  {
    index: true,
    label: "Overview",
    Component: lazy(() => import("./pages/OverviewPage")),
  },
  {
    path: "settings",
    label: "Settings",
    Component: lazy(() => import("./pages/SettingsPage")),
  },
];
