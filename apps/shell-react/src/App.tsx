import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { createRemotePreloader, RemoteAppBoundary } from "@federlet/react-shell";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import type { RemotePreloader } from "@federlet/react-shell";
import { remoteRoutes } from "./remote-routes";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

/**
 * Shell 首页，展示当前已登记的 remote 入口。
 */
function HomePage({
  onPreloadRoute,
  routes,
}: {
  onPreloadRoute: (route: RemoteRouteConfig) => void;
  routes: RemoteRouteConfig[];
}) {
  return (
    <main className="home">
      <p className="eyebrow">Rspack Module Federation</p>
      <h1>React Shell for mixed-framework remotes</h1>
      <p>
        The shell owns global layout and routing while each remote exposes a
        framework-neutral mount lifecycle.
      </p>

      <div className="remote-grid">
        {routes.map((route) => (
          <Link
            key={route.id}
            to={route.basename}
            className="remote-card"
            onFocus={() => onPreloadRoute(route)}
            onMouseEnter={() => onPreloadRoute(route)}
          >
            <span>{route.title}</span>
            <strong>{route.remoteName}</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}

function PreloadedRemoteRoute({
  preloadRoute,
  route,
}: {
  preloadRoute: (route: RemoteRouteConfig) => Promise<void>;
  route: RemoteRouteConfig;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void preloadRoute(route).finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [preloadRoute, route]);

  if (!ready) {
    return <main className="home">Loading remote routes...</main>;
  }

  return <RemoteAppBoundary route={route} />;
}

/**
 * 创建远程路由元素
 * @param route 远程路由配置
 * @returns 远程路由元素
 */
export function createRemoteRouteElement(
  route: RemoteRouteConfig,
  preloadRoute?: (route: RemoteRouteConfig) => Promise<void>,
) {
  if (preloadRoute) {
    return (
      <PreloadedRemoteRoute
        key={route.id}
        route={route}
        preloadRoute={preloadRoute}
      />
    );
  }

  return <RemoteAppBoundary key={route.id} route={route} />;
}

/**
 * Shell 根组件。
 *
 * 负责全局布局、导航高亮和把 remote 路由交给 `RemoteAppBoundary` 挂载。
 */
export function App() {
  const [routes, setRoutes] = useState<RemoteRouteConfig[]>(remoteRoutes);
  const [routesReady, setRoutesReady] = useState(false);
  const [remotePreloader] = useState<RemotePreloader>(() =>
    createRemotePreloader(),
  );
  const remoteRouteElements = routesReady ? routes : [];

  const preloadRemoteRoute = useCallback(
    async (route: RemoteRouteConfig) => {
      try {
        await remotePreloader.preload(route);
      } catch (error) {
        console.error(`Failed to preload remote ${route.id}`, error);
      }
    },
    [remotePreloader],
  );

  useEffect(() => {
    let cancelled = false;

    void loadRuntimeRemoteRoutes({ fallbackRoutes: remoteRoutes }).then(
      (runtimeRoutes) => {
        if (!cancelled) {
          setRoutes(runtimeRoutes);
          setRoutesReady(true);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <Link to="/" className="shell__brand">
          Federlet
        </Link>
        <nav>
          {routes.map((route) => (
            <NavLink
              key={route.id}
              to={route.basename}
              onFocus={() => {
                void preloadRemoteRoute(route);
              }}
              onMouseEnter={() => {
                void preloadRemoteRoute(route);
              }}
              className={({ isActive }) =>
                isActive
                  ? "shell__nav-link shell__nav-link--active"
                  : "shell__nav-link"
              }
            >
              {route.title}
            </NavLink>
          ))}
        </nav>
      </aside>

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              routes={routes}
              onPreloadRoute={(route) => {
                void preloadRemoteRoute(route);
              }}
            />
          }
        />
        {remoteRouteElements.map((route) => (
          <Route
            key={route.id}
            path={route.path}
            element={createRemoteRouteElement(route, preloadRemoteRoute)}
          />
        ))}
        <Route
          path="*"
          element={
            routesReady ? (
              <Navigate to="/" replace />
            ) : (
              <main className="home">Loading remote routes...</main>
            )
          }
        />
      </Routes>
    </div>
  );
}
