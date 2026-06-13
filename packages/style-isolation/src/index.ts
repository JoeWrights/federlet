import postcss, { type AtRule, type Rule } from "postcss";
import selectorParser, { type Selector } from "postcss-selector-parser";

export interface PrefixCssSelectorsOptions {
  scopeClass: string;
  filename?: string;
}

export interface StyleIsolationPostcssPluginOptions {
  scopeClass: string;
}

export type StylePollutionSeverity = "error" | "warn";

export type StylePollutionReason =
  | "document-level-selector"
  | "global-root-selector"
  | "global-pseudo-selector"
  | "global-font-face"
  | "global-keyframes"
  | "unscoped-selector";

export interface StylePollutionIssue {
  severity: StylePollutionSeverity;
  reason: StylePollutionReason;
  selector?: string;
  atRule?: string;
  line?: number;
  column?: number;
}

export interface DetectGlobalStylePollutionOptions {
  scopeClass: string;
  filename?: string;
  allowedSelectorPrefixes?: string[];
}

export interface DetectRuntimeStylePollutionOptions {
  scopeClass: string;
  remoteName?: string;
  root?: ParentNode;
}

const documentLevelSelectors = new Set([":root", "html", "body"]);
const globalRootIds = new Set(["app", "root"]);

export function createRemoteScopeClass(remoteName: string) {
  const normalizedName = remoteName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `federlet-scope-${normalizedName}`;
}

export function createRemoteContainerClassName(
  baseClassName: string,
  remoteName: string,
) {
  return `${baseClassName} ${createRemoteScopeClass(remoteName)}`;
}

export function shouldPrefixCssFile(filename: string) {
  return filename.endsWith(".css") && !filename.includes("/node_modules/");
}

function isInsideKeyframes(rule: Rule) {
  let parent: unknown = rule.parent;

  while (parent && typeof parent === "object") {
    const node = parent as {
      type?: string;
      name?: string;
      parent?: unknown;
    };

    if (
      node.type === "atrule" &&
      node.name?.toLowerCase().endsWith("keyframes")
    ) {
      return true;
    }

    parent = node.parent;
  }

  return false;
}

function selectorStartsWithScope(selector: Selector, scopeClass: string) {
  return selector.nodes.some((node) => {
    if (node.type === "combinator" || node.type === "comment") {
      return false;
    }

    return node.type === "class" && node.value === scopeClass;
  });
}

function isDocumentLevelSelector(selector: Selector) {
  const firstNode = selector.nodes.find(
    (node) => node.type !== "combinator" && node.type !== "comment",
  );

  if (!firstNode) {
    return false;
  }

  if (firstNode.type === "tag") {
    return documentLevelSelectors.has(firstNode.value.toLowerCase());
  }

  if (firstNode.type === "pseudo") {
    return documentLevelSelectors.has(firstNode.value.toLowerCase());
  }

  return false;
}

function getFirstSelectorNode(selector: Selector) {
  return selector.nodes.find(
    (node) => node.type !== "combinator" && node.type !== "comment",
  );
}

function isGlobalRootSelector(selector: Selector) {
  const firstNode = getFirstSelectorNode(selector);

  return firstNode?.type === "id" && globalRootIds.has(firstNode.value);
}

function hasGlobalPseudoSelector(selector: Selector) {
  return selector.nodes.some(
    (node) => node.type === "pseudo" && node.value === ":global",
  );
}

function createRuleIssue(
  rule: Rule,
  selector: string,
  reason: StylePollutionReason,
): StylePollutionIssue {
  return {
    severity: "error",
    reason,
    selector,
    line: rule.source?.start?.line,
    column: rule.source?.start?.column,
  };
}

function createAtRuleIssue(
  atRule: AtRule,
  reason: StylePollutionReason,
): StylePollutionIssue {
  return {
    severity: "warn",
    reason,
    atRule: atRule.name,
    line: atRule.source?.start?.line,
    column: atRule.source?.start?.column,
  };
}

function startsWithAllowedSelectorPrefix(
  selector: string,
  allowedSelectorPrefixes: string[] | undefined,
) {
  const normalizedSelector = selector.trim();

  return allowedSelectorPrefixes?.some((prefix) =>
    normalizedSelector.startsWith(prefix),
  );
}

