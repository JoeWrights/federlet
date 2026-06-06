import { mount } from "./mount";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

// 独立访问 Vue remote 时复用同一套 mount 协议，保证与 Shell 挂载路径一致。
mount({
  basename: "/",
  container: rootElement,
});
