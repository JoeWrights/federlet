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
  },
  radius: {
    card: "18px",
    panel: "24px",
  },
} as const;
