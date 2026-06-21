import { createRemoteScopeClass } from "@federlet/style-isolation/scope";
import { mount, REMOTE_NAME } from "./mount";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

rootElement.classList.add(createRemoteScopeClass(REMOTE_NAME));

// 独立访问 Vue remote 时复用同一套 mount 协议，保证与 Shell 挂载路径一致。
mount({
  basename: "/",
  container: rootElement,
});
