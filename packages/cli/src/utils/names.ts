export type Framework = "react" | "vue" | "umi";
export type ShellFramework = "react" | "vue";

export function toPackageName(name: string) {
  return `@federlet/${name}`;
}

export function toMfName(name: string) {
  return name.replace(/-/g, "_");
}

export function toTitle(name: string) {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function normalizeRoute(route: string) {
  const withSlash = route.startsWith("/") ? route : `/${route}`;
  return withSlash.replace(/\/+$/g, "") || "/";
}

export function routeToPath(route: string) {
  const normalized = normalizeRoute(route);
  return normalized === "/" ? "/*" : `${normalized}/*`;
}

export function ensureSupportedFramework(
  framework: string,
): asserts framework is Framework {
  if (framework !== "react" && framework !== "vue" && framework !== "umi") {
    throw new Error(`Unsupported remote framework ${framework}.`);
  }
}

export function ensureSupportedShellFramework(
  framework: string,
): asserts framework is ShellFramework {
  if (framework !== "react" && framework !== "vue") {
    throw new Error(`Unsupported shell framework ${framework}.`);
  }
}
