import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { MicroAppContext, MicroAppInstance } from "@federlet/shared-types";
import { App } from "./App";
import "./styles.css";

/**
 * 创建 DOM 逃逸探针。
 * 测试时用于检查 remote 是否在 Shell 容器外创建了 DOM。
 */
function createDomEscapeProbe(remoteName: string) {
  const shouldCreateProbe =
    new URLSearchParams(window.location.search).get(
      "federletDomEscapeProbe",
    ) === remoteName;

  if (!shouldCreateProbe) {
    return null;
  }

  const probe = document.createElement("div");
  probe.dataset.federletDomEscapeProbe = remoteName;
  probe.dataset.federletRemote = remoteName;
  probe.textContent = "remote-react DOM escape probe";
  document.body.append(probe);

  return probe;
}

/**
 * React remote 暴露给 Shell 的统一挂载入口。
 *
 * Shell 会通过 Module Federation 加载该函数，并传入 DOM 容器和 basename。
 */
export function mount(context: MicroAppContext): MicroAppInstance {
  let root: Root | null = createRoot(context.container);
  const domEscapeProbe = createDomEscapeProbe("remote_react");

  // basename 让 remote 内部路由自然工作在 Shell 分配的子路径下。
  root.render(
    <BrowserRouter basename={context.basename}>
      <App portalContainer={context.container} />
    </BrowserRouter>,
  );

  return {
    unmount() {
      // Shell 切换路由时调用这里，确保 React root 和事件监听被释放。
      root?.unmount();
      root = null;
      domEscapeProbe?.remove();
    },
  };
}
