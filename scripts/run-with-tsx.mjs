import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-tsx.mjs <command> [...args]");
  process.exit(1);
}

function supportsImportRegister() {
  const [major, minor] = process.versions.node.split(".").map(Number);

  return major > 20 || (major === 20 && minor >= 6) || (major === 18 && minor >= 19);
}

const tsxRegister = supportsImportRegister() ? "--import tsx" : "--loader tsx";
const nodeOptions = [
  process.env.NODE_OPTIONS,
  "--no-warnings=ExperimentalWarning",
  tsxRegister,
]
  .filter(Boolean)
  .join(" ");

const result = spawnSync(command, args, {
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
