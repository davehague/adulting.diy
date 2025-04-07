// utils/api.ts
import { useAuthStore } from "@/stores/auth";
import { useRuntimeConfig } from "#app";

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export const useApi = () => {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const apiFetch = async <T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> => {
    try {
      if (!process.client) {
        console.warn("[API] Attempting API call during SSR, deferring...");
        return Promise.resolve({} as T);
      }

      // Construct the full URL with query parameters if they exist
      const url = new URL(endpoint, window.location.origin);
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      // Prepare headers with authentication
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");

      // Add authorization header if we have a token
      if (authStore.accessToken) {
        headers.set("Authorization", `Bearer ${authStore.accessToken}`);
      }

      const response = await fetch(url.toString(), {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - could mean token expired
      if (response.status === 401) {
        authStore.logout(); // Clear the invalid token
        // Optionally redirect to login
        window.location.href = "/login";
        throw new Error("Authentication required");
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // Only try to parse JSON if we have a content-type header indicating JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      }

      return response as unknown as T;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  };

  // Helper methods for common HTTP methods
  const get = <T>(endpoint: string, options: FetchOptions = {}) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" });

  const post = <T>(
    endpoint: string,
    data: unknown,
    options: FetchOptions = {}
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    });

  const patch = <T>(
    endpoint: string,
    data: unknown,
    options: FetchOptions = {}
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(data),
    });

  const put = <T>(
    endpoint: string,
    data: unknown,
    options: FetchOptions = {}
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    });

  const del = <T>(endpoint: string, options: FetchOptions = {}) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" });

  return {
    fetch: apiFetch,
    get,
    post,
    put, // Add put method
    patch,
    delete: del,
  };
};
