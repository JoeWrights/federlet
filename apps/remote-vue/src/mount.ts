import { createApp, type App as VueApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import type {
  MicroAppContext,
  MicroAppInstance,
} from "@federlet/shared-types";
import App from "./App.vue";
import { createVueRemoteRoutes } from "./routes";
import "./styles.css";

/**
 * 为 Vue remote 创建局部路由实例。
 *
 * basename 由 Shell 注入，使 remote 可以挂载在 `/vue` 这类子路径下。
 */
function createRemoteRouter(basename: string) {
  return createRouter({
    history: createWebHistory(basename),
    routes: createVueRemoteRoutes(),
  });
}

/**
 * Vue remote 暴露给 Shell 的统一挂载入口。
 */
export function mount(context: MicroAppContext): MicroAppInstance {
  let app: VueApp<Element> | null = createApp(App);
  const router = createRemoteRouter(context.basename);

  // remote 自己维护内部路由，Shell 只负责把入口路径分配给它。
  app.use(router);
  app.mount(context.container);

  return {
    unmount() {
      // Shell 路由离开时释放 Vue 应用实例。
      app?.unmount();
      app = null;
    },
  };
}