export function prefixSelector(selector: string, scopeClass: string) {
  return selectorParser((selectors) => {
    selectors.each((item) => {
      if (
        item.type !== "selector" ||
        selectorStartsWithScope(item, scopeClass) ||
        isDocumentLevelSelector(item)
      ) {
        return;
      }

      item.spaces.before = "";
      item.prepend(selectorParser.combinator({ value: " " }));
      item.prepend(selectorParser.className({ value: scopeClass }));
    });
  }).processSync(selector, { lossless: false });
}

export function detectGlobalStylePollution(
  css: string,
  options: DetectGlobalStylePollutionOptions,
) {
  if (options.filename && !shouldPrefixCssFile(options.filename)) {
    return [];
  }

  const issues: StylePollutionIssue[] = [];
  const root = postcss.parse(css, { from: options.filename });

  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase();

    if (name === "font-face") {
      issues.push(createAtRuleIssue(atRule, "global-font-face"));
    }

    if (name.endsWith("keyframes")) {
      issues.push(createAtRuleIssue(atRule, "global-keyframes"));
    }
  });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) {
      return;
    }

    selectorParser((selectors) => {
      selectors.each((item) => {
        if (item.type !== "selector") {
          return;
        }

        const selector = item.toString();

        if (selectorStartsWithScope(item, options.scopeClass)) {
          return;
        }

        if (isDocumentLevelSelector(item)) {
          issues.push(
            createRuleIssue(rule, selector, "document-level-selector"),
          );
          return;
        }

        if (isGlobalRootSelector(item)) {
          issues.push(createRuleIssue(rule, selector, "global-root-selector"));
          return;
        }

        if (hasGlobalPseudoSelector(item)) {
          issues.push(
            createRuleIssue(rule, selector, "global-pseudo-selector"),
          );
        }
      });
    }).processSync(rule.selector, { lossless: false });
  });

  return issues;
}

export function detectUnscopedStyleSelectors(
  css: string,
  options: DetectGlobalStylePollutionOptions,
) {
  if (options.filename && !shouldPrefixCssFile(options.filename)) {
    return [];
  }

  const issues: StylePollutionIssue[] = [];
  const root = postcss.parse(css, { from: options.filename });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) {
      return;
    }

    selectorParser((selectors) => {
      selectors.each((item) => {
        if (
          item.type !== "selector" ||
          selectorStartsWithScope(item, options.scopeClass)
        ) {
          return;
        }

        const selector = item.toString();

        if (
          startsWithAllowedSelectorPrefix(
            selector,
            options.allowedSelectorPrefixes,
          )
        ) {
          return;
        }

        issues.push(createRuleIssue(rule, selector, "unscoped-selector"));
      });
    }).processSync(rule.selector, { lossless: false });
  });

  return issues;
}

export function detectRuntimeStylePollution(
  options: DetectRuntimeStylePollutionOptions,
) {
  const root =
    options.root ??
    (typeof document === "undefined" ? undefined : document);

  if (!root) {
    return [];
  }

  const issues: StylePollutionIssue[] = [];

  for (const styleElement of Array.from(root.querySelectorAll("style"))) {
    const ownerRemote = styleElement.dataset.federletRemote;

    if (
      options.remoteName &&
      ownerRemote &&
      ownerRemote !== options.remoteName
    ) {
      continue;
    }

    const css = styleElement.textContent ?? "";

    issues.push(
      ...detectGlobalStylePollution(css, {
        scopeClass: options.scopeClass,
      }),
      ...detectUnscopedStyleSelectors(css, {
        scopeClass: options.scopeClass,
      }),
    );
  }

  return issues;
}

export function createStyleIsolationPostcssPlugin(
  options: StyleIsolationPostcssPluginOptions,
) {
  return {
    postcssPlugin: "federlet-style-isolation",
    Rule(rule: Rule) {
      if (isInsideKeyframes(rule)) {
        return;
      }

      rule.selector = prefixSelector(rule.selector, options.scopeClass);
    },
  };
}

createStyleIsolationPostcssPlugin.postcss = true;

export async function prefixCssSelectors(
  css: string,
  options: PrefixCssSelectorsOptions,
) {
  if (options.filename && !shouldPrefixCssFile(options.filename)) {
    return css;
  }

  const result = await postcss([
    createStyleIsolationPostcssPlugin({ scopeClass: options.scopeClass }),
  ]).process(css, {
    from: options.filename,
  });

  return result.css;
}
