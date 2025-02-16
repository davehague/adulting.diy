import { useOrganizationStore } from "~/stores/organization";

export default defineNuxtRouteMiddleware(async (to) => {
  // Add safety check for SSR
  if (process.server) {
    console.log("[Auth Middleware] Deferring auth check during SSR");
    return;
  }

  const authStore = useAuthStore();
  const organizationStore = useOrganizationStore();
  const publicRoutes = ["/"];
  const authRoutes = ["/login"];
  const orgSetupRoutes = ["/organization/create"];

  console.log("[Auth Middleware] Route requested:", to.path);
  console.log("[Auth Middleware] Auth status:", authStore.isAuthenticated);

  // Allow public routes
  if (publicRoutes.includes(to.path)) {
    console.log("[Auth Middleware] Allowing public route access");
    return;
  }

  // Allow auth routes when not authenticated
  if (!authStore.isAuthenticated && authRoutes.includes(to.path)) {
    console.log(
      "[Auth Middleware] Allowing unauthenticated access to auth route"
    );
    return;
  }

  // Redirect to login if trying to access protected routes while not authenticated
  if (!authStore.isAuthenticated) {
    console.log("[Auth Middleware] Redirecting unauthenticated user to login");
    return navigateTo("/login");
  }

  // Redirect to home if trying to access auth routes while authenticated
  if (authStore.isAuthenticated && authRoutes.includes(to.path)) {
    console.log(
      "[Auth Middleware] Redirecting authenticated user away from auth route"
    );
    return navigateTo("/home");
  }

  // Check organization association if authenticated
  if (authStore.isAuthenticated && !organizationStore.currentOrganization) {
    console.log("[Auth Middleware] Checking organization association");

    // Add retry logic for timing-sensitive operations
    let retries = 3;
    while (retries > 0) {
      try {
        await organizationStore.fetchUserOrganization();
        console.log(
          "[Auth Middleware] Organization status:",
          !!organizationStore.currentOrganization
        );
        break;
      } catch (error) {
        console.error(
          `[Auth Middleware] Attempt ${4 - retries}/3 failed:`,
          error
        );
        retries--;
        if (retries === 0) {
          if (!orgSetupRoutes.includes(to.path)) {
            console.log(
              "[Auth Middleware] All retries failed, redirecting to organization creation"
            );
            return navigateTo("/organization/create", { replace: true });
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s between retries
        }
      }
    }

    // If still no organization and not on create org page, redirect to create
    if (
      !organizationStore.currentOrganization &&
      !orgSetupRoutes.includes(to.path)
    ) {
      console.log(
        "[Auth Middleware] No organization found, redirecting to create"
      );
      return navigateTo("/organization/create", { replace: true });
    }
  }
});
