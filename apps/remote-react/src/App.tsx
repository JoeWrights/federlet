import { Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { reactRemoteRoutes } from "./routes";

/**
 * React remote 的示例页面。
 *
 * 这里保留局部路由，验证 remote 可以在 Shell 分配的 basename 下独立管理子页面。
 */
export function App() {
  return (
    <div className="react-remote">
      <p className="react-remote__eyebrow">React remote</p>
      <h1>Dashboard powered by React</h1>
      <p>
        This application is compiled independently by Rspack and mounted through
        a Module Federation lifecycle.
      </p>

      <nav className="react-remote__tabs">
        <Link to="">Overview</Link>
        <Link to="settings">Settings</Link>
      </nav>

      <Suspense
        fallback={<p className="react-remote__loading">Loading route...</p>}
      >
        <Routes>
          {reactRemoteRoutes.map((route) => {
            const RouteComponent = route.Component;

            return route.index ? (
              <Route key={route.label} index element={<RouteComponent />} />
            ) : (
              <Route
                key={route.path}
                path={route.path}
                element={<RouteComponent />}
              />
            );
          })}
        </Routes>
      </Suspense>
    </div>
  );
}
