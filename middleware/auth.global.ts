import { useAuthStore } from "@/stores/auth";

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Add 'from' parameter
  console.log(
    `[Global Auth Middleware] Running. From: ${from.fullPath}, To: ${to.fullPath}`
  );

  const authStore = useAuthStore();

  // On client-side, wait for the auth store to be ready (hydrated from persisted state)
  if (import.meta.client && !authStore.isReady) {
    console.log(
      "[Global Auth Middleware] Store not ready on client, skipping run."
    );
    return; // Wait for the store to be ready via plugin
  }

  const isAuthenticated = authStore.isAuthenticated;
  const userHasHousehold = !!authStore.user?.householdId;

  const publicRoutes = ["/", "/login"];
  const setupRoutes = ["/setup-household", "/profile"]; // Routes allowed for users without household

  const isGoingToPublic = publicRoutes.includes(to.path);
  const isGoingToSetup = setupRoutes.includes(to.path);

  console.log(
    `[Global Auth Middleware] State: isAuthenticated=${isAuthenticated}, userHasHousehold=${userHasHousehold}, Target: ${to.path}`
  );

  // --- Scenario 1: User is NOT Authenticated ---
  if (!isAuthenticated) {
    if (isGoingToPublic) {
      console.log(
        "[Global Auth Middleware] Unauthenticated user accessing public route. Allowing."
      );
      return; // Allow access to public routes
    } else {
      console.log(
        `[Global Auth Middleware] Unauthenticated user accessing protected route ${to.path}. Redirecting to /login.`
      );
      return navigateTo("/login"); // Redirect to login for protected routes
    }
  }

  // --- Scenario 2: User IS Authenticated ---
  if (isAuthenticated) {
    // Redirect away from login page if authenticated
    if (to.path === "/login") {
      console.log(
        "[Global Auth Middleware] Authenticated user accessing /login. Redirecting to /home."
      );
      return navigateTo("/home");
    }

    // Sub-scenario 2a: User HAS a household
    if (userHasHousehold) {
      // If they have a household, they should NOT be on the setup page.
      if (to.path === "/setup-household") {
        console.log(
          "[Global Auth Middleware] User with household accessing /setup-household. Redirecting to /home."
        );
        return navigateTo("/home");
      }
      // Otherwise, allow access to any other route
      console.log(
        `[Global Auth Middleware] User with household accessing ${to.path}. Allowing.`
      );
      return;
    }

    // Sub-scenario 2b: User does NOT have a household
    if (!userHasHousehold) {
      // Allow access to the designated setup/profile routes
      if (isGoingToSetup) {
        console.log(
          `[Global Auth Middleware] User without household accessing allowed route ${to.path}. Allowing.`
        );
        return;
      }
      // Redirect to setup page if trying to access any other protected route
      console.log(
        `[Global Auth Middleware] User without household accessing protected route ${to.path}. Redirecting to /setup-household.`
      );
      return navigateTo("/setup-household");
    }
  }

  // Fallback (should not be reached ideally)
  console.warn(
    "[Global Auth Middleware] Fallback reached, something unexpected happened."
  );
});
