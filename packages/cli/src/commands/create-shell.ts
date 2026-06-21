import { access } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonFile, writeTextFile } from "../utils/file-system.js";
import {
  ensureSupportedShellFramework,
  toMfName,
  toPackageName,
  type ShellFramework,
} from "../utils/names.js";

export interface CreateShellOptions {
  framework: ShellFramework;
  name: string;
  port: number;
  workspaceRoot: string;
}

async function assertDoesNotExist(path: string) {
  try {
    await access(path);
  } catch {
    return;
  }

  throw new Error(`Target directory already exists: ${path}`);
}

function packageJson(options: CreateShellOptions) {
  const isVue = options.framework === "vue";

  return {
    name: toPackageName(options.name),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "node ../../scripts/run-with-tsx.mjs rspack serve --config rspack.config.ts",
      "dev:rsbuild": "rsbuild dev --config rsbuild.config.ts",
      "dev:vite": "node ../../scripts/run-with-tsx.mjs vite --config vite.config.ts",
      "dev:webpack":
        "node ../../scripts/run-with-tsx.mjs webpack serve --mode development --config webpack.config.ts",
      build: "node ../../scripts/run-with-tsx.mjs rspack build --config rspack.config.ts",
      "build:rsbuild": "rsbuild build --config rsbuild.config.ts",
      "build:vite": "node ../../scripts/run-with-tsx.mjs vite build --config vite.config.ts",
      "build:webpack":
        "node ../../scripts/run-with-tsx.mjs webpack build --mode production --config webpack.config.ts",
      typecheck: isVue ? "vue-tsc --noEmit" : "tsc --noEmit",
      test: "node ../../scripts/run-with-tsx.mjs vitest run --passWithNoTests",
      lint: isVue ? "vue-tsc --noEmit" : "tsc --noEmit",
      clean: "rm -rf dist",
    },
    dependencies: isVue
      ? {
          "@federlet/mf-runtime": "workspace:*",
          "@federlet/shared-types": "workspace:*",
          "@federlet/vue-shell": "workspace:*",
          vue: "^3.5.25",
          "vue-router": "^4.6.3",
        }
      : {
          "@federlet/mf-runtime": "workspace:*",
          "@federlet/react-shell": "workspace:*",
          "@federlet/shared-types": "workspace:*",
          "@federlet/shared-ui": "workspace:*",
          antd: "5",
          react: "^19.2.1",
          "react-dom": "^19.2.1",
          "react-router-dom": "^7.9.6",
        },
    devDependencies: {
      "@federlet/rsbuild-config": "workspace:*",
      "@federlet/rspack-config": "workspace:*",
      "@federlet/tsconfig": "workspace:*",
      "@federlet/vite-config": "workspace:*",
      "@federlet/webpack-config": "workspace:*",
      ...(isVue ? { "vue-tsc": "^3.1.8" } : {}),
    },
  };
}

function tsconfig(framework: ShellFramework) {
  return `{
  "extends": "@federlet/tsconfig/${framework === "vue" ? "vue" : "react"}.json",
  "include": ["src", "*.config.ts"]
}
`;
}

function rspackConfig(options: CreateShellOptions) {
  const factory =
    options.framework === "vue" ? "createVueHostConfig" : "createReactHostConfig";

  return `import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { ${factory} } from "@federlet/rspack-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default ${factory}({
  appDir,
  name: "${toMfName(options.name)}",
  port: ${options.port},
  publicPath: "/",
  remotes: {},
  shared: {},
});
`;
}

function proxyConfig(
  tool: "vite" | "rsbuild" | "webpack",
  options: CreateShellOptions,
) {
  const factory =
    options.framework === "vue" ? "createVueHostConfig" : "createReactHostConfig";

  return `import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { ${factory} } from "@federlet/${tool}-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default ${factory}({
  appDir,
  name: "${toMfName(options.name)}",
  port: ${options.port},
  publicPath: "/",
  remotes: {},
  shared: {},
});
`;
}

function apolloConfig() {
  return `import type { FederletRuntimeEnvironment } from "@federlet/shared-types";

export const DEFAULT_APOLLO_RUNTIME_CONFIG: FederletRuntimeEnvironment = {
  manifest: {
    remotes: [
    ],
  },
  remoteSourcePolicy: {
    allowLocalhost: false,
    allowedOrigins: [
    ],
    enforceHttps: true,
  },
  runtimeEnv: "local",
};
`;
}

function reactFiles() {
  return {
    "src/App.tsx": `import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { runtimeRemoteRegistry } from "@federlet/mf-runtime";
import { createRemotePreloader, RemoteAppBoundary } from "@federlet/react-shell";
import type { RemoteLoadOptions } from "@federlet/mf-runtime";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { remoteRoutes } from "./remote-routes";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

const REMOTE_LOAD_OPTIONS: RemoteLoadOptions = {
  registry: runtimeRemoteRegistry,
};

export function App() {
  const [routes, setRoutes] = useState<RemoteRouteConfig[]>(remoteRoutes);
  const [remotePreloader] = useState(() =>
    createRemotePreloader({ loadOptions: REMOTE_LOAD_OPTIONS }),
  );

  useEffect(() => {
    void loadRuntimeRemoteRoutes({ fallbackRoutes: remoteRoutes }).then(setRoutes);
  }, []);

  return (
    <div className="shell">
      <aside>
        <Link to="/">Federlet</Link>
        <nav>
          {routes.map((route) => (
            <NavLink key={route.id} to={route.basename}>
              {route.title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <Routes>
        <Route path="/" element={<main>Generated Federlet Shell</main>} />
        {routes.map((route) => (
          <Route
            key={route.id}
            path={route.path}
            element={
              <RemoteAppBoundary
                route={route}
                loadOptions={REMOTE_LOAD_OPTIONS}
              />
            }
          />
        ))}
      </Routes>
    </div>
  );
}
`,
    "src/bootstrap.tsx": `import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
`,
    "src/main.tsx": `import("./bootstrap");
`,
  };
}

