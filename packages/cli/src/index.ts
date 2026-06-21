#!/usr/bin/env node
import { cwd } from "node:process";
import { Command, CommanderError } from "commander";
import { input, select } from "@inquirer/prompts";
import { createRemote } from "./commands/create-remote.js";
import { createShell } from "./commands/create-shell.js";
import { registerRemote } from "./commands/register-remote.js";
import {
  ensureSupportedFramework,
  ensureSupportedShellFramework,
  normalizeRoute,
  routeToPath,
  toTitle,
  type Framework,
  type ShellFramework,
} from "./utils/names.js";

interface CreateRemoteCliOptions {
  framework?: string;
  name?: string;
  port?: string;
  route?: string;
  title?: string;
}

interface CreateShellCliOptions {
  framework?: string;
  name?: string;
  port?: string;
}

interface RegisterRemoteCliOptions {
  basename?: string;
  entryBaseUrl?: string;
  entryGlobalName?: string;
  id?: string;
  path?: string;
  remoteEntryType?: string;
  remoteName?: string;
  route?: string;
  shell?: string;
  title?: string;
}

interface CreateRemotePromptResult {
  framework: Framework;
  name: string;
  port: number;
  route: string;
  title: string;
}

interface CreateShellPromptResult {
  framework: ShellFramework;
  name: string;
  port: number;
}

interface RegisterRemotePromptResult {
  basename: string;
  entryBaseUrl: string;
  entryGlobalName?: string;
  id: string;
  path: string;
  remoteEntryType?: "module" | "var";
  remoteName: string;
  shell: ShellFramework;
  title: string;
}

interface PromptAdapter {
  createRemote(options: CreateRemoteCliOptions): Promise<CreateRemotePromptResult>;
  createShell(options: CreateShellCliOptions): Promise<CreateShellPromptResult>;
  registerRemote(
    options: RegisterRemoteCliOptions,
  ): Promise<RegisterRemotePromptResult>;
}

interface RunDependencies {
  prompts?: Partial<PromptAdapter>;
}

