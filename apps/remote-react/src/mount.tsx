import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type {
  MicroAppContext,
  MicroAppInstance,
} from "@federlet/shared-types";
import { App } from "./App";
import "./styles.css";

/**
 * React remote 暴露给 Shell 的统一挂载入口。
 *
 * Shell 会通过 Module Federation 加载该函数，并传入 DOM 容器和 basename。
 */
export function mount(context: MicroAppContext): MicroAppInstance {
  let root: Root | null = createRoot(context.container);

  // basename 让 remote 内部路由自然工作在 Shell 分配的子路径下。
  root.render(
    <BrowserRouter basename={context.basename}>
      <App />
    </BrowserRouter>,
  );

  return {
    unmount() {
      // Shell 切换路由时调用这里，确保 React root 和事件监听被释放。
      root?.unmount();
      root = null;
    },
  };
}
