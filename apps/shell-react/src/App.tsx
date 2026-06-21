import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  createEventBus,
  validateFederletEventPayload,
} from "@federlet/mf-runtime";
import {
  createRemotePreloader,
  RemoteAppBoundary,
} from "@federlet/react-shell";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import type { MicroEventBus } from "@federlet/shared-types";
import type { RemotePreloader } from "@federlet/react-shell";
import { remoteRoutes } from "./remote-routes";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

interface FederletSandboxRiskState {
  clickCount?: number;
  intervalId?: number;
  rafFired?: boolean;
  seckillRemainingSeconds?: number;
  source?: string;
  timeoutFired?: boolean;
  ticks?: number;
}

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: FederletSandboxRiskState;
}

export interface SandboxRiskSnapshot {
  bodyNodeLeak: boolean;
  clickListenerCount: number;
  globalPollution: boolean;
  leakingTimer: boolean;
  rafFired: boolean;
  runtimeStyleLeak: boolean;
  source?: string;
  seckillRemainingSeconds?: number;
  timeoutFired: boolean;
  ticks: number;
}

export function readSandboxRiskSnapshot(): SandboxRiskSnapshot {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      bodyNodeLeak: false,
      clickListenerCount: 0,
      globalPollution: false,
      leakingTimer: false,
      rafFired: false,
      runtimeStyleLeak: false,
      seckillRemainingSeconds: undefined,
      timeoutFired: false,
      ticks: 0,
    };
  }

  const risk = (window as SandboxRiskWindow).__FEDERLET_SANDBOX_RISK__;

  return {
    bodyNodeLeak: Boolean(
      document.body.querySelector("[data-federlet-sandbox-risk='body-node']"),
    ),
    clickListenerCount: risk?.clickCount ?? 0,
    globalPollution: Boolean(risk),
    leakingTimer: risk?.intervalId !== undefined,
    rafFired: Boolean(risk?.rafFired),
    runtimeStyleLeak: Boolean(
      document.head.querySelector("[data-federlet-sandbox-risk='head-style']"),
    ),
    source: risk?.source,
    seckillRemainingSeconds: risk?.seckillRemainingSeconds,
    timeoutFired: Boolean(risk?.timeoutFired),
    ticks: risk?.ticks ?? 0,
  };
}

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
  const snapshot = readSandboxRiskSnapshot();
  const riskItems = [
    ["window global", snapshot.globalPollution, "Boundary: not cleaned"],
    [
      "active interval",
      snapshot.leakingTimer,
      "Sandbox should clear on unmount",
    ],
    [
      "window click listener",
      snapshot.clickListenerCount > 0,
      "Sandbox should remove on unmount",
    ],
    [
      "timeout fired",
      snapshot.timeoutFired,
      "Sandbox should cancel on unmount",
    ],
    ["raf fired", snapshot.rafFired, "Sandbox should cancel on unmount"],
    ["body node", snapshot.bodyNodeLeak, "Boundary: DOM escape only detected"],
    [
      "runtime style",
      snapshot.runtimeStyleLeak,
      "Boundary: CSS escape only detected",
    ],
  ] as const;

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

      <section className="sandbox-risk-panel">
        <p className="eyebrow">Sandbox comparison demo</p>
        <h2>Remote side effects visible from Shell</h2>
        <p>
          Trigger the Risk Lab in React Remote, then return here. Compare
          `/react/settings` with `/react-nosandbox/settings`: sandbox-on should
          clean timers, raf, and window listeners after unmount; DOM and runtime
          style escapes remain visible because they are outside the JS sandbox.
        </p>
        {snapshot.source ? <small>Last source: {snapshot.source}</small> : null}
        <dl>
          {riskItems.map(([label, detected, note]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={detected ? "is-detected" : undefined}>
                {detected ? "detected" : "clean"}
              </dd>
              <small>{note}</small>
            </div>
          ))}
          <div>
            <dt>interval ticks</dt>
            <dd className={snapshot.ticks > 0 ? "is-detected" : undefined}>
              {snapshot.ticks}
            </dd>
            <small>
              With sandbox on, this should stop increasing after unmount.
            </small>
          </div>
          <div>
            <dt>window click count</dt>
            <dd
              className={
                snapshot.clickListenerCount > 0 ? "is-detected" : undefined
              }
            >
              {snapshot.clickListenerCount}
            </dd>
            <small>
              With sandbox on, clicking Shell after unmount should not increase
              it.
            </small>
          </div>
          <div>
            <dt>seckill countdown</dt>
            <dd
              className={
                snapshot.seckillRemainingSeconds !== undefined
                  ? "is-detected"
                  : undefined
              }
            >
              {snapshot.seckillRemainingSeconds === undefined
                ? "not started"
                : `${snapshot.seckillRemainingSeconds}s`}
            </dd>
            <small>
              Start countdown in React/Umi remote, then leave. Sandbox-on should
              stop this value from changing after unmount.
            </small>
          </div>
        </dl>
      </section>
    </main>
  );
}

