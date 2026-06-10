import { describe, expect, it } from "vitest";
import {
  createRemoteContainerClassName,
  createRemoteScopeClass,
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
});
