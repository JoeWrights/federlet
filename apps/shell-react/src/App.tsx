import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { RemoteAppBoundary } from "./RemoteAppBoundary";
import { remoteRoutes } from "./remote-routes";

interface FederletSandboxRiskState {
  clickCount?: number;
  intervalId?: number;
  source?: string;
}

interface SandboxRiskWindow extends Window {
  __FEDERLET_SANDBOX_RISK__?: FederletSandboxRiskState;
}

export interface SandboxRiskSnapshot {
  bodyNodeLeak: boolean;
  clickListenerCount: number;
  globalPollution: boolean;
  leakingTimer: boolean;
  runtimeStyleLeak: boolean;
  source?: string;
}

export function readSandboxRiskSnapshot(): SandboxRiskSnapshot {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      bodyNodeLeak: false,
      clickListenerCount: 0,
      globalPollution: false,
      leakingTimer: false,
      runtimeStyleLeak: false,
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
    runtimeStyleLeak: Boolean(
      document.head.querySelector("[data-federlet-sandbox-risk='head-style']"),
    ),
    source: risk?.source,
  };
}

/**
 * Shell 首页，展示当前已登记的 remote 入口。
 */
function HomePage() {
  const snapshot = readSandboxRiskSnapshot();
  const riskItems = [
    ["window global", snapshot.globalPollution],
    ["leaking timer", snapshot.leakingTimer],
    ["window click listener", snapshot.clickListenerCount > 0],
    ["body node", snapshot.bodyNodeLeak],
    ["runtime style", snapshot.runtimeStyleLeak],
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
        {remoteRoutes.map((route) => (
          <Link key={route.id} to={route.basename} className="remote-card">
            <span>{route.title}</span>
            <strong>{route.remoteName}</strong>
          </Link>
        ))}
      </div>

      <section className="sandbox-risk-panel">
        <p className="eyebrow">No JS sandbox demo</p>
        <h2>Remote side effects visible from Shell</h2>
        <p>
          Trigger the Risk Lab in the React remote, then return here. Any
          detected item means the remote touched shared browser state directly.
        </p>
        {snapshot.source ? <small>Last source: {snapshot.source}</small> : null}
        <dl>
          {riskItems.map(([label, detected]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={detected ? "is-detected" : undefined}>
                {detected ? "detected" : "clean"}
              </dd>
            </div>
          ))}
          <div>
            <dt>window click count</dt>
            <dd>{snapshot.clickListenerCount}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

/**
 * 创建远程路由元素
 * @param route 远程路由配置
 * @returns 远程路由元素
 */
export function createRemoteRouteElement(route: RemoteRouteConfig) {
  return <RemoteAppBoundary key={route.id} route={route} />;
}

/**
 * Shell 根组件。
 *
 * 负责全局布局、导航高亮和把 remote 路由交给 `RemoteAppBoundary` 挂载。
 */
export function App() {
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <Link to="/" className="shell__brand">
          Federlet
        </Link>
        <nav>
          {remoteRoutes.map((route) => (
            <NavLink
              key={route.id}
              to={route.basename}
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
        <Route path="/" element={<HomePage />} />
        {remoteRoutes.map((route) => (
          <Route
            key={route.id}
            path={route.path}
            element={createRemoteRouteElement(route)}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
