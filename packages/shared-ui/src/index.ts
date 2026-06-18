import {
  createElement,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Federlet 示例应用共用的设计 token。
 *
 * 阶段一只沉淀跨应用会复用的基础值，避免过早抽象完整组件库。
 */
export const designTokens = {
  color: {
    shellBackground: "#f8fafc",
    shellForeground: "#1f2937",
    reactAccent: "#2563eb",
    vueAccent: "#16a34a",
    cardBackground: "#ffffff",
    mutedForeground: "#475569",
  },
  radius: {
    card: "18px",
    panel: "24px",
  },
  shadow: {
    card: "0 16px 32px rgb(37 99 235 / 14%)",
  },
} as const;

export interface SharedCardProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

export function SharedCard({
  eyebrow,
  title,
  children,
  style,
}: SharedCardProps) {
  return createElement(
    "section",
    {
      style: {
        display: "grid",
        gap: "10px",
        borderRadius: designTokens.radius.panel,
        padding: "24px",
        background: designTokens.color.cardBackground,
        boxShadow: designTokens.shadow.card,
        ...style,
      },
    },
    eyebrow
      ? createElement(
          "span",
          {
            style: {
              color: designTokens.color.reactAccent,
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            },
          },
          eyebrow,
        )
      : null,
    createElement(
      "strong",
      {
        style: {
          color: designTokens.color.shellForeground,
          fontSize: "24px",
        },
      },
      title,
    ),
    createElement(
      "span",
      {
        style: {
          color: designTokens.color.mutedForeground,
        },
      },
      children,
    ),
  );
}

export interface MetricTileProps {
  value: ReactNode;
  label: ReactNode;
  style?: CSSProperties;
}

export function MetricTile({ value, label, style }: MetricTileProps) {
  return createElement(
    "div",
    {
      style: {
        display: "grid",
        gap: "6px",
        borderRadius: designTokens.radius.card,
        padding: "18px",
        background: "#eff6ff",
        ...style,
      },
    },
    createElement(
      "strong",
      {
        style: {
          color: designTokens.color.reactAccent,
          fontSize: "28px",
        },
      },
      value,
    ),
    createElement(
      "span",
      {
        style: {
          color: designTokens.color.mutedForeground,
        },
      },
      label,
    ),
  );
}

export interface SharedButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function SharedButton({
  children,
  style,
  type = "button",
  ...props
}: SharedButtonProps) {
  return createElement(
    "button",
    {
      ...props,
      type,
      style: {
        border: 0,
        borderRadius: "999px",
        padding: "10px 16px",
        color: "#ffffff",
        background: designTokens.color.reactAccent,
        fontWeight: 800,
        cursor: "pointer",
        ...style,
      },
    },
    children,
  );
}

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  getContainer?: () => HTMLElement | null;
}

function defaultModalContainer() {
  return typeof document === "undefined" ? null : document.body;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  getContainer,
}: ModalProps) {
  if (!open) {
    return null;
  }

  const container = getContainer?.() ?? defaultModalContainer();

  if (!container) {
    return null;
  }

  return createPortal(
    createElement(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          zIndex: 20,
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "rgb(15 23 42 / 42%)",
        },
      },
      createElement(
        "section",
        {
          role: "dialog",
          "aria-modal": true,
          "aria-label": typeof title === "string" ? title : undefined,
          style: {
            width: "min(420px, 100%)",
            borderRadius: designTokens.radius.panel,
            padding: "24px",
            background: designTokens.color.cardBackground,
            boxShadow: "0 24px 64px rgb(15 23 42 / 24%)",
          },
        },
        createElement(
          "header",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "16px",
            },
          },
          createElement(
            "strong",
            {
              style: {
                color: designTokens.color.shellForeground,
                fontSize: "20px",
              },
            },
            title,
          ),
          onClose
            ? createElement(
                "button",
                {
                  type: "button",
                  onClick: onClose,
                  "aria-label": "Close modal",
                  style: {
                    border: 0,
                    borderRadius: "999px",
                    width: "32px",
                    height: "32px",
                    color: designTokens.color.shellForeground,
                    background: "#e2e8f0",
                    cursor: "pointer",
                  },
                },
                "×",
              )
            : null,
        ),
        createElement(
          "div",
          {
            style: {
              color: designTokens.color.mutedForeground,
              lineHeight: 1.6,
            },
          },
          children,
        ),
      ),
    ),
    container,
  );
}
