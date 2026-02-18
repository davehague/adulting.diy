<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900 font-heading">Household Management</h1>
        <p class="text-stone-600 mt-1">Manage your household members and settings</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-stone-600">Loading household information...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error</h3>
          <div class="mt-2 text-sm text-red-700">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-6">
      <!-- Household Info Card -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div class="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <h2 class="text-lg font-semibold text-stone-900 font-heading">Household Information</h2>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Household Details -->
            <div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-stone-700 mb-2">Household Name</label>
                <div v-if="!editingName" class="flex items-center space-x-2">
                  <span class="text-lg font-medium text-stone-900">{{ householdInfo.name }}</span>
                  <button v-if="householdInfo.isCurrentUserAdmin" 
                          @click="startEditingName"
                          class="text-amber-700 hover:text-amber-800 text-sm">
                    Edit
                  </button>
                </div>
                <div v-else class="flex items-center space-x-2">
                  <input v-model="editedName" 
                         type="text" 
                         class="flex-1 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                         @keyup.enter="saveHouseholdName"
                         @keyup.escape="cancelEditingName">
                  <button @click="saveHouseholdName"
                          class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
                    <Check :size="16" />Save
                  </button>
                  <button @click="cancelEditingName"
                          class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                    <X :size="16" />Cancel
                  </button>
                </div>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-stone-700 mb-2">Members</label>
                <span class="text-2xl font-bold text-amber-700">{{ householdInfo.memberCount }}</span>
                <span class="text-stone-500 ml-2">member{{ householdInfo.memberCount !== 1 ? 's' : '' }}</span>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-stone-700 mb-2">Created</label>
                <span class="text-stone-600">{{ formatDate(householdInfo.createdAt) }}</span>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-stone-700 mb-2">Timezone</label>
                <div v-if="!editingTimezone" class="flex items-center space-x-2">
                  <span class="text-stone-900">{{ householdInfo.timezone }}</span>
                  <button v-if="householdInfo.isCurrentUserAdmin"
                          @click="startEditingTimezone"
                          class="text-amber-700 hover:text-amber-800 text-sm">
                    Edit
                  </button>
                </div>
                <div v-else class="flex items-center space-x-2">
                  <select v-model="editedTimezone"
                          class="flex-1 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
                    <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
                  </select>
                  <button @click="saveTimezone"
                          class="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700 transition-colors duration-150">
                    Save
                  </button>
                  <button @click="editingTimezone = false"
                          class="bg-stone-300 text-stone-700 px-3 py-1 rounded text-sm hover:bg-stone-400 transition-colors duration-150">
                    Cancel
                  </button>
                </div>
              </div>
              <div v-if="!householdInfo.isCurrentUserAdmin" class="mb-4">
                <label class="block text-sm font-medium text-stone-700 mb-2">Your Role</label>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
                  Member
                </span>
              </div>
            </div>

            <!-- Invite System -->
            <div>
              <!-- Admin View: Full invite controls -->
              <div v-if="householdInfo.isCurrentUserAdmin">
                <div class="mb-4">
                  <label class="block text-sm font-medium text-stone-700 mb-2">Invite Code</label>
                  <div class="flex items-center space-x-2">
                    <code class="bg-stone-100 px-3 py-2 rounded-md font-mono text-lg">{{ householdInfo.inviteCode }}</code>
                    <button @click="copyInviteCode"
                            class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
                      <Copy :size="16" />{{ copiedInviteCode ? 'Copied!' : 'Copy' }}
                    </button>
                  </div>
                  <p class="text-xs text-stone-500 mt-1">Share this code with others to invite them to your household</p>
                </div>
                
                <div class="space-y-2">
                  <button @click="regenerateInviteCode"
                          class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                    <RefreshCw :size="16" />Generate New Code
                  </button>
                  <p class="text-xs text-stone-500">This will invalidate the current invite code</p>
                </div>
              </div>
              
              <!-- Member View: Share household info only -->
              <div v-else>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-stone-700 mb-2">Share Household</label>
                  <div class="space-y-3">
                    <button @click="copyHouseholdInfo"
                            class="w-full inline-flex items-center justify-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                      <Copy :size="16" />
                      {{ copiedHouseholdInfo ? 'Copied!' : 'Copy Invitation' }}
                    </button>
                    <p class="text-xs text-stone-500">Share household invitation with others</p>
                  </div>
                </div>
                
                <div class="mb-4">
                  <label class="block text-sm font-medium text-stone-700 mb-2">Contact Admin</label>
                  <p class="text-xs text-stone-500 mb-2">For household settings changes, contact an admin:</p>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="admin in admins" :key="admin.id" 
                          class="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                      {{ admin.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Members Management -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div class="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-stone-900 font-heading">Household Members</h2>
            <span v-if="!householdInfo.isCurrentUserAdmin" class="text-xs text-stone-500">
              View only - Contact admin for changes
            </span>
          </div>
        </div>
        <!-- Mobile member cards -->
        <div class="md:hidden divide-y divide-stone-100">
          <div v-for="member in members" :key="'m-' + member.id"
               class="p-4"
               :class="member.id === currentUserId ? 'bg-amber-50' : ''">
            <div class="flex items-center gap-3 mb-2">
              <div class="h-10 w-10 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                <span class="text-white font-medium text-sm">{{ getInitials(member.name) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-stone-900">
                  {{ member.name }}
                  <span v-if="member.id === currentUserId" class="text-xs text-amber-700 ml-1 font-semibold">(You)</span>
                </div>
                <div class="text-sm text-stone-500 truncate">{{ member.email }}</div>
              </div>
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0"
                    :class="member.isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-stone-100 text-stone-800'">
                {{ member.isAdmin ? 'Admin' : 'Member' }}
              </span>
            </div>
            <div class="flex items-center justify-between pl-13">
              <span class="text-xs text-stone-500">Joined {{ formatDate(member.createdAt) }}</span>
              <div v-if="householdInfo.isCurrentUserAdmin && member.id !== currentUserId" class="flex gap-2">
                <button v-if="!member.isAdmin" @click="makeAdmin(member.id, member.name)" class="text-xs text-amber-700 hover:text-amber-900">Make Admin</button>
                <button v-else-if="!isOnlyAdmin(member.id)" @click="removeAdmin(member.id, member.name)" class="text-xs text-yellow-600 hover:text-yellow-900">Remove Admin</button>
                <button @click="removeMember(member.id, member.name)" class="text-xs text-red-600 hover:text-red-900">Remove</button>
              </div>
              <span v-else-if="householdInfo.isCurrentUserAdmin && member.id === currentUserId" class="text-xs text-stone-400">Current User</span>
            </div>
          </div>
        </div>
        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="min-w-full divide-y divide-stone-200">
            <thead class="bg-stone-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Member
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Joined
                </th>
                <th v-if="householdInfo.isCurrentUserAdmin" 
                    scope="col" class="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-stone-200">
              <tr v-for="member in members" :key="member.id" 
                  :class="member.id === currentUserId ? 'bg-amber-50' : ''">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full flex items-center justify-center"
                           :class="member.id === currentUserId ? 'bg-amber-600' : 'bg-amber-600'">
                        <span class="text-white font-medium text-sm">{{ getInitials(member.name) }}</span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-stone-900">
                        {{ member.name }}
                        <span v-if="member.id === currentUserId" class="text-xs text-amber-700 ml-1 font-semibold">(You)</span>
                      </div>
                      <div class="text-sm text-stone-500">{{ member.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="member.isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-stone-100 text-stone-800'">
                    {{ member.isAdmin ? 'Admin' : 'Member' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                  {{ formatDate(member.createdAt) }}
                </td>
                <td v-if="householdInfo.isCurrentUserAdmin" 
                    class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <template v-if="member.id !== currentUserId">
                    <button v-if="!member.isAdmin" 
                            @click="makeAdmin(member.id, member.name)"
                            class="text-amber-700 hover:text-amber-900">
                      Make Admin
                    </button>
                    <button v-else-if="!isOnlyAdmin(member.id)" 
                            @click="removeAdmin(member.id, member.name)"
                            class="text-yellow-600 hover:text-yellow-900">
                      Remove Admin
                    </button>
                    <button @click="removeMember(member.id, member.name)"
                            class="text-red-600 hover:text-red-900">
                      Remove
                    </button>
                  </template>
                  <span v-else class="text-stone-400 text-sm">Current User</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Quick Actions Panel -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div class="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <h2 class="text-lg font-semibold text-stone-900 font-heading">Quick Actions</h2>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NuxtLink to="/tasks" 
                      class="flex items-center p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <h3 class="text-sm font-medium text-stone-900">Manage Tasks</h3>
                <p class="text-xs text-stone-500">Create and organize household tasks</p>
              </div>
            </NuxtLink>

            <NuxtLink to="/occurrences" 
                      class="flex items-center p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <h3 class="text-sm font-medium text-stone-900">View Occurrences</h3>
                <p class="text-xs text-stone-500">See all pending and completed tasks</p>
              </div>
            </NuxtLink>

            <button @click="copyHouseholdInfo" 
                    class="flex items-center p-4 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-left">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <h3 class="text-sm font-medium text-stone-900">Share Household</h3>
                <p class="text-xs text-stone-500">{{ copiedHouseholdInfo ? 'Copied!' : 'Copy invite info to share' }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Household Statistics -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div class="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <h2 class="text-lg font-semibold text-stone-900 font-heading">Household Overview</h2>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="text-center">
              <div class="text-2xl font-bold text-amber-700">{{ householdInfo.memberCount }}</div>
              <div class="text-sm text-stone-500">Total Members</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-600">{{ adminCount }}</div>
              <div class="text-sm text-stone-500">Admin{{ adminCount !== 1 ? 's' : '' }}</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">{{ daysSinceCreated }}</div>
              <div class="text-sm text-stone-500">Days Active</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-stone-600">{{ householdInfo.inviteCode.length }}</div>
              <div class="text-sm text-stone-500">Char Invite Code</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden border-l-4 border-red-500">
        <div class="px-6 py-4 bg-red-50 border-b border-red-200">
          <h2 class="text-lg font-semibold text-red-800 font-heading">
            {{ householdInfo.isCurrentUserAdmin ? 'Admin Settings' : 'Account Settings' }}
          </h2>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div>
              <h3 class="text-sm font-medium text-stone-900 mb-2 font-heading">Leave Household</h3>
              <p class="text-sm text-stone-600 mb-3">
                Once you leave, you'll lose access to all household tasks and data. 
                <span v-if="householdInfo.isCurrentUserAdmin">
                  As an admin, you may need to transfer admin privileges to another member first.
                </span>
                <span v-else>
                  You can rejoin using the household invite code if needed.
                </span>
              </p>
              <button @click="leaveHousehold"
                      class="inline-flex items-center gap-1.5 text-red-500 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <LogOut :size="16" />Leave Household
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="confirmModal.show" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="fixed inset-0 bg-black/50" @click="confirmModal.show = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl border border-stone-200 max-w-md w-full mx-4 p-6">
          <h3 class="text-lg font-semibold text-stone-900 font-heading mb-2">{{ confirmModal.title }}</h3>
          <p class="text-sm text-stone-600 mb-6">{{ confirmModal.message }}</p>
          <div class="flex justify-end gap-3">
            <button @click="confirmModal.show = false"
                    class="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors">
              Cancel
            </button>
            <button @click="confirmModal.onConfirm"
                    class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    :class="confirmModal.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'">
              {{ confirmModal.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Success/Error Messages -->
    <div v-if="successMessage"
         class="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md shadow-lg">
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useApi } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { Check, X, Copy, RefreshCw, LogOut } from 'lucide-vue-next';
import type { User } from '@/types';

const api = useApi();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref('');
const successMessage = ref('');
const householdInfo = ref({
  id: '',
  name: '',
  inviteCode: '',
  timezone: 'UTC',
  memberCount: 0,
  isCurrentUserAdmin: false,
  createdAt: '',
  updatedAt: ''
});
const members = ref<User[]>([]);
const editingName = ref(false);
const editedName = ref('');
const editingTimezone = ref(false);
const editedTimezone = ref('');
const copiedInviteCode = ref(false);
const copiedHouseholdInfo = ref(false);
const confirmModal = ref({
  show: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  destructive: false,
  onConfirm: () => {},
});

const commonTimezones = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Phoenix',
  'America/Toronto', 'America/Vancouver',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Australia/Perth',
  'Pacific/Auckland',
];

const currentUserId = authStore.user?.id;

// Computed properties
const adminCount = computed(() => {
  return members.value.filter(member => member.isAdmin).length;
});

const admins = computed(() => {
  return members.value.filter(member => member.isAdmin);
});

const daysSinceCreated = computed(() => {
  if (!householdInfo.value.createdAt) return 0;
  const created = new Date(householdInfo.value.createdAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Load data
onMounted(async () => {
  await fetchHouseholdData();
});

const fetchHouseholdData = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    // Fetch household info and members in parallel
    const [householdResponse, membersResponse] = await Promise.all([
      api.get('/api/household'),
      api.get<User[]>('/api/household/users')
    ]);
    
    householdInfo.value = householdResponse;
    members.value = membersResponse;
  } catch (err: any) {
    console.error('Error fetching household data:', err);
    error.value = err.data?.message || 'Failed to load household information';
  } finally {
    loading.value = false;
  }
};

// Helper functions
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const showSuccess = (message: string) => {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = '';
  }, 5000);
};

const showConfirm = (opts: { title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void }) => {
  confirmModal.value = {
    show: true,
    title: opts.title,
    message: opts.message,
    confirmLabel: opts.confirmLabel,
    destructive: opts.destructive ?? false,
    onConfirm: () => {
      confirmModal.value.show = false;
      opts.onConfirm();
    },
  };
};

const isOnlyAdmin = (userId: string): boolean => {
  const adminCount = members.value.filter(m => m.isAdmin).length;
  const userIsAdmin = members.value.find(m => m.id === userId)?.isAdmin || false;
  return userIsAdmin && adminCount === 1;
};

// Household name editing
const startEditingName = () => {
  editedName.value = householdInfo.value.name;
  editingName.value = true;
};

const cancelEditingName = () => {
  editingName.value = false;
  editedName.value = '';
};

const saveHouseholdName = async () => {
  if (!editedName.value.trim()) return;
  
  try {
    const response = await api.put('/api/household', {
      name: editedName.value.trim()
    });
    
    householdInfo.value.name = response.name;
    editingName.value = false;
    showSuccess('Household name updated successfully');
  } catch (err: any) {
    console.error('Error updating household name:', err);
    error.value = err.data?.message || 'Failed to update household name';
  }
};

// Timezone editing
const startEditingTimezone = () => {
  editedTimezone.value = householdInfo.value.timezone;
  editingTimezone.value = true;
};

const saveTimezone = async () => {
  if (!editedTimezone.value) return;

  try {
    const response = await api.put('/api/household', {
      timezone: editedTimezone.value
    });

    householdInfo.value.timezone = response.timezone;
    editingTimezone.value = false;
    showSuccess('Household timezone updated successfully');
  } catch (err: any) {
    console.error('Error updating timezone:', err);
    error.value = err.data?.message || 'Failed to update timezone';
  }
};

// Invite code management
const copyInviteCode = async () => {
  try {
    await navigator.clipboard.writeText(householdInfo.value.inviteCode);
    copiedInviteCode.value = true;
    setTimeout(() => {
      copiedInviteCode.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy invite code:', err);
    error.value = 'Failed to copy invite code';
  }
};

const regenerateInviteCode = () => {
  showConfirm({
    title: 'Generate New Invite Code',
    message: 'The current invite code will stop working immediately. Anyone who has the old code will no longer be able to join.',
    confirmLabel: 'Generate New Code',
    onConfirm: async () => {
      try {
        const response = await api.post('/api/household/invite-code/regenerate', {});
        householdInfo.value.inviteCode = response.inviteCode;
        showSuccess('New invite code generated successfully');
      } catch (err: any) {
        console.error('Error regenerating invite code:', err);
        error.value = err.data?.message || 'Failed to regenerate invite code';
      }
    },
  });
};

const copyHouseholdInfo = async () => {
  try {
    const inviteText = `Join "${householdInfo.value.name}" household on Adulting.DIY!\n\nInvite Code: ${householdInfo.value.inviteCode}\n\nGo to the app and use this code to join our household.`;
    
    await navigator.clipboard.writeText(inviteText);
    copiedHouseholdInfo.value = true;
    setTimeout(() => {
      copiedHouseholdInfo.value = false;
    }, 2000);
    showSuccess('Household invitation copied to clipboard');
  } catch (err) {
    console.error('Failed to copy household info:', err);
    error.value = 'Failed to copy household information';
  }
};

// Member management
const makeAdmin = async (userId: string, userName: string) => {
  if (!confirm(`Make ${userName} a household admin? They will be able to manage members and settings.`)) {
    return;
  }
  
  try {
    await api.put(`/api/household/users/${userId}/admin`, { isAdmin: true });
    
    // Update local state
    const member = members.value.find(m => m.id === userId);
    if (member) {
      member.isAdmin = true;
    }
    
    showSuccess(`${userName} is now a household admin`);
  } catch (err: any) {
    console.error('Error making user admin:', err);
    error.value = err.data?.message || 'Failed to update admin status';
  }
};

const removeAdmin = async (userId: string, userName: string) => {
  if (!confirm(`Remove admin privileges from ${userName}?`)) {
    return;
  }
  
  try {
    await api.put(`/api/household/users/${userId}/admin`, { isAdmin: false });
    
    // Update local state
    const member = members.value.find(m => m.id === userId);
    if (member) {
      member.isAdmin = false;
    }
    
    showSuccess(`${userName} is no longer a household admin`);
  } catch (err: any) {
    console.error('Error removing admin:', err);
    error.value = err.data?.message || 'Failed to update admin status';
  }
};

const removeMember = async (userId: string, userName: string) => {
  if (!confirm(`Remove ${userName} from the household? They will lose access to all household tasks and data.`)) {
    return;
  }
  
  try {
    await api.delete(`/api/household/users/${userId}`);
    
    // Update local state
    members.value = members.value.filter(m => m.id !== userId);
    householdInfo.value.memberCount--;
    
    showSuccess(`${userName} has been removed from the household`);
  } catch (err: any) {
    console.error('Error removing member:', err);
    error.value = err.data?.message || 'Failed to remove member';
  }
};

const leaveHousehold = () => {
  const message = householdInfo.value.isCurrentUserAdmin && householdInfo.value.memberCount > 1
    ? 'As an admin, you may need to transfer admin privileges to another member first. You will lose access to all household tasks and data.'
    : 'You will lose access to all household tasks and data. You can rejoin later using the household invite code.';

  showConfirm({
    title: 'Leave Household',
    message,
    confirmLabel: 'Leave Household',
    destructive: true,
    onConfirm: async () => {
      try {
        await api.post('/api/household/leave', {});
        await navigateTo('/setup-household');
      } catch (err: any) {
        console.error('Error leaving household:', err);
        error.value = err.data?.message || 'Failed to leave household';
      }
    },
  });
};

// Page metadata
definePageMeta({
  title: 'Household Management'
});
</script>