function PreloadedRemoteRoute({
  eventBus,
  preloadRoute,
  route,
}: {
  eventBus?: MicroEventBus;
  preloadRoute: (route: RemoteRouteConfig) => Promise<void>;
  route: RemoteRouteConfig;
}) {
  const [ready, setReady] = useState(false);
  const sandbox = shouldDisableSandboxForRoute(route) ? false : undefined;

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

  return (
    <RemoteAppBoundary
      route={route}
      sandbox={sandbox}
      createMountContext={
        eventBus ? createRemoteMountContextFactory(eventBus) : undefined
      }
    />
  );
}

/**
 * 创建远程路由元素
 * @param route 远程路由配置
 * @returns 远程路由元素
 */
export function createRemoteRouteElement(
  route: RemoteRouteConfig,
  preloadRoute?: (route: RemoteRouteConfig) => Promise<void>,
  eventBus?: MicroEventBus,
) {
  const createMountContext = eventBus
    ? createRemoteMountContextFactory(eventBus)
    : undefined;
  const sandbox = shouldDisableSandboxForRoute(route) ? false : undefined;

  if (preloadRoute) {
    return (
      <PreloadedRemoteRoute
        eventBus={eventBus}
        key={route.id}
        route={route}
        preloadRoute={preloadRoute}
      />
    );
  }

  return (
    <RemoteAppBoundary
      key={route.id}
      route={route}
      sandbox={sandbox}
      createMountContext={createMountContext}
    />
  );
}

function shouldDisableSandboxForRoute(route: RemoteRouteConfig) {
  return (
    route.id.endsWith("-nosandbox") || route.basename.endsWith("-nosandbox")
  );
}

function createRemoteMountContextFactory(eventBus: MicroEventBus) {
  return ({
    container,
    route,
  }: {
    container: HTMLElement;
    route: RemoteRouteConfig;
  }) => ({
    basename: route.basename,
    container,
    eventBus,
    onError(error: unknown) {
      console.error(`Remote runtime error from ${route.id}`, error);
    },
    props: {
      mountedAt: new Date().toISOString(),
    },
  });
}

function createShellEventBus() {
  return createEventBus({
    validatePayload: validateFederletEventPayload,
    onInvalidEvent(event) {
      console.warn(`Rejected federlet event ${event.eventName}`, event);
    },
  });
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
  const [eventBus] = useState<MicroEventBus>(() => createShellEventBus());
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
    const unsubscribeMounted = eventBus.on(
      "remote.lifecycle.mounted",
      (payload, meta) => {
        console.info("shell received remote.lifecycle.mounted", payload, meta);
      },
    );
    const unsubscribeUnmounted = eventBus.on(
      "remote.lifecycle.unmounted",
      (payload, meta) => {
        console.info(
          "shell received remote.lifecycle.unmounted",
          payload,
          meta,
        );
      },
    );

    return () => {
      unsubscribeMounted();
      unsubscribeUnmounted();
    };
  }, [eventBus]);

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
            element={createRemoteRouteElement(
              route,
              preloadRemoteRoute,
              eventBus,
            )}
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
