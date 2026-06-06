import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

// Shell 独立启动时拥有自己的 BrowserRouter，remote 子路由由边界组件继续分发。
createRoot(rootElement).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
