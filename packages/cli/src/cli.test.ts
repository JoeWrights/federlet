import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createRemote } from "./commands/create-remote";
import { createShell } from "./commands/create-shell";
import { registerRemote } from "./commands/register-remote";
import { run } from "./index";

async function createWorkspace() {
  return mkdtemp(join(tmpdir(), "federlet-cli-"));
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

describe("createRemote", () => {
  it("generates a React remote that exposes the Federlet mount contract", async () => {
    const workspaceRoot = await createWorkspace();

    await createRemote({
      framework: "react",
      name: "remote-orders",
      port: 3010,
      route: "/orders",
      title: "Orders",
      workspaceRoot,
    });

    const packageJson = await readJson(
      join(workspaceRoot, "apps/remote-orders/package.json"),
    );
    const mount = await readFile(
      join(workspaceRoot, "apps/remote-orders/src/mount.tsx"),
      "utf8",
    );
    const main = await readFile(
      join(workspaceRoot, "apps/remote-orders/src/main.tsx"),
      "utf8",
    );
    const bootstrap = await readFile(
      join(workspaceRoot, "apps/remote-orders/src/bootstrap.tsx"),
      "utf8",
    );
    const indexHtml = await readFile(
      join(workspaceRoot, "apps/remote-orders/index.html"),
      "utf8",
    );
    const remoteEventBus = await readFile(
      join(workspaceRoot, "apps/remote-orders/src/remote-event-bus.ts"),
      "utf8",
    );
    const rspackConfig = await readFile(
      join(workspaceRoot, "apps/remote-orders/rspack.config.ts"),
      "utf8",
    );
    const viteConfig = await readFile(
      join(workspaceRoot, "apps/remote-orders/vite.config.ts"),
      "utf8",
    );
    const rsbuildConfig = await readFile(
      join(workspaceRoot, "apps/remote-orders/rsbuild.config.ts"),
      "utf8",
    );
    const webpackConfig = await readFile(
      join(workspaceRoot, "apps/remote-orders/webpack.config.ts"),
      "utf8",
    );

    expect(packageJson.name).toBe("@federlet/remote-orders");
    expect(indexHtml).toContain('<div id="root"></div>');
    expect(main).toContain('import("./bootstrap")');
    expect(bootstrap).toContain("createRemoteScopeClass(REMOTE_NAME)");
    expect(bootstrap).toContain("mount({");
    expect(mount).toContain("export function mount(context: MicroAppContext)");
    expect(mount).toContain("createRoot(context.container, {");
    expect(mount).toContain("onCaughtError(error)");
    expect(mount).toContain("createRemoteEventBusLifecycle(context, REMOTE_NAME)");
    expect(mount).toContain("<App portalContainer={context.container} />");
    expect(remoteEventBus).toContain("createRemoteEventBusLifecycle");
    expect(rspackConfig).toContain('name: "remote_orders"');
    expect(rspackConfig).toContain("port: 3010");
    expect(rspackConfig).toContain('"./mount": "./src/mount.tsx"');
    expect(viteConfig).not.toContain("shared:");
    expect(rsbuildConfig).not.toContain("shared:");
    expect(webpackConfig).not.toContain("shared:");
  });
});

describe("createShell", () => {
  it("generates a React shell with runtime manifest wiring", async () => {
    const workspaceRoot = await createWorkspace();

    await createShell({
      framework: "react",
      name: "shell-admin",
      port: 3100,
      workspaceRoot,
    });

    const packageJson = await readJson(
      join(workspaceRoot, "apps/shell-admin/package.json"),
    );
    const apolloConfig = await readFile(
      join(workspaceRoot, "apps/shell-admin/src/config/apollo.ts"),
      "utf8",
    );
    const rspackConfig = await readFile(
      join(workspaceRoot, "apps/shell-admin/rspack.config.ts"),
      "utf8",
    );

    expect(packageJson.name).toBe("@federlet/shell-admin");
    expect(apolloConfig).toContain("DEFAULT_APOLLO_RUNTIME_CONFIG");
    expect(apolloConfig).toContain("remoteSourcePolicy");
    expect(rspackConfig).toContain('name: "shell_admin"');
    expect(rspackConfig).toContain("port: 3100");
    expect(rspackConfig).toContain("remotes: {}");
  });
});

describe("registerRemote", () => {
  it("registers a remote in the local Apollo mock and source policy", async () => {
    const workspaceRoot = await createWorkspace();
    const configPath = join(
      workspaceRoot,
      "apps/shell-react/src/config/apollo.ts",
    );
    await mkdir(join(workspaceRoot, "apps/shell-react/src/config"), {
      recursive: true,
    });
    await writeFile(
      configPath,
      `export const DEFAULT_APOLLO_RUNTIME_CONFIG = {
  manifest: {
    remotes: [
    ],
  },
  remoteSourcePolicy: {
    allowedOrigins: [
    ],
  },
};
`,
      "utf8",
    );

    await registerRemote({
      basename: "/orders",
      entryBaseUrl: "http://localhost:3010",
      id: "orders",
      path: "/orders/*",
      remoteName: "remote_orders",
      shell: "react",
      title: "Orders",
      workspaceRoot,
    });

    const updated = await readFile(configPath, "utf8");

    expect(updated).toContain('id: "orders"');
    expect(updated).toContain('remoteName: "remote_orders"');
    expect(updated).toContain('entryBaseUrl: "http://localhost:3010/"');
    expect(updated).toContain('"http://localhost:3010"');
  });

  it("rejects duplicate remote ids before modifying the manifest", async () => {
    const workspaceRoot = await createWorkspace();
    const configPath = join(
      workspaceRoot,
      "apps/shell-react/src/config/apollo.ts",
    );
    await mkdir(join(workspaceRoot, "apps/shell-react/src/config"), {
      recursive: true,
    });
    const original = `export const DEFAULT_APOLLO_RUNTIME_CONFIG = {
  manifest: {
    remotes: [
      {
        id: "orders",
        path: "/orders/*",
        title: "Orders",
        remoteName: "remote_orders",
        basename: "/orders",
        entryBaseUrl: "http://localhost:3010/",
      },
    ],
  },
  remoteSourcePolicy: {
    allowedOrigins: [
      "http://localhost:3010",
    ],
  },
};
`;
    await writeFile(configPath, original, "utf8");

    await expect(
      registerRemote({
        basename: "/billing",
        entryBaseUrl: "http://localhost:3011",
        id: "orders",
        path: "/billing/*",
        remoteName: "remote_billing",
        shell: "react",
        title: "Billing",
        workspaceRoot,
      }),
    ).rejects.toThrow("Remote id orders already exists");
    await expect(readFile(configPath, "utf8")).resolves.toBe(original);
  });
});

describe("run", () => {
  it("executes a full create remote command without prompting", async () => {
    const workspaceRoot = await createWorkspace();

    await run(
      [
        "create",
        "remote",
        "--framework",
        "react",
        "--name",
        "remote-orders",
        "--route",
        "/orders",
        "--port",
        "3010",
        "--title",
        "Orders",
      ],
      workspaceRoot,
      {
        prompts: {
          createRemote: async () => {
            throw new Error("prompt should not be called");
          },
        },
      },
    );

    const packageJson = await readJson(
      join(workspaceRoot, "apps/remote-orders/package.json"),
    );
    expect(packageJson.name).toBe("@federlet/remote-orders");
  });

  it("prompts for missing create remote options", async () => {
    const workspaceRoot = await createWorkspace();

    await run(["create", "remote"], workspaceRoot, {
      prompts: {
        createRemote: async () => ({
          framework: "vue",
          name: "remote-reports",
          port: 3011,
          route: "/reports",
          title: "Reports",
        }),
      },
    });

    const packageJson = await readJson(
      join(workspaceRoot, "apps/remote-reports/package.json"),
    );
    const mount = await readFile(
      join(workspaceRoot, "apps/remote-reports/src/mount.ts"),
      "utf8",
    );

    expect(packageJson.name).toBe("@federlet/remote-reports");
    expect(mount).toContain("export function mount(context: MicroAppContext)");
  });
});