function vueFiles() {
  return {
    "src/App.vue": `<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { runtimeRemoteRegistry } from "@federlet/mf-runtime";
import { createRemotePreloader, RemoteAppBoundary } from "@federlet/vue-shell";
import type { RemoteLoadOptions } from "@federlet/mf-runtime";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { remoteRoutes } from "./remote-routes";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

const routes = ref<RemoteRouteConfig[]>(remoteRoutes);
const REMOTE_LOAD_OPTIONS: RemoteLoadOptions = {
  registry: runtimeRemoteRegistry,
};
createRemotePreloader({ loadOptions: REMOTE_LOAD_OPTIONS });

onMounted(async () => {
  routes.value = await loadRuntimeRemoteRoutes({ fallbackRoutes: remoteRoutes });
});
</script>

<template>
  <div class="shell">
    <aside>
      <RouterLink to="/">Federlet</RouterLink>
      <nav>
        <RouterLink
          v-for="route in routes"
          :key="route.id"
          :to="route.basename"
        >
          {{ route.title }}
        </RouterLink>
      </nav>
    </aside>
    <main>
      <RemoteAppBoundary
        v-if="routes[0]"
        :route="routes[0]"
        :load-options="REMOTE_LOAD_OPTIONS"
      />
    </main>
  </div>
</template>
`,
    "src/env.d.ts": `declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}
`,
    "src/main.ts": `import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import "./styles.css";

const router = createRouter({
  history: createWebHistory("/"),
  routes: [{ path: "/:pathMatch(.*)*", component: App }],
});

createApp(App).use(router).mount("#root");
`,
  };
}

function sharedFiles() {
  return {
    "src/config/apollo.ts": apolloConfig(),
    "src/remote-routes.ts": `import { DEFAULT_APOLLO_RUNTIME_CONFIG } from "./config/apollo";
import { createRemoteRoutesFromManifest } from "./runtime-manifest";

export const remoteRoutes = DEFAULT_APOLLO_RUNTIME_CONFIG.manifest
  ? createRemoteRoutesFromManifest(DEFAULT_APOLLO_RUNTIME_CONFIG.manifest)
  : [];
`,
    "src/runtime-manifest.ts": `import {
  bootstrapRuntimeRemoteRegistry,
  createRemoteDefinitionsFromManifest,
  registerRuntimeRemoteEntries,
} from "@federlet/mf-runtime";
import type {
  FederletRuntimeEnvironment,
  RemoteRouteConfig,
  RuntimeRemoteManifest,
} from "@federlet/shared-types";

export const SHELL_REMOTE_PROTOCOL_VERSION = "1";

interface LoadRuntimeRemoteRoutesOptions {
  fallbackRoutes: RemoteRouteConfig[];
  registerRemoteEntries?: typeof registerRuntimeRemoteEntries;
  runtimeEnv?: FederletRuntimeEnvironment;
}

function getRuntimeEnvironment(): FederletRuntimeEnvironment {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__FEDERLET_ENV__ ?? {};
}

function toRemoteRoute(route: RemoteRouteConfig): RemoteRouteConfig {
  return {
    basename: route.basename,
    exposedModule: route.exposedModule,
    id: route.id,
    path: route.path,
    remoteName: route.remoteName,
    title: route.title,
  };
}

export function createRemoteRoutesFromManifest(
  manifest: RuntimeRemoteManifest,
): RemoteRouteConfig[] {
  return createRemoteDefinitionsFromManifest(
    manifest,
    SHELL_REMOTE_PROTOCOL_VERSION,
  ).map(toRemoteRoute);
}

export async function loadRuntimeRemoteRoutes({
  fallbackRoutes,
  registerRemoteEntries = registerRuntimeRemoteEntries,
  runtimeEnv = getRuntimeEnvironment(),
}: LoadRuntimeRemoteRoutesOptions): Promise<RemoteRouteConfig[]> {
  return bootstrapRuntimeRemoteRegistry({
    fallbackRoutes,
    manifest: runtimeEnv.manifest,
    registerRemoteEntries,
    runtimeEnv: runtimeEnv.runtimeEnv,
    sourcePolicy: runtimeEnv.remoteSourcePolicy,
    shellProtocolVersion: SHELL_REMOTE_PROTOCOL_VERSION,
  });
}
`,
    "src/styles.css": `.shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 240px 1fr;
}
`,
  };
}

export async function createShell(options: CreateShellOptions) {
  ensureSupportedShellFramework(options.framework);

  const appDir = join(options.workspaceRoot, "apps", options.name);
  await assertDoesNotExist(appDir);
  await writeJsonFile(join(appDir, "package.json"), packageJson(options));
  await writeTextFile(join(appDir, "tsconfig.json"), tsconfig(options.framework));
  await writeTextFile(join(appDir, "rspack.config.ts"), rspackConfig(options));
  await writeTextFile(join(appDir, "vite.config.ts"), proxyConfig("vite", options));
  await writeTextFile(join(appDir, "rsbuild.config.ts"), proxyConfig("rsbuild", options));
  await writeTextFile(join(appDir, "webpack.config.ts"), proxyConfig("webpack", options));

  const files = {
    ...sharedFiles(),
    ...(options.framework === "vue" ? vueFiles() : reactFiles()),
  };

  for (const [path, content] of Object.entries(files)) {
    await writeTextFile(join(appDir, path), content);
  }

  return {
    appDir,
    shellName: toMfName(options.name),
  };
}
