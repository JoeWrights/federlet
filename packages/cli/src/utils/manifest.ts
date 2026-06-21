import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface RegisterRemoteOptions {
  basename: string;
  entryBaseUrl: string;
  entryGlobalName?: string;
  id: string;
  path: string;
  remoteEntryType?: "module" | "var";
  remoteName: string;
  shell: "react" | "vue";
  title: string;
  workspaceRoot: string;
}

function normalizeEntryBaseUrl(entryBaseUrl: string) {
  const url = new URL(entryBaseUrl);
  const normalized = url.toString();
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function originOf(entryBaseUrl: string) {
  return new URL(entryBaseUrl).origin;
}

function assertNotContains(source: string, label: string, value: string) {
  if (source.includes(`${label}: "${value}"`)) {
    throw new Error(`Remote ${label} ${value} already exists.`);
  }
}

function createRemoteManifestItem(options: RegisterRemoteOptions) {
  const lines = [
    "      {",
    `        basename: "${options.basename}",`,
    `        entryBaseUrl: "${normalizeEntryBaseUrl(options.entryBaseUrl)}",`,
  ];

  if (options.entryGlobalName) {
    lines.push(`        entryGlobalName: "${options.entryGlobalName}",`);
  }

  lines.push(
    `        id: "${options.id}",`,
    `        path: "${options.path}",`,
  );

  if (options.remoteEntryType) {
    lines.push(`        remoteEntryType: "${options.remoteEntryType}",`);
  }

  lines.push(
    `        remoteName: "${options.remoteName}",`,
    '        status: "active",',
    "        supportedShellProtocolVersions: [SHELL_REMOTE_PROTOCOL_VERSION],",
    `        title: "${options.title}",`,
    "      },",
  );

  return lines.join("\n");
}

function insertIntoArray(source: string, marker: string, item: string) {
  const start = source.indexOf(marker);

  if (start === -1) {
    throw new Error(`Could not find ${marker} in Apollo config.`);
  }

  const close = source.indexOf("    ],", start);

  if (close === -1) {
    throw new Error(`Could not find closing array for ${marker}.`);
  }

  return `${source.slice(0, close)}${item}\n${source.slice(close)}`;
}

export async function registerRemoteInApolloConfig(
  options: RegisterRemoteOptions,
) {
  if (options.remoteEntryType === "var" && !options.entryGlobalName) {
    throw new Error("entryGlobalName is required for var remote entries.");
  }

  const configPath = join(
    options.workspaceRoot,
    `apps/shell-${options.shell}/src/config/apollo.ts`,
  );
  const source = await readFile(configPath, "utf8");
  assertNotContains(source, "id", options.id);
  assertNotContains(source, "remoteName", options.remoteName);
  assertNotContains(source, "basename", options.basename);
  assertNotContains(source, "path", options.path);

  const origin = originOf(options.entryBaseUrl);
  let next = insertIntoArray(
    source,
    "remotes: [",
    createRemoteManifestItem(options),
  );

  if (!next.includes(`"${origin}"`)) {
    next = insertIntoArray(next, "allowedOrigins: [", `      "${origin}",`);
  }

  await writeFile(configPath, next, "utf8");
}
