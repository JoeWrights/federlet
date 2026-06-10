import postcss, { type Rule } from "postcss";
import selectorParser, { type Selector } from "postcss-selector-parser";

export interface PrefixCssSelectorsOptions {
  scopeClass: string;
  filename?: string;
}

export interface StyleIsolationPostcssPluginOptions {
  scopeClass: string;
}

const documentLevelSelectors = new Set([":root", "html", "body"]);

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
