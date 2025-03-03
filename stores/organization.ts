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
    const memberCount = computed(() => members.value?.length ?? 0);
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
        const orgResponse = await api.get<Organization>(
          "/api/organization/current"
        );
        console.log("currentOrganization.value", orgResponse);

        if (!orgResponse || !orgResponse.id) {
          throw new Error("Invalid organization data received");
        }

        // Update organization first
        currentOrganization.value = orgResponse;

        // Then fetch members for this org
        const membersResponse = await api.get<OrganizationMember[]>(
          `/api/organization/${orgResponse.id}/members`
        );

        if (membersResponse) {
          members.value = membersResponse || [];
        }

        return {
          organization: currentOrganization.value,
          members: members.value,
        };
      } catch (e) {
        console.error("[OrganizationStore] Error fetching organization:", e);
        error.value =
          e instanceof Error ? e.message : "Failed to fetch organization";
        // Clear loading but don't clear other values to prevent UI flashing
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const fetchMembers = async () => {
      if (!currentOrganization.value?.id) {
        console.error("[OrganizationStore] No organization ID available");
        return;
      }

      loading.value = true;
      try {
        const response = await api.get<{ members: OrganizationMember[] }>(
          `/api/organization/${currentOrganization.value.id}/members`
        );
        members.value = response.members || [];
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
      if (!currentOrganization.value?.id) {
        console.error("[OrganizationStore] No organization ID available");
        return;
      }

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
      if (!currentOrganization.value?.id) {
        console.error("[OrganizationStore] No organization ID available");
        return;
      }

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

    const updateOrganization = async (
      updateData: Partial<Organization> & { id: number }
    ) => {
      if (!currentOrganization.value?.id) {
        console.error("[OrganizationStore] No organization ID available");
        return;
      }

      loading.value = true;
      try {
        const response = await api.patch<{ organization: Organization }>(
          `/api/organization/${updateData.id}`,
          {
            name: updateData.name,
            description: updateData.description,
          }
        );

        currentOrganization.value = response.organization;
        return response.organization;
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to update organization";
        throw error.value;
      } finally {
        loading.value = false;
      }
    };

    const deleteOrganization = async (organizationId: number) => {
      loading.value = true;
      try {
        await api.delete(`/api/organization/${organizationId}`);

        // Clear organization state
        currentOrganization.value = null;
        userRole.value = null;
        members.value = [];
        pendingInvites.value = [];
      } catch (e) {
        error.value =
          e instanceof Error ? e.message : "Failed to delete organization";
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
      updateOrganization,
      deleteOrganization,
    };
  },
  {
    persist: true,
  }
);
