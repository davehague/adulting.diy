<template>
  <div>
    <!-- Development User Switcher - Global -->
    <DevUserSwitcher />

    <NuxtLayout>
      <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
    </NuxtLayout>

    <AppToast />
  </div>
</template>