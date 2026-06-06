import { Link, Route, Routes } from "react-router-dom";

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

      <Routes>
        <Route
          index
          element={
            <section className="react-remote__panel">
              <strong>42</strong>
              <span>federated React widgets loaded</span>
            </section>
          }
        />
        <Route
          path="settings"
          element={
            <section className="react-remote__panel">
              <strong>Shared lifecycle</strong>
              <span>Unmount is handled by the host boundary.</span>
            </section>
          }
        />
      </Routes>
    </div>
  );
}
