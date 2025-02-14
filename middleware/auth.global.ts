import { useOrganizationStore } from "~/stores/organization";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const organizationStore = useOrganizationStore();
  const publicRoutes = ["/"];
  const authRoutes = ["/login"];
  const orgSetupRoutes = ["/organization/create"];

  // Allow public routes
  if (publicRoutes.includes(to.path)) {
    return;
  }

  // Allow auth routes when not authenticated
  if (!authStore.isAuthenticated && authRoutes.includes(to.path)) {
    return;
  }

  // Redirect to login if trying to access protected routes while not authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo("/login");
  }

  // Redirect to home if trying to access auth routes while authenticated
  if (authStore.isAuthenticated && authRoutes.includes(to.path)) {
    return navigateTo("/home");
  }

  // Check organization association if authenticated
  if (authStore.isAuthenticated && !organizationStore.currentOrganization) {
    try {
      await organizationStore.fetchUserOrganization();

      // If still no organization and not on create org page, redirect to create
      if (
        !organizationStore.currentOrganization &&
        !orgSetupRoutes.includes(to.path)
      ) {
        return navigateTo("/organization/create");
      }
    } catch (error) {
      console.error("Failed to fetch organization:", error);
      // Handle error appropriately
    }
  }
});
