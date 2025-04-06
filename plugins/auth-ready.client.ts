import { useAuthStore } from "@/stores/auth";

export default defineNuxtPlugin(async (nuxtApp) => {
  // Access the store instance
  const authStore = useAuthStore(); // Access store without explicit instance

  // Pinia persisted state hydration happens asynchronously after the store is initialized.
  // We need to wait for the next tick or potentially use a small delay
  // to ensure the persisted state has likely been loaded before marking ready.
  // Using nextTick is generally preferred.
  await nextTick();

  // Mark the store as ready
  authStore.markReady();
  console.log("[Auth Ready Plugin] Auth store marked as ready.");
});
