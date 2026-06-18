import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { RemoteAppBoundary } from "./RemoteAppBoundary";
import { remoteRoutes } from "./remote-routes";

/**
 * Shell 首页，展示当前已登记的 remote 入口。
 */
function HomePage() {
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
