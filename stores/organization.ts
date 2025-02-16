import { defineStore } from "pinia";
import {
  type CreateOrganizationDTO,
  type Organization,
  type OrganizationMember,
} from "~/types";

export const useOrganizationStore = defineStore("organization", () => {
  const currentOrganization = ref<Organization | null>(null);
  const userRole = ref<OrganizationMember["role"] | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const createOrganization = async (orgData: CreateOrganizationDTO) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await useFetch("/api/organization/create", {
        method: "POST",
        body: orgData,
      });

      if (response.error.value) {
        throw new Error(response.error.value.message);
      }

      currentOrganization.value = response.data.value as Organization;
      userRole.value = "admin";
      return response.data.value;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Failed to create organization";
      throw error.value;
    } finally {
      loading.value = false;
    }
  };

  const fetchUserOrganization = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await useFetch<{
        organization: Organization;
        role: OrganizationMember["role"];
      }>("/api/organization/current");

      if (response.error.value) {
        throw new Error(response.error.value.message);
      }

      if (response.data.value) {
        currentOrganization.value = response.data.value.organization;
        userRole.value = response.data.value.role;
      }
      return response.data.value;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Failed to fetch organization";
      throw error.value;
    } finally {
      loading.value = false;
    }
  };

  return {
    currentOrganization,
    userRole,
    loading,
    error,
    createOrganization,
    fetchUserOrganization,
  };
});
