<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { RemoteAppBoundary } from "@federlet/vue-shell";
import type { RemoteRouteConfig } from "@federlet/shared-types";
import { remoteRoutes } from "./remote-routes";
import { loadRuntimeRemoteRoutes } from "./runtime-manifest";

const route = useRoute();
const router = useRouter();
const routes = ref<RemoteRouteConfig[]>(remoteRoutes);
const routesReady = ref(false);

const currentRemoteRoute = computed(() =>
  routesReady.value
    ? routes.value.find((remoteRoute) =>
        route.path === remoteRoute.basename ||
        route.path.startsWith(`${remoteRoute.basename}/`),
      )
    : undefined,
);

const isHome = computed(() => route.path === "/");
const shouldShowRouteLoading = computed(
  () => !routesReady.value && !isHome.value,
);

onMounted(async () => {
  const runtimeRoutes = await loadRuntimeRemoteRoutes({
    fallbackRoutes: remoteRoutes,
  });
  routes.value = runtimeRoutes;
  routesReady.value = true;

  if (!isHome.value && !currentRemoteRoute.value) {
    await router.replace("/");
  }
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
