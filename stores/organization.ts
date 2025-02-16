import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useApi } from "@/utils/api";
import type {
  Organization,
  OrganizationMember,
  OrganizationInvite,
  CreateOrganizationDTO,
  CreateInviteDTO,
} from "@/types/organization";

export const useOrganizationStore = defineStore(
  "organization",
  () => {
    const api = useApi();

    // State
    const currentOrganization = ref<Organization | null>(null);
    const userRole = ref<OrganizationMember["role"] | null>(null);
    const members = ref<OrganizationMember[]>([]);
    const pendingInvites = ref<OrganizationInvite[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Getters
    const isAdmin = computed(() => userRole.value === "admin");
    const isMember = computed(() => !!userRole.value);
    const memberCount = computed(() => members.value.length);
    const inviteCount = computed(() => pendingInvites.value.length);

    // Actions
    const createOrganization = async (orgData: CreateOrganizationDTO) => {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.post<{ organization: Organization }>(
          "/api/organization/create",
          orgData
        );
        currentOrganization.value = response.organization;
        userRole.value = "admin";
        return response.organization;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to create organization";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchUserOrganization = async () => {
      if (!process.client) {
        console.warn(
          "[OrganizationStore] Attempting to fetch during SSR, deferring..."
        );
        return null;
      }

      loading.value = true;
      error.value = null;

      try {
        const response = await api.get<{
          organization: Organization;
          role: OrganizationMember["role"];
          members: OrganizationMember[];
        }>("/api/organization/current");

        console.log("[OrganizationStore] Fetched organization:", response);

        if (!response) {
          throw new Error("No response received from API");
        }

        currentOrganization.value = response.organization;
        userRole.value = response.role;
        members.value = response.members;
        return response;
      } catch (e) {
        console.error("[OrganizationStore] Error fetching organization:", e);
        error.value =
          e instanceof Error ? e.message : "Failed to fetch organization";
        // Don't clear values on error to prevent UI flashing
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchMembers = async () => {
      if (!currentOrganization.value) return;

      loading.value = true;
      try {
        const response = await api.get<{ members: OrganizationMember[] }>(
          `/api/organization/${currentOrganization.value.id}/members`
        );
        members.value = response.members;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to fetch members";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchPendingInvites = async () => {
      if (!currentOrganization.value) return;

      loading.value = true;
      try {
        const response = await api.get<{ invites: OrganizationInvite[] }>(
          `/api/organization/${currentOrganization.value.id}/invites`
        );
        pendingInvites.value = response.invites;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to fetch invites";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const inviteMember = async (inviteData: CreateInviteDTO) => {
      if (!currentOrganization.value) return;

      loading.value = true;
      try {
        const response = await api.post<{ invite: OrganizationInvite }>(
          `/api/organization/${currentOrganization.value.id}/invites`,
          inviteData
        );
        pendingInvites.value = [...pendingInvites.value, response.invite];
        return response.invite;
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to send invite";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const updateMemberRole = async (
      memberId: string,
      role: OrganizationMember["role"]
    ) => {
      if (!currentOrganization.value) return;

      loading.value = true;
      try {
        await api.patch(
          `/api/organization/${currentOrganization.value.id}/members/${memberId}`,
          { role }
        );

        // Update local state
        members.value = members.value.map((member) =>
          member.id === memberId ? { ...member, role } : member
        );
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to update member role";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const removeMember = async (memberId: string) => {
      if (!currentOrganization.value) return;

      loading.value = true;
      try {
        await api.delete(
          `/api/organization/${currentOrganization.value.id}/members/${memberId}`
        );
        members.value = members.value.filter(
          (member) => member.id !== memberId
        );
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to remove member";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const cancelInvite = async (inviteId: string) => {
      if (!currentOrganization.value) return;

      loading.value = true;
      try {
        await api.delete(
          `/api/organization/${currentOrganization.value.id}/invites/${inviteId}`
        );
        pendingInvites.value = pendingInvites.value.filter(
          (invite) => invite.id !== inviteId
        );
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to cancel invite";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    return {
      // State
      currentOrganization,
      userRole,
      members,
      pendingInvites,
      loading,
      error,

      // Getters
      isAdmin,
      isMember,
      memberCount,
      inviteCount,

      // Actions
      createOrganization,
      fetchUserOrganization,
      fetchMembers,
      fetchPendingInvites,
      inviteMember,
      updateMemberRole,
      removeMember,
      cancelInvite,
    };
  },
  {
    persist: true,
  }
);
