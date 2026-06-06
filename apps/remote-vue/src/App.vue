<template>
  <!-- Vue remote 的外壳页面，内部子页面由 RouterView 承载。 -->
  <article class="vue-remote">
    <p class="vue-remote__eyebrow">Vue remote</p>
    <h1>Analytics powered by Vue</h1>
    <p>
      This micro app is mounted into the React shell through the same lifecycle
      contract as the React remote.
    </p>

    <nav class="vue-remote__tabs">
      <RouterLink to="/">Overview</RouterLink>
      <RouterLink to="/reports">Reports</RouterLink>
    </nav>

    <RouterView />
  </article>
</template>
