import { access } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonFile, writeTextFile } from "../utils/file-system.js";
import {
  ensureSupportedFramework,
  normalizeRoute,
  routeToPath,
  toMfName,
  toPackageName,
  toTitle,
  type Framework,
} from "../utils/names.js";

export interface CreateRemoteOptions {
  framework: Framework;
  name: string;
  port: number;
  route: string;
  title?: string;
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

function createPackageJson(options: CreateRemoteOptions) {
  const isVue = options.framework === "vue";
  const isUmi = options.framework === "umi";

  return {
    name: toPackageName(options.name),
    version: "0.1.0",
    private: true,
    ...(isUmi ? {} : { type: "module" }),
    scripts: isUmi
      ? {
          dev: "NODE_OPTIONS=--openssl-legacy-provider umi dev",
          build: "NODE_OPTIONS=--openssl-legacy-provider umi build",
          typecheck: "tsc --noEmit",
          test: "vitest run --passWithNoTests",
          lint: "tsc --noEmit",
          clean: "rm -rf dist .umi .umi-production",
        }
      : {
          dev: "node ../../scripts/run-with-tsx.mjs rspack serve --config rspack.config.ts",
          "dev:rsbuild": isVue
            ? "rsbuild dev --config rsbuild.config.ts"
            : "rsbuild dev --config rsbuild.config.ts",
          "dev:vite": "node ../../scripts/run-with-tsx.mjs vite --config vite.config.ts",
          "dev:webpack":
            "node ../../scripts/run-with-tsx.mjs webpack serve --mode development --config webpack.config.ts",
          build:
            options.framework === "react"
              ? "FEDERLET_PROVIDE_SHARED_UI=false node ../../scripts/run-with-tsx.mjs rspack build --config rspack.config.ts"
              : "node ../../scripts/run-with-tsx.mjs rspack build --config rspack.config.ts",
          "build:rsbuild": "rsbuild build --config rsbuild.config.ts",
          "build:vite": "node ../../scripts/run-with-tsx.mjs vite build --config vite.config.ts",
          "build:webpack":
            "node ../../scripts/run-with-tsx.mjs webpack build --mode production --config webpack.config.ts",
          typecheck: isVue ? "vue-tsc --noEmit" : "tsc --noEmit",
          test: "node ../../scripts/run-with-tsx.mjs vitest run --passWithNoTests",
          lint: isVue ? "vue-tsc --noEmit" : "tsc --noEmit",
          clean: "rm -rf dist",
        },
    dependencies: isUmi
      ? {
          "@federlet/shared-types": "workspace:*",
          antd: "5",
          react: "17.0.2",
          "react-dom": "17.0.2",
          "react-router-dom": "5",
          umi: "3.5.43",
        }
      : isVue
        ? {
            "@federlet/shared-types": "workspace:*",
            "@federlet/style-isolation": "workspace:*",
            vue: "^3.5.25",
            "vue-router": "^4.6.3",
          }
        : {
            "@federlet/shared-types": "workspace:*",
            "@federlet/shared-ui": "workspace:*",
            "@federlet/style-isolation": "workspace:*",
            antd: "5",
            react: "^19.2.1",
            "react-dom": "^19.2.1",
            "react-router-dom": "^7.9.6",
          },
    devDependencies: isUmi
      ? {
          "@federlet/tsconfig": "workspace:*",
          "@types/react": "17.0.83",
          "@types/react-dom": "17.0.26",
          "@types/react-router-dom": "5",
        }
      : {
          "@federlet/rsbuild-config": "workspace:*",
          "@federlet/rspack-config": "workspace:*",
          "@federlet/tsconfig": "workspace:*",
          "@federlet/vite-config": "workspace:*",
          "@federlet/webpack-config": "workspace:*",
          ...(isVue ? { "vue-tsc": "^3.1.8" } : {}),
        },
  };
}

function tsconfig(framework: Framework) {
  return `{
  "extends": "@federlet/tsconfig/${framework === "vue" ? "vue" : "react"}.json",
  "include": ["src", "*.config.ts"]
}
`;
}

function rspackConfig(options: CreateRemoteOptions) {
  const remoteName = toMfName(options.name);
  const factory =
    options.framework === "vue" ? "createVueRemoteConfig" : "createReactRemoteConfig";
  const importName =
    options.framework === "vue" ? "createVueRemoteConfig" : "createReactRemoteConfig";
  const mountFile = options.framework === "vue" ? "mount.ts" : "mount.tsx";

  return `import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { ${importName} } from "@federlet/rspack-config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default ${factory}({
  appDir,
  name: "${remoteName}",
  port: ${options.port},
  exposes: {
    "./mount": "./src/${mountFile}",
  },
  shared: ${options.framework === "vue" ? "false" : "{}"},
});
`;
}

function proxyConfig(tool: "vite" | "rsbuild" | "webpack", options: CreateRemoteOptions) {
  const factory =
    options.framework === "vue" ? "createVueRemoteConfig" : "createReactRemoteConfig";
  const mountFile = options.framework === "vue" ? "mount.ts" : "mount.tsx";
  const packageName = `@federlet/${tool}-config`;

  return `import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { ${factory} } from "${packageName}";

const appDir = dirname(fileURLToPath(import.meta.url));

export default ${factory}({
  appDir,
  name: "${toMfName(options.name)}",
  port: ${options.port},
  exposes: {
    "./mount": "./src/${mountFile}",
  },
});
`;
}

function reactFiles(options: CreateRemoteOptions) {
  const remoteName = toMfName(options.name);
  const title = options.title ?? toTitle(options.name);

  return {
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
    "src/App.tsx": `interface AppProps {
  portalContainer?: HTMLElement;
}

export function App({ portalContainer }: AppProps) {
  return (
    <div
      className="remote-app"
      data-portal-container={portalContainer ? "provided" : "standalone"}
    >
      <p className="remote-app__eyebrow">${remoteName}</p>
      <h1>${title}</h1>
      <p>Generated Federlet React remote.</p>
    </div>
  );
}
`,
    "src/bootstrap.tsx": `import { createRemoteScopeClass } from "@federlet/style-isolation/scope";
import { mount, REMOTE_NAME } from "./mount";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

rootElement.classList.add(createRemoteScopeClass(REMOTE_NAME));

// Standalone dev mode reuses the same mount contract as the shell integration.
mount({
  basename: "/",
  container: rootElement,
});
`,
    "src/main.tsx": `// Async bootstrap keeps React shared initialization compatible with Module Federation.
import("./bootstrap");
`,
    "src/mount.tsx": `import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { MicroAppContext, MicroAppInstance } from "@federlet/shared-types";
import { App } from "./App";
import { createRemoteEventBusLifecycle } from "./remote-event-bus";
import "./styles.css";

export const REMOTE_NAME = "${remoteName}";

export function mount(context: MicroAppContext): MicroAppInstance {
  let root: Root | null = createRoot(context.container, {
    onCaughtError(error) {
      context.onError?.(error);
    },
    onUncaughtError(error) {
      context.onError?.(error);
    },
  });
  const eventBusLifecycle = createRemoteEventBusLifecycle(context, REMOTE_NAME);

  try {
    root.render(
      <BrowserRouter basename={context.basename}>
        <App portalContainer={context.container} />
      </BrowserRouter>,
    );
  } catch (error) {
    root.unmount();
    root = null;
    throw error;
  }

  try {
    eventBusLifecycle.notifyMounted();
  } catch (error) {
    root.unmount();
    root = null;
    throw error;
  }

  return {
    unmount() {
      eventBusLifecycle.cleanup();
      try {
        eventBusLifecycle.notifyUnmounted();
      } finally {
        root?.unmount();
        root = null;
      }
    },
  };
}
`,
    "src/remote-event-bus.ts": `import type { MicroAppContext } from "@federlet/shared-types";

export function createRemoteEventBusLifecycle(
  context: MicroAppContext,
  remoteName: string,
) {
  let unsubscribeAuthSession: (() => void) | undefined;

  function cleanup() {
    unsubscribeAuthSession?.();
    unsubscribeAuthSession = undefined;
  }

  function notifyMounted() {
    unsubscribeAuthSession = context.eventBus?.on(
      "auth.session.updated",
      (payload, meta) => {
        console.info(
          \`\${remoteName} received auth.session.updated\`,
          payload,
          meta,
        );
      },
    );

    try {
      context.eventBus?.emit(
        "remote.lifecycle.mounted",
        {
          basename: context.basename,
          remoteName,
        },
        {
          source: remoteName,
        },
      );
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  function notifyUnmounted() {
    context.eventBus?.emit(
      "remote.lifecycle.unmounted",
      {
        basename: context.basename,
        remoteName,
      },
      {
        source: remoteName,
      },
    );
  }

  return {
    cleanup,
    notifyMounted,
    notifyUnmounted,
  };
}
`,
    "src/styles.css": `.remote-app {
  padding: 32px;
}

.remote-app__eyebrow {
  color: #2563eb;
  font-weight: 700;
}
`,
  };
}

function vueFiles(options: CreateRemoteOptions) {
  const remoteName = toMfName(options.name);
  const title = options.title ?? toTitle(options.name);

  return {
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
    "src/App.vue": `<template>
  <div class="remote-app">
    <p class="remote-app__eyebrow">${remoteName}</p>
    <h1>${title}</h1>
    <p>Generated Federlet Vue remote.</p>
  </div>
</template>
`,
    "src/env.d.ts": `declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}
`,
    "src/main.ts": `import("./mount");
`,
    "src/mount.ts": `import { createApp, type App as VueApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import type { MicroAppContext, MicroAppInstance } from "@federlet/shared-types";
import App from "./App.vue";
import "./styles.css";

export const REMOTE_NAME = "${remoteName}";

export function mount(context: MicroAppContext): MicroAppInstance {
  let app: VueApp<Element> | null = createApp(App);
  const router = createRouter({
    history: createWebHistory(context.basename),
    routes: [{ path: "/", component: App }],
  });

  app.use(router);
  app.mount(context.container);
  context.eventBus?.emit("remote.lifecycle.mounted", {
    basename: context.basename,
    remoteName: REMOTE_NAME,
  }, {
    source: REMOTE_NAME,
  });

  return {
    unmount() {
      context.eventBus?.emit("remote.lifecycle.unmounted", {
        basename: context.basename,
        remoteName: REMOTE_NAME,
      }, {
        source: REMOTE_NAME,
      });
      app?.unmount();
      app = null;
    },
  };
}
`,
    "src/styles.css": `.remote-app {
  padding: 32px;
}

.remote-app__eyebrow {
  color: #16a34a;
  font-weight: 700;
}
`,
  };
}

function umiFiles(options: CreateRemoteOptions) {
  const remoteName = toMfName(options.name);
  const title = options.title ?? toTitle(options.name);

  return {
    ".umirc.ts": `import { ModuleFederationPlugin } from "@module-federation/enhanced/webpack";

export default {
  chainWebpack(config: any) {
    config.plugin("module-federation").use(ModuleFederationPlugin, [{
      name: "${remoteName}",
      filename: "remoteEntry.js",
      exposes: {
        "./mount": "./src/mount.tsx",
      },
      shared: {},
    }]);
  },
};
`,
    "src/App.tsx": `export default function App() {
  return (
    <div className="remote-app">
      <p>${remoteName}</p>
      <h1>${title}</h1>
      <p>Generated Federlet Umi legacy remote.</p>
    </div>
  );
}
`,
    "src/mount.tsx": `import React from "react";
import ReactDOM from "react-dom";
import type { MicroAppContext, MicroAppInstance } from "@federlet/shared-types";
import App from "./App";

export const REMOTE_NAME = "${remoteName}";

export function mount(context: MicroAppContext): MicroAppInstance {
  ReactDOM.render(<App />, context.container);

  return {
    unmount() {
      ReactDOM.unmountComponentAtNode(context.container);
    },
  };
}
`,
  };
}

export async function createRemote(options: CreateRemoteOptions) {
  ensureSupportedFramework(options.framework);

  const appDir = join(options.workspaceRoot, "apps", options.name);
  await assertDoesNotExist(appDir);
  await writeJsonFile(join(appDir, "package.json"), createPackageJson(options));
  await writeTextFile(join(appDir, "tsconfig.json"), tsconfig(options.framework));

  if (options.framework !== "umi") {
    await writeTextFile(join(appDir, "rspack.config.ts"), rspackConfig(options));
    await writeTextFile(join(appDir, "vite.config.ts"), proxyConfig("vite", options));
    await writeTextFile(join(appDir, "rsbuild.config.ts"), proxyConfig("rsbuild", options));
    await writeTextFile(join(appDir, "webpack.config.ts"), proxyConfig("webpack", options));
  }

  const files =
    options.framework === "vue"
      ? vueFiles(options)
      : options.framework === "umi"
        ? umiFiles(options)
        : reactFiles(options);

  for (const [path, content] of Object.entries(files)) {
    await writeTextFile(join(appDir, path), content);
  }

  return {
    appDir,
    basename: normalizeRoute(options.route),
    path: routeToPath(options.route),
    remoteName: toMfName(options.name),
  };
}
