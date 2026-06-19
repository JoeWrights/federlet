import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { setupShellRuntimeEnvironment } from "./config/runtime-env";
import "./styles.css";

setupShellRuntimeEnvironment();

const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    {
      component: App,
      path: "/:pathMatch(.*)*",
    },
  ],
});

createApp(App).use(router).mount("#root");
