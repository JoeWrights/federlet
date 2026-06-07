import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import {
  designTokens,
  MetricTile,
  SharedButton,
  SharedCard,
} from "./index";

describe("shared-ui components", () => {
  it("exports reusable React components backed by design tokens", () => {
    const card = SharedCard({
      eyebrow: "Shared UI",
      title: "One component library",
      children: "Rendered from a federated shared package.",
    });
    const metric = MetricTile({
      value: "12kb",
      label: "saved per remote",
    });
    const button = SharedButton({
      children: "Open dashboard",
    });

    expect(isValidElement(card)).toBe(true);
    expect(isValidElement(metric)).toBe(true);
    expect(isValidElement(button)).toBe(true);
    expect(card.props.style.borderRadius).toBe(designTokens.radius.panel);
    expect(metric.props.style.borderRadius).toBe(designTokens.radius.card);
  });
});