function parsePositiveInteger(value: string | number, name: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function hasAllValues<T extends object>(options: T, keys: Array<keyof T>) {
  return keys.every((key) => options[key] !== undefined && options[key] !== "");
}

function toRemoteEntryType(value?: string): "module" | "var" | undefined {
  return value === "module" || value === "var" ? value : undefined;
}

function hasRegisterRemoteValues(options: RegisterRemoteCliOptions) {
  return (
    hasAllValues(options, ["shell", "id", "remoteName", "entryBaseUrl"]) &&
    Boolean(options.basename ?? options.route)
  );
}

function requirePrompt<T extends keyof PromptAdapter>(
  prompts: Partial<PromptAdapter>,
  key: T,
): PromptAdapter[T] {
  const prompt = prompts[key];

  if (!prompt) {
    throw new Error(`Missing prompt adapter for ${key}.`);
  }

  return prompt;
}

async function promptCreateRemote(
  options: CreateRemoteCliOptions,
): Promise<CreateRemotePromptResult> {
  const framework =
    options.framework ??
    (await select({
      choices: [
        { name: "React", value: "react" },
        { name: "Vue", value: "vue" },
        { name: "Umi / legacy", value: "umi" },
      ],
      message: "Remote framework",
    }));
  ensureSupportedFramework(framework);
  const name =
    options.name ??
    (await input({
      message: "Remote package/app name",
      required: true,
    }));
  const route =
    options.route ??
    (await input({
      default: `/${name.replace(/^remote-/, "")}`,
      message: "Remote route basename",
      required: true,
    }));
  const port =
    options.port ??
    (await input({
      default: "3010",
      message: "Remote dev port",
      required: true,
    }));
  const title =
    options.title ??
    (await input({
      default: toTitle(name),
      message: "Remote title",
      required: true,
    }));

  return {
    framework,
    name,
    port: parsePositiveInteger(port, "port"),
    route,
    title,
  };
}

async function promptCreateShell(
  options: CreateShellCliOptions,
): Promise<CreateShellPromptResult> {
  const framework =
    options.framework ??
    (await select({
      choices: [
        { name: "React", value: "react" },
        { name: "Vue", value: "vue" },
      ],
      message: "Shell framework",
    }));
  ensureSupportedShellFramework(framework);
  const name =
    options.name ??
    (await input({
      message: "Shell package/app name",
      required: true,
    }));
  const port =
    options.port ??
    (await input({
      default: "3100",
      message: "Shell dev port",
      required: true,
    }));

  return {
    framework,
    name,
    port: parsePositiveInteger(port, "port"),
  };
}

async function promptRegisterRemote(
  options: RegisterRemoteCliOptions,
): Promise<RegisterRemotePromptResult> {
  const shell =
    options.shell ??
    (await select({
      choices: [
        { name: "React Shell", value: "react" },
        { name: "Vue Shell", value: "vue" },
      ],
      message: "Target shell",
    }));
  ensureSupportedShellFramework(shell);
  const id =
    options.id ??
    (await input({
      message: "Remote route id",
      required: true,
    }));
  const remoteName =
    options.remoteName ??
    (await input({
      default: id.startsWith("remote_") ? id : `remote_${id.replace(/-/g, "_")}`,
      message: "Module Federation remote name",
      required: true,
    }));
  const basename = normalizeRoute(
    options.basename ??
      options.route ??
      (await input({
        default: `/${id}`,
        message: "Remote basename",
        required: true,
      })),
  );
  const entryBaseUrl =
    options.entryBaseUrl ??
    (await input({
      default: "http://localhost:3010",
      message: "Remote entry base URL",
      required: true,
    }));
  const remoteEntryType = options.remoteEntryType;
  const entryGlobalName =
    options.entryGlobalName ??
    (remoteEntryType === "var"
      ? await input({
          default: remoteName,
          message: "Global name for var remote",
          required: true,
        })
      : undefined);

  return {
    basename,
    entryBaseUrl,
    entryGlobalName,
    id,
    path: options.path ?? routeToPath(basename),
    remoteEntryType: toRemoteEntryType(remoteEntryType),
    remoteName,
    shell,
    title: options.title ?? toTitle(remoteName),
  };
}

const defaultPrompts: PromptAdapter = {
  createRemote: promptCreateRemote,
  createShell: promptCreateShell,
  registerRemote: promptRegisterRemote,
};

function createProgram(workspaceRoot: string, prompts: Partial<PromptAdapter>) {
  const program = new Command();
  const create = new Command("create");
  const register = new Command("register");

  program
    .name("federlet")
    .description("Federlet project scaffolding CLI")
    .showHelpAfterError()
    .exitOverride();

  create
    .command("remote")
    .description("Create a Federlet remote application")
    .option("--framework <framework>", "remote framework: react, vue, umi")
    .option("--name <name>", "application directory and package name")
    .option("--route <route>", "remote route basename")
    .option("--port <port>", "development server port")
    .option("--title <title>", "display title")
    .action(async (options: CreateRemoteCliOptions) => {
      const resolved = hasAllValues(options, [
        "framework",
        "name",
        "route",
        "port",
      ])
        ? {
            framework: options.framework as Framework,
            name: options.name as string,
            port: parsePositiveInteger(options.port as string, "port"),
            route: options.route as string,
            title: options.title ?? toTitle(options.name as string),
          }
        : await requirePrompt(prompts, "createRemote")(options);
      ensureSupportedFramework(resolved.framework);
      await createRemote({
        ...resolved,
        route: normalizeRoute(resolved.route),
        workspaceRoot,
      });
    });

  create
    .command("shell")
    .description("Create a Federlet shell application")
    .option("--framework <framework>", "shell framework: react, vue")
    .option("--name <name>", "application directory and package name")
    .option("--port <port>", "development server port")
    .action(async (options: CreateShellCliOptions) => {
      const resolved = hasAllValues(options, ["framework", "name", "port"])
        ? {
            framework: options.framework as ShellFramework,
            name: options.name as string,
            port: parsePositiveInteger(options.port as string, "port"),
          }
        : await requirePrompt(prompts, "createShell")(options);
      ensureSupportedShellFramework(resolved.framework);
      await createShell({
        ...resolved,
        workspaceRoot,
      });
    });

  register
    .command("remote")
    .description("Register a remote in a local shell Apollo mock")
    .option("--shell <shell>", "target shell: react, vue")
    .option("--id <id>", "route id")
    .option("--remote-name <remoteName>", "Module Federation remote name")
    .option("--title <title>", "display title")
    .option("--basename <basename>", "route basename")
    .option("--route <route>", "alias for --basename")
    .option("--path <path>", "router path, defaults to basename/*")
    .option("--entry-base-url <entryBaseUrl>", "remote site base URL")
    .option("--remote-entry-type <remoteEntryType>", "remoteEntry type: module, var")
    .option("--entry-global-name <entryGlobalName>", "global name for var remotes")
    .action(async (options: RegisterRemoteCliOptions) => {
      const remoteEntryType = toRemoteEntryType(options.remoteEntryType);
      const resolved = hasRegisterRemoteValues(options)
        ? {
            basename: normalizeRoute(options.basename ?? options.route ?? ""),
            entryBaseUrl: options.entryBaseUrl as string,
            entryGlobalName: options.entryGlobalName,
            id: options.id as string,
            path:
              options.path ??
              routeToPath(normalizeRoute(options.basename ?? options.route ?? "")),
            remoteEntryType,
            remoteName: options.remoteName as string,
            shell: options.shell as ShellFramework,
            title: options.title ?? toTitle(options.remoteName as string),
          }
        : await requirePrompt(prompts, "registerRemote")(options);
      ensureSupportedShellFramework(resolved.shell);
      await registerRemote({
        ...resolved,
        workspaceRoot,
      });
    });

  program.addCommand(create);
  program.addCommand(register);

  return program;
}

export async function run(
  argv = process.argv.slice(2),
  workspaceRoot = cwd(),
  dependencies: RunDependencies = {},
) {
  const prompts = {
    ...defaultPrompts,
    ...dependencies.prompts,
  };
  const program = createProgram(workspaceRoot, prompts);

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      return;
    }

    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
