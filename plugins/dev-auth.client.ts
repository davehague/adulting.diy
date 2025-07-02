export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  
  if (config.public.devBypassEnabled) {
    console.log('🧪 Development login bypass is ENABLED');
    console.log('🧪 You can switch users using the red switcher in the top-right corner');
    
    // Auto-load dev users on startup
    const devStore = useDevAuthStore();
    
    // Load users after a short delay to ensure the store is ready
    setTimeout(() => {
      devStore.fetchUsers();
    }, 500);
  }
});