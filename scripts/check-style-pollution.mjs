import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  createRemoteScopeClass,
  detectGlobalStylePollution,
  detectUnscopedStyleSelectors,
} from "../packages/style-isolation/src/index.ts";

const remotes = [
  {
    remoteName: "remote_react",
    distDir: "apps/remote-react/dist",
  },
  {
    remoteName: "remote_vue",
    distDir: "apps/remote-vue/dist",
  },
  {
    remoteName: "remote_umi_react",
    distDir: "apps/remote-umi-react/dist",
    allowedSelectorPrefixes: [".umi-remote"],
  },
];

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function collectCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectCssFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".css")) {
      files.push(entryPath);
    }
  }

  return files;
}

function formatIssue(filePath, issue) {
  const location =
    issue.line && issue.column ? `${issue.line}:${issue.column}` : "unknown";
  const target = issue.selector ?? `@${issue.atRule}`;

  return `${filePath}:${location} ${issue.severity} ${issue.reason} ${target}`;
}

let hasErrors = false;
let checkedFiles = 0;
let warnings = 0;

for (const remote of remotes) {
  const distDir = path.resolve(process.cwd(), remote.distDir);

  if (!(await pathExists(distDir))) {
    hasErrors = true;
    console.error(
      `${remote.distDir}: missing build output. Run pnpm build before pnpm check:styles.`,
    );
    continue;
  }

  const cssFiles = await collectCssFiles(distDir);
  const scopeClass = createRemoteScopeClass(remote.remoteName);

  for (const cssFile of cssFiles) {
    checkedFiles += 1;
    const css = await readFile(cssFile, "utf8");
    const issues = [
      ...detectGlobalStylePollution(css, {
        filename: cssFile,
        scopeClass,
      }),
      ...detectUnscopedStyleSelectors(css, {
        allowedSelectorPrefixes: remote.allowedSelectorPrefixes,
        filename: cssFile,
        scopeClass,
      }),
    ];

    for (const issue of issues) {
      console.error(formatIssue(path.relative(process.cwd(), cssFile), issue));

      if (issue.severity === "error") {
        hasErrors = true;
      } else {
        warnings += 1;
      }
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(
  `Style pollution check passed: ${checkedFiles} CSS file(s) scanned, ${warnings} warning(s).`,
);
