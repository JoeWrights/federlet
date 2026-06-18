import postcss, { type AtRule, type Rule } from "postcss";
import selectorParser, { type Selector } from "postcss-selector-parser";

/**
 * 改写 CSS selector 的选项。
 */
export interface PrefixCssSelectorsOptions {
  /**
   * 样式隔离的 scope class。
   */
  scopeClass: string;
  /**
   * 文件名。
   */
  filename?: string;
}

/**
 * 样式隔离 PostCSS 插件的选项。
 */
export interface StyleIsolationPostcssPluginOptions {
  /**
   * 样式隔离的 scope class。
   */
  scopeClass: string;
}

/**
 * 样式污染严重性。
 */
export type StylePollutionSeverity = "error" | "warn";

/**
 * 样式污染原因。
 */
export type StylePollutionReason =
  | "document-level-selector"
  | "global-root-selector"
  | "global-pseudo-selector"
  | "global-font-face"
  | "global-keyframes"
  | "unscoped-selector";

/**
 * 样式污染问题。
 */
export interface StylePollutionIssue {
  /**
   * 问题严重性。
   */
  severity: StylePollutionSeverity;
  /**
   * 问题原因。
   */
  reason: StylePollutionReason;
  /**
   * 问题 selector。
   */
  selector?: string;
  /**
   * 问题 atRule。
   */
  atRule?: string;
  /**
   * 问题行号。
   */
  line?: number;
  /**
   * 问题列号。
   */
  column?: number;
}

/**
 * 检测全局样式污染的选项。
 */
export interface DetectGlobalStylePollutionOptions {  
  /**
   * 样式隔离的 scope class。
   */
  scopeClass: string;
  /**
   * 文件名。
   */
  filename?: string;
  /**
   * 允许的 selector 前缀。
   */
  allowedSelectorPrefixes?: string[];
}

export interface DetectRuntimeStylePollutionOptions {
  /**
   * 样式隔离的 scope class。
   */
  scopeClass: string;
  /**
   * 远程的名称。
   */
  remoteName?: string;
  /**
   * 根节点。
   */
  root?: ParentNode;
}

/**
 * 远程 DOM 逃逸阶段。
 */
export type RemoteDomEscapePhase = "mount" | "unmount";

/**
 * 远程 DOM 快照。
 */
export interface RemoteDomSnapshot {
  /**
   * 远程 DOM 快照中的 body 子节点。
   */
  bodyChildren: ReadonlySet<Node>;
}

/**
 * 捕获远程 DOM 快照的选项。
 */
export interface CaptureRemoteDomSnapshotOptions {
  /**
   * 远程 DOM 容器。
   */
  container: HTMLElement;
  /**
   * 根节点。
   */
  root?: Document;
}

/**
 * 远程 DOM 逃逸问题。
 */
export interface RemoteDomEscapeIssue {
  /**
   * 逃逸的节点。
   */
  node: Node;
  /**
   * 逃逸的阶段。
   */
  phase: RemoteDomEscapePhase;
  /**
   * 逃逸的原因。
   */
  reason: "node-outside-remote-container";
  /**
   * 逃逸的 remote 名称。
   */
  remoteName: string;
}

/**
 * 检测远程 DOM 逃逸的选项。
 */
export interface DetectRemoteDomEscapesOptions {
  /**
   * 远程 DOM 容器。
   */
  container: HTMLElement;
  /**
   * 远程 DOM 逃逸阶段。
   */
  phase: RemoteDomEscapePhase;
  /**
   * 逃逸的 remote 名称。
   */
  remoteName: string;
  /**
   * 根节点。
   */
  root?: Document;
  /**
   * 远程 DOM 快照。
   */
  snapshot: RemoteDomSnapshot;
}

/**
 * 文档级 selector。
 */
const documentLevelSelectors = new Set([":root", "html", "body"]);

/**
 * 全局根 id。
 */
const globalRootIds = new Set(["app", "root"]);

/**
 * 创建远程 scope class。
 */
export function createRemoteScopeClass(remoteName: string) {
  const normalizedName = remoteName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `federlet-scope-${normalizedName}`;
}

