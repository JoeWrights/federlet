import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);

  if (!match) {
    throw new Error(`Unsupported semver version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) {
      return left[key] > right[key] ? 1 : -1;
    }
  }

  return 0;
}

function caretUpperBound(version) {
  if (version.major > 0) {
    return { major: version.major + 1, minor: 0, patch: 0 };
  }

  if (version.minor > 0) {
    return { major: 0, minor: version.minor + 1, patch: 0 };
  }

  return { major: 0, minor: 0, patch: version.patch + 1 };
}

export function satisfiesSharedUiRange(version, range) {
  if (range === "*") {
    return true;
  }

  const parsedVersion = parseVersion(version);

  if (range.startsWith("^")) {
    const minimum = parseVersion(range.slice(1));
    const upperBound = caretUpperBound(minimum);

    return (
      compareVersions(parsedVersion, minimum) >= 0 &&
      compareVersions(parsedVersion, upperBound) < 0
    );
  }

  return compareVersions(parsedVersion, parseVersion(range)) === 0;
}

export function checkSharedUiCompatibility({
  shellSharedUiVersion,
  remotes,
}) {
  const errors = [];

  for (const remote of remotes) {
    if (!remote.sharedUiRequiredVersion) {
      errors.push(
        `${remote.name} consumes @federlet/shared-ui but does not declare federlet.sharedUiRequiredVersion.`,
      );
      continue;
    }

    if (
      !satisfiesSharedUiRange(
        shellSharedUiVersion,
        remote.sharedUiRequiredVersion,
      )
    ) {
      errors.push(
        `${remote.name} requires @federlet/shared-ui ${remote.sharedUiRequiredVersion}, but Shell provides ${shellSharedUiVersion}.`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function readWorkspaceSharedUiPolicy(workspaceRoot) {
  const sharedUiPackage = readJson(
    path.join(workspaceRoot, "packages/shared-ui/package.json"),
  );
  const appsDir = path.join(workspaceRoot, "apps");
  const remotes = [];

  for (const appName of readdirSync(appsDir)) {
    const packagePath = path.join(appsDir, appName, "package.json");

    if (!existsSync(packagePath)) {
      continue;
    }

    const appPackage = readJson(packagePath);

    if (!appPackage.dependencies?.["@federlet/shared-ui"]) {
      continue;
    }

    if (appPackage.name === "@federlet/shell-react") {
      continue;
    }

    remotes.push({
      name: appPackage.name,
      sharedUiRequiredVersion:
        appPackage.federlet?.sharedUiRequiredVersion,
    });
  }

  return {
    shellSharedUiVersion: sharedUiPackage.version,
    remotes,
  };
}

function main() {
  const workspaceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const result = checkSharedUiCompatibility(
    readWorkspaceSharedUiPolicy(workspaceRoot),
  );

  if (!result.ok) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log("All remotes are compatible with the Shell shared-ui version.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
