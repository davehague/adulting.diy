<template>
  <ClientOnly>
    <div v-if="devStore.isEnabled" class="dev-user-switcher">
    <details class="relative">
      <summary class="dev-trigger">
        🧪 Dev: {{ currentUserDisplay }}
        <span v-if="devStore.isLoading" class="loading-spinner">⏳</span>
      </summary>
      
      <div class="dev-panel">
        <div class="dev-panel-header">
          <h3>🧪 Development User Switcher</h3>
          <p class="dev-warning">⚠️ Development Mode Only</p>
        </div>
        
        <div v-if="devStore.error" class="dev-error">
          {{ devStore.error }}
        </div>
        
        <div v-if="devStore.isLoading" class="dev-loading">
          Loading users...
        </div>
        
        <div v-else class="dev-users">
          <div class="current-user" v-if="authStore.user">
            <strong>Current:</strong> {{ authStore.user.name }} ({{ authStore.user.email }})
            <span v-if="authStore.user.householdId" class="household-badge">Has Household</span>
            <span v-else class="no-household-badge">No Household</span>
          </div>
          
          <div class="user-list">
            <button 
              v-for="user in devStore.availableUsers" 
              :key="user.id"
              @click="devStore.switchUser(user.id)"
              :class="{ 
                'user-button': true,
                'active': user.id === authStore.user?.id,
                'disabled': devStore.isLoading
              }"
              :disabled="devStore.isLoading"
            >
              <div class="user-info">
                <div class="user-name">{{ user.name }}</div>
                <div class="user-email">{{ user.email }}</div>
                <div class="user-badges">
                  <span v-if="user.isAdmin" class="admin-badge">Admin</span>
                  <span v-if="user.householdId" class="household-badge">Has Household</span>
                  <span v-else class="no-household-badge">No Household</span>
                </div>
              </div>
            </button>
          </div>
          
          <div class="dev-actions">
            <button 
              @click="devStore.logoutDev" 
              class="logout-button"
              :disabled="devStore.isLoading"
            >
              🚪 Logout Dev User
            </button>
            <button 
              @click="devStore.fetchUsers" 
              class="refresh-button"
              :disabled="devStore.isLoading"
            >
              🔄 Refresh Users
            </button>
          </div>
        </div>
      </div>
    </details>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDevAuthStore } from '@/stores/dev-auth';
import { useAuthStore } from '@/stores/auth';

const devStore = useDevAuthStore();
const authStore = useAuthStore();

const currentUserDisplay = computed(() => {
  if (authStore.user) {
    return `${authStore.user.name} (${authStore.user.email})`;
  }
  return 'None';
});

onMounted(() => {
  if (devStore.isEnabled) {
    console.log('[DEV SWITCHER] 🧪 Development mode enabled, loading users');
    devStore.fetchUsers();
  }
});
</script>

<style scoped>
.dev-user-switcher {
  position: fixed;
  bottom: 10px;
  right: 10px;
  z-index: 9999;
  font-family: monospace;
  font-size: 11px;
}

.dev-trigger {
  background: #ff6b6b;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  border: 2px solid #ff5252;
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dev-trigger:hover {
  background: #ff5252;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.dev-panel {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: white;
  color: black;
  border: 2px solid #ff6b6b;
  border-radius: 6px;
  padding: 12px;
  min-width: 350px;
  max-width: 400px;
  max-height: 500px;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  margin-bottom: 4px;
}

.dev-panel-header h3 {
  margin: 0 0 8px 0;
  color: #ff6b6b;
  font-size: 13px;
}

.dev-warning {
  background: #fff3cd;
  color: #856404;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  margin-bottom: 12px;
  border: 1px solid #ffeaa7;
}

.dev-error {
  background: #f8d7da;
  color: #721c24;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 10px;
  margin-bottom: 12px;
  border: 1px solid #f5c6cb;
}

.dev-loading {
  text-align: center;
  color: #666;
  padding: 20px;
}

.current-user {
  background: #e3f2fd;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  border: 1px solid #bbdefb;
}

.user-list {
  max-height: 250px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.user-button {
  display: block;
  width: 100%;
  padding: 8px;
  margin: 4px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.user-button:hover:not(.disabled) {
  background: #f5f5f5;
  border-color: #ff6b6b;
}

.user-button.active {
  background: #e8f5e8;
  border-color: #4caf50;
}

.user-button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: bold;
  font-size: 11px;
}

.user-email {
  color: #666;
  font-size: 10px;
}

.user-badges {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.admin-badge {
  background: #ff9800;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
}

.household-badge {
  background: #4caf50;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
}

.no-household-badge {
  background: #9e9e9e;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
}

.dev-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.logout-button {
  background: #f44336;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  flex: 1;
}

.logout-button:hover:not(:disabled) {
  background: #d32f2f;
}

.refresh-button {
  background: #2196f3;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  flex: 1;
}

.refresh-button:hover:not(:disabled) {
  background: #1976d2;
}

.logout-button:disabled,
.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>