/**
 * 创建远程容器 class。
 */
export function createRemoteContainerClassName(
  baseClassName: string,
  remoteName: string,
) {
  return `${baseClassName} ${createRemoteScopeClass(remoteName)}`;
}

/**
 * 判断是否应该前缀 CSS 文件。
 */
export function shouldPrefixCssFile(filename: string) {
  return filename.endsWith(".css") && !filename.includes("/node_modules/");
}

/**
 * 判断是否在 keyframes 内部。
 */
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

/**
 * 判断 selector 是否以 scope class 开头。
 */
function selectorStartsWithScope(selector: Selector, scopeClass: string) {
  return selector.nodes.some((node) => {
    if (node.type === "combinator" || node.type === "comment") {
      return false;
    }

    return node.type === "class" && node.value === scopeClass;
  });
}

/**
 * 判断 selector 是否是文档级 selector。
 */
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

/**
 * 获取 selector 的第一个节点。
 */
function getFirstSelectorNode(selector: Selector) {
  return selector.nodes.find(
    (node) => node.type !== "combinator" && node.type !== "comment",
  );
}

/**
 * 判断 selector 是否是全局根 selector。
 */
function isGlobalRootSelector(selector: Selector) {
  const firstNode = getFirstSelectorNode(selector);

  return firstNode?.type === "id" && globalRootIds.has(firstNode.value);
}

/**
 * 判断 selector 是否是全局伪 selector。
 */
function hasGlobalPseudoSelector(selector: Selector) {
  return selector.nodes.some(
    (node) => node.type === "pseudo" && node.value === ":global",
  );
}

/**
 * 创建规则问题。
 */
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

/**
 * 创建 atRule 问题。
 */
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

/**
 * 判断 selector 是否以允许的 selector 前缀开头。
 */
function startsWithAllowedSelectorPrefix(
  selector: string,
  allowedSelectorPrefixes: string[] | undefined,
) {
  const normalizedSelector = selector.trim();

  return allowedSelectorPrefixes?.some((prefix) =>
    normalizedSelector.startsWith(prefix),
  );
}

/**
 * 改写 CSS selector。
 */
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

/**
 * 检测全局样式污染。
 */
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

/**
 * 检测未 scoped 的样式选择器。
 */
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

/**
 * 检测运行时样式污染。
 */
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

/**
 * 捕获 remote DOM 快照，用于后续运行时检测。
 * @param options - 捕获 remote DOM 快照的选项。
 * @returns - 远程 DOM 快照。
 */
export function captureRemoteDomSnapshot(
  options: CaptureRemoteDomSnapshotOptions,
): RemoteDomSnapshot {
  const root = options.root ?? options.container.ownerDocument;

  return {
    bodyChildren: new Set(Array.from(root.body.children)),
  };
}

/**
 * 检测 remote DOM 逃逸，用于后续运行时检测。
 * @param options - 检测 remote DOM 逃逸的选项。
 * @returns - 远程 DOM 逃逸问题列表。
 */
export function detectRemoteDomEscapes(
  options: DetectRemoteDomEscapesOptions,
) {
  const root = options.root ?? options.container.ownerDocument;
  const issues: RemoteDomEscapeIssue[] = [];

  for (const node of Array.from(root.body.children)) {
    if (
      options.snapshot.bodyChildren.has(node) ||
      options.container.contains(node)
    ) {
      continue;
    }

    issues.push({
      node,
      phase: options.phase,
      reason: "node-outside-remote-container",
      remoteName: options.remoteName,
    });
  }

  return issues;
}

/**
 * 创建样式隔离 PostCSS 插件，用于构建期改写 CSS selector。
 * @param options - 样式隔离 PostCSS 插件的选项。
 * @returns - 样式隔离 PostCSS 插件。
 */
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

/**
 * 改写 CSS selector，用于构建期改写 CSS selector。
 * @param css - 原始 CSS 代码。
 * @param options - 改写 CSS selector 的选项。
 * @returns - 改写后的 CSS 代码。
 */
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
