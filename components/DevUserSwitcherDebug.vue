<template>
  <ClientOnly>
    <div class="dev-debug-info">
      <div class="debug-panel">
        <h4>🐛 Debug Info</h4>
        <p>Dev Mode: {{ config?.public?.isDevMode || 'undefined' }}</p>
        <p>Dev Bypass Enabled: {{ config?.public?.devBypassEnabled || 'undefined' }}</p>
        <p>Store Enabled: {{ devStore?.isEnabled || 'undefined' }}</p>
        <p>Store Loaded: {{ devStore?.availableUsers?.length || 0 }} users</p>
        <p>Store Error: {{ devStore?.error || 'None' }}</p>
        <button @click="testFetch" class="test-btn">Test API</button>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDevAuthStore } from '@/stores/dev-auth';

const devStore = useDevAuthStore();
const config = useRuntimeConfig();

const testFetch = async () => {
  console.log('Testing API fetch...');
  await devStore.fetchUsers();
};
</script>

<style scoped>
.dev-debug-info {
  position: fixed;
  bottom: 10px;
  right: 10px;
  z-index: 9999;
  background: #333;
  color: white;
  padding: 10px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 10px;
  max-width: 300px;
}

.debug-panel h4 {
  margin: 0 0 8px 0;
  color: #ff6b6b;
}

.debug-panel p {
  margin: 2px 0;
  word-break: break-all;
}

.test-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 9px;
  margin-top: 5px;
}
</style>