import React, { Suspense } from "react";
import { NavLink, Route, Switch } from "./router-compat";
import { RemoteAppProvider } from "./RemoteAppContext";
import { umiRemoteRoutes } from "./routes";
import "./styles.css";

interface RemoteAppProps {
  basename: string;
  mountedAt?: string;
  portalContainer?: HTMLElement;
}

export function RemoteApp({
  basename,
  mountedAt,
  portalContainer,
}: RemoteAppProps) {
  return (
    <RemoteAppProvider portalContainer={portalContainer}>
      <main className="umi-remote">
        <p className="umi-remote__eyebrow">Umi 3 remote</p>
        <h1>Umi React app mounted by Shell</h1>
        <p>
          This remote is built by Umi 3 with Webpack 5 and keeps its React 17
          runtime isolated from the React 19 Shell.
        </p>

        <section className="umi-remote__grid">
          <article>
            <span>Base path</span>
            <strong>{basename}</strong>
          </article>
          <article>
            <span>Mount mode</span>
            <strong>Module Federation</strong>
          </article>
          <article>
            <span>React runtime</span>
            <strong>17.0.2 bundled locally</strong>
          </article>
        </section>

        <nav className="umi-remote__tabs">
          {umiRemoteRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              exact={route.exact}
              activeClassName="umi-remote__tab--active"
              className="umi-remote__tab"
            >
              {route.label}
            </NavLink>
          ))}
        </nav>

        <Suspense fallback={<p className="umi-remote__loading">Loading route...</p>}>
          <Switch>
            {umiRemoteRoutes.map((route) => {
              const RouteComponent = route.Component;

              return (
                <Route key={route.path} path={route.path} exact={route.exact}>
                  <RouteComponent />
                </Route>
              );
            })}
          </Switch>
        </Suspense>

        {mountedAt ? (
          <p className="umi-remote__footnote">Mounted at {mountedAt}</p>
        ) : null}
      </main>
    </RemoteAppProvider>
  );
}
