<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { createRemotePreloader, RemoteAppBoundary } from "@federlet/vue-shell";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { remoteRoutes } from "./remote-routes";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

const route = useRoute();
const router = useRouter();
const routes = ref<RemoteRouteConfig[]>(remoteRoutes);
const routesReady = ref(false);
const remotePreloader = createRemotePreloader();
let removePreloadGuard: (() => void) | undefined;

function findRemoteRouteByPath(
  path: string,
  remoteRouteConfigs: RemoteRouteConfig[],
) {
  return remoteRouteConfigs.find(
    (remoteRoute) =>
      path === remoteRoute.basename ||
      path.startsWith(`${remoteRoute.basename}/`),
  );
}

const currentRemoteRoute = computed(() =>
  routesReady.value ? findRemoteRouteByPath(route.path, routes.value) : undefined,
);

const isHome = computed(() => route.path === "/");
const shouldShowRouteLoading = computed(
  () => !routesReady.value && !isHome.value,
);

async function preloadRemoteRoute(remoteRoute: RemoteRouteConfig) {
  try {
    await remotePreloader.preload(remoteRoute);
  } catch (error) {
    console.error(`Failed to preload remote ${remoteRoute.id}`, error);
  }
}

onMounted(async () => {
  const runtimeRoutes = await loadRuntimeRemoteRoutes({
    fallbackRoutes: remoteRoutes,
  });
  routes.value = runtimeRoutes;

  const initialRemoteRoute = findRemoteRouteByPath(route.path, runtimeRoutes);

  if (!isHome.value && !initialRemoteRoute) {
    routesReady.value = true;
    await router.replace("/");
    return;
  }

  if (initialRemoteRoute) {
    await preloadRemoteRoute(initialRemoteRoute);
  }

  routesReady.value = true;
  removePreloadGuard = router.beforeResolve(async (to) => {
    const targetRemoteRoute = findRemoteRouteByPath(to.path, routes.value);

    if (targetRemoteRoute) {
      await preloadRemoteRoute(targetRemoteRoute);
    }
  });
});

onBeforeUnmount(() => {
  removePreloadGuard?.();
});
</script>

<template>
  <div class="shell">
    <aside class="shell__sidebar">
      <RouterLink to="/" class="shell__brand">Federlet Vue</RouterLink>
      <nav>
        <RouterLink
          v-for="remoteRoute in routes"
          :key="remoteRoute.id"
          :to="remoteRoute.basename"
          class="shell__nav-link"
          active-class="shell__nav-link--active"
          @focus="preloadRemoteRoute(remoteRoute)"
          @mouseenter="preloadRemoteRoute(remoteRoute)"
        >
          {{ remoteRoute.title }}
        </RouterLink>
      </nav>
    </aside>

    <main v-if="isHome" class="home">
      <p class="eyebrow">Rspack Module Federation</p>
      <h1>Vue Shell for mixed-framework remotes</h1>
      <p>
        The shell owns global layout and routing while each remote exposes a
        framework-neutral mount lifecycle.
      </p>

      <div class="remote-grid">
        <RouterLink
          v-for="remoteRoute in routes"
          :key="remoteRoute.id"
          :to="remoteRoute.basename"
          class="remote-card"
          @focus="preloadRemoteRoute(remoteRoute)"
          @mouseenter="preloadRemoteRoute(remoteRoute)"
        >
          <span>{{ remoteRoute.title }}</span>
          <strong>{{ remoteRoute.remoteName }}</strong>
        </RouterLink>
      </div>
    </main>

    <main v-else-if="shouldShowRouteLoading" class="home">
      Loading remote routes...
    </main>

    <RemoteAppBoundary
      v-else-if="currentRemoteRoute"
      :key="currentRemoteRoute.id"
      :route="currentRemoteRoute"
    />
  </div>
</template>
