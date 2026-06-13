import { describe, expect, it } from "vitest";
import {
  createRemoteContainerClassName,
  createRemoteScopeClass,
  detectGlobalStylePollution,
  detectUnscopedStyleSelectors,
  prefixCssSelectors,
  shouldPrefixCssFile,
} from "../src/index";

describe("style isolation", () => {
  it("creates a stable scope class from a remote name", () => {
    expect(createRemoteScopeClass("remote_react")).toBe(
      "federlet-scope-remote-react",
    );
    expect(createRemoteScopeClass("@legacy/Remote_App")).toBe(
      "federlet-scope-legacy-remote-app",
    );
  });

  it("appends the remote scope class to a base container class", () => {
    expect(
      createRemoteContainerClassName("remote-boundary__container", "remote_vue"),
    ).toBe("remote-boundary__container federlet-scope-remote-vue");
  });

  it("prefixes normal selectors with the remote scope", async () => {
    await expect(
      prefixCssSelectors(
        `
button,
.react-remote p {
  color: red;
}
`,
        { scopeClass: "federlet-scope-remote-react" },
      ),
    ).resolves.toContain(
      ".federlet-scope-remote-react button,.federlet-scope-remote-react .react-remote p",
    );
  });

  it("prefixes selectors inside media queries", async () => {
    await expect(
      prefixCssSelectors(
        `
@media (min-width: 768px) {
  .panel {
    display: grid;
  }
}
`,
        { scopeClass: "federlet-scope-remote-react" },
      ),
    ).resolves.toContain(".federlet-scope-remote-react .panel");
  });

  it("does not prefix document-level selectors or keyframes", async () => {
    const css = await prefixCssSelectors(
      `
:root {
  --brand: blue;
}

body {
  margin: 0;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
`,
      { scopeClass: "federlet-scope-remote-react" },
    );

    expect(css).toContain(":root");
    expect(css).toContain("body");
    expect(css).toContain("@keyframes fade-in");
    expect(css).not.toContain(".federlet-scope-remote-react :root");
    expect(css).not.toContain(".federlet-scope-remote-react body");
  });

  it("skips third-party CSS files by default", () => {
    expect(shouldPrefixCssFile("/workspace/apps/remote/src/styles.css")).toBe(
      true,
    );
    expect(
      shouldPrefixCssFile("/workspace/apps/remote/node_modules/antd/dist.css"),
    ).toBe(false);
  });

  it("reports document-level selectors as style pollution errors", () => {
    const issues = detectGlobalStylePollution(
      `
:root {
  --brand: blue;
}

body .modal-root {
  color: red;
}
`,
      { scopeClass: "federlet-scope-remote-react" },
    );

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "error",
        selector: ":root",
        reason: "document-level-selector",
      }),
      expect.objectContaining({
        severity: "error",
        selector: "body .modal-root",
        reason: "document-level-selector",
      }),
    ]);
  });

  it("reports explicit global root selectors as style pollution errors", () => {
    const issues = detectGlobalStylePollution(
      `
#root .dialog {
  color: red;
}

#app {
  min-height: 100vh;
}
`,
      { scopeClass: "federlet-scope-remote-react" },
    );

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "error",
        selector: "#root .dialog",
        reason: "global-root-selector",
      }),
      expect.objectContaining({
        severity: "error",
        selector: "#app",
        reason: "global-root-selector",
      }),
    ]);
  });

  it("reports global font faces and keyframes as style pollution warnings", () => {
    const issues = detectGlobalStylePollution(
      `
@font-face {
  font-family: RemoteFont;
  src: url("/remote.woff2");
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`,
      { scopeClass: "federlet-scope-remote-react" },
    );

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "warn",
        atRule: "font-face",
        reason: "global-font-face",
      }),
      expect.objectContaining({
        severity: "warn",
        atRule: "keyframes",
        reason: "global-keyframes",
      }),
    ]);
  });

  it("does not report selectors already scoped to the remote container", () => {
    expect(
      detectGlobalStylePollution(
        `
.federlet-scope-remote-react .react-remote {
  color: blue;
}

@media (min-width: 768px) {
  .federlet-scope-remote-react .panel {
    display: grid;
  }
}
`,
        { scopeClass: "federlet-scope-remote-react" },
      ),
    ).toEqual([]);
  });

  it("reports unscoped selectors in built remote CSS", () => {
    const issues = detectUnscopedStyleSelectors(
      `
.federlet-scope-remote-react .react-remote {
  color: blue;
}

.leaked-card,
button {
  color: red;
}
`,
      { scopeClass: "federlet-scope-remote-react" },
    );

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "error",
        selector: ".leaked-card",
        reason: "unscoped-selector",
      }),
      expect.objectContaining({
        severity: "error",
        selector: "button",
        reason: "unscoped-selector",
      }),
    ]);
  });

  it("ignores keyframe steps when reporting unscoped selectors", () => {
    expect(
      detectUnscopedStyleSelectors(
        `
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`,
        { scopeClass: "federlet-scope-remote-react" },
      ),
    ).toEqual([]);
  });

  it("allows selectors that start with an explicit remote namespace", () => {
    expect(
      detectUnscopedStyleSelectors(
        `
.umi-remote,
.umi-remote__panel strong {
  color: #14213d;
}

.leaked-card {
  color: red;
}
`,
        {
          allowedSelectorPrefixes: [".umi-remote"],
          scopeClass: "federlet-scope-remote-umi-react",
        },
      ),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        selector: ".leaked-card",
        reason: "unscoped-selector",
      }),
    ]);
  });
});
