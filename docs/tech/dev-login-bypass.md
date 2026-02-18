# Development Login Bypass for Nuxt Applications

## Overview

This guide provides a comprehensive approach to implementing a development-only login bypass system in Nuxt applications. This allows developers to quickly switch between users during development without going through the full authentication flow.

## ⚠️ Security Considerations

**CRITICAL**: This system must ONLY work in development mode and NEVER in production. The implementation should:

1. Check `process.env.NODE_ENV === 'development'` or similar
2. Be disabled by default
3. Use environment variables to enable/disable the feature
4. Provide clear logging when bypass mode is active
5. Never expose user selection endpoints in production builds

## Architecture Patterns

### 1. Middleware-Based Approach (Recommended)

Intercept authentication at the middleware level before it reaches your main auth verification.

**Pros:**
- Clean separation of concerns
- Easy to enable/disable
- Works with existing auth flow
- No changes to business logic

**Cons:**
- Requires careful ordering of middleware

### 2. Auth Service Extension

Extend your existing authentication service with development-specific methods.

**Pros:**
- Integrates directly with existing auth patterns
- Type-safe user selection
- Centralized auth logic

**Cons:**
- Requires modification of core auth service
- More complex to implement

### 3. Environment-Based Token Override

Replace token verification with a development-specific implementation.

**Pros:**
- Simple to implement
- Works with existing token-based systems

**Cons:**
- Requires modifications to token verification logic
- Less flexible for user switching

## Implementation Strategy

### Core Components

1. **Development User Store**: Database or memory store of available development users
2. **Bypass Middleware**: Intercepts authentication requests in development
3. **User Selection UI**: Interface for developers to choose active user
4. **Session Management**: Tracks currently selected development user

### Environment Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only
    devBypassEnabled: process.env.NODE_ENV === 'development' && process.env.DEV_LOGIN_BYPASS === 'true',
    
    public: {
      // Available on both server and client
      isDevMode: process.env.NODE_ENV === 'development',
      devBypassEnabled: process.env.NODE_ENV === 'development' && process.env.DEV_LOGIN_BYPASS === 'true'
    }
  }
})
```

### Server-Side Implementation

#### 1. Development Auth Utility

```typescript
// server/utils/dev-auth.ts
interface DevUser {
  id: string
  email: string
  name: string
  // ... other user properties
}

export class DevAuthService {
  private isEnabled: boolean
  private users: DevUser[]
  
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development' && 
                    process.env.DEV_LOGIN_BYPASS === 'true'
    this.users = [] // Load from database or fixture
  }
  
  async getUsers(): Promise<DevUser[]> {
    if (!this.isEnabled) return []
    return this.users
  }
  
  async getUserById(id: string): Promise<DevUser | null> {
    if (!this.isEnabled) return null
    return this.users.find(user => user.id === id) || null
  }
  
  isDevBypassEnabled(): boolean {
    return this.isEnabled
  }
}
```

#### 2. Modified Auth Verification

```typescript
// server/utils/auth.ts
export async function verifyAuth(event: H3Event): Promise<AuthenticatedUser> {
  const config = useRuntimeConfig()
  
  // Check for development bypass
  if (config.devBypassEnabled) {
    const devUserId = getCookie(event, 'dev-user-id') || getHeader(event, 'x-dev-user-id')
    
    if (devUserId) {
      console.log(`[DEV BYPASS] Using development user: ${devUserId}`)
      const devAuthService = new DevAuthService()
      const devUser = await devAuthService.getUserById(devUserId)
      
      if (devUser) {
        // Convert dev user to your AuthenticatedUser format
        return {
          email: devUser.email,
          userId: devUser.id,
          householdId: devUser.householdId || null
        }
      }
    }
  }
  
  // Fall back to normal authentication
  return await verifyAuthNormal(event)
}
```

#### 3. Development User API

```typescript
// server/api/dev/users.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  if (!config.devBypassEnabled) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    })
  }
  
  const devAuthService = new DevAuthService()
  return await devAuthService.getUsers()
})

// server/api/dev/login.post.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  if (!config.devBypassEnabled) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    })
  }
  
  const { userId } = await readBody(event)
  
  // Set development user session
  setCookie(event, 'dev-user-id', userId, {
    maxAge: 60 * 60 * 24 * 7, // 1 week
    httpOnly: false, // Allow client access for switching
    secure: false, // Development only
    sameSite: 'lax'
  })
  
  return { success: true, userId }
})
```

### Client-Side Implementation

#### 1. Development Store

```typescript
// stores/dev-auth.ts
export const useDevAuthStore = defineStore('dev-auth', () => {
  const config = useRuntimeConfig()
  const isEnabled = config.public.devBypassEnabled
  
  const availableUsers = ref([])
  const currentDevUser = ref(null)
  
  const fetchUsers = async () => {
    if (!isEnabled) return
    try {
      availableUsers.value = await $fetch('/api/dev/users')
    } catch (error) {
      console.error('Failed to fetch dev users:', error)
    }
  }
  
  const switchUser = async (userId: string) => {
    if (!isEnabled) return
    try {
      await $fetch('/api/dev/login', {
        method: 'POST',
        body: { userId }
      })
      
      // Refresh the auth store
      await refreshCookie('dev-user-id')
      window.location.reload() // Simple approach
    } catch (error) {
      console.error('Failed to switch user:', error)
    }
  }
  
  return {
    isEnabled,
    availableUsers,
    currentDevUser,
    fetchUsers,
    switchUser
  }
})
```

#### 2. Development UI Component

```vue
<!-- components/DevUserSwitcher.vue -->
<template>
  <div v-if="devStore.isEnabled" class="dev-user-switcher">
    <details class="relative">
      <summary class="dev-trigger">
        🧪 Dev User: {{ currentUser?.name || 'None' }}
      </summary>
      <div class="dev-panel">
        <h3>Switch Development User</h3>
        <div v-for="user in devStore.availableUsers" :key="user.id">
          <button 
            @click="devStore.switchUser(user.id)"
            :class="{ active: user.id === currentUserId }"
          >
            {{ user.name }} ({{ user.email }})
          </button>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
const devStore = useDevAuthStore()
const authStore = useAuthStore()

const currentUser = computed(() => authStore.user)
const currentUserId = computed(() => authStore.user?.id)

onMounted(() => {
  if (devStore.isEnabled) {
    devStore.fetchUsers()
  }
})
</script>

<style scoped>
.dev-user-switcher {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 9999;
  background: #ff6b6b;
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
}

.dev-panel {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  color: black;
  border: 1px solid #ccc;
  padding: 10px;
  min-width: 200px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.dev-trigger {
  cursor: pointer;
  list-style: none;
}

.dev-panel button {
  display: block;
  width: 100%;
  padding: 5px;
  margin: 2px 0;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

.dev-panel button.active {
  background: #e3f2fd;
}
</style>
```

### Global Integration

#### 1. Plugin Registration

```typescript
// plugins/dev-auth.client.ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  if (config.public.devBypassEnabled) {
    console.log('🧪 Development login bypass is ENABLED')
    
    // Auto-load dev users on startup
    const devStore = useDevAuthStore()
    devStore.fetchUsers()
  }
})
```

#### 2. Layout Integration

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <DevUserSwitcher />
    <!-- rest of layout -->
  </div>
</template>
```

## Best Practices

### Security
1. **Never ship to production**: Use build-time checks to exclude dev auth code
2. **Environment validation**: Always check NODE_ENV and explicit flags
3. **Clear indicators**: Make it obvious when bypass mode is active
4. **Audit logging**: Log all development authentication events

### User Experience
1. **Persistent selection**: Remember the selected user across page reloads
2. **Visual indicators**: Clear UI showing development mode is active
3. **Quick switching**: Minimal clicks to switch between users
4. **User information**: Show relevant user details (email, role, etc.)

### Testing
1. **Automated tests**: Verify bypass only works in development
2. **Production checks**: Ensure endpoints return 404 in production
3. **Integration tests**: Test with various user types and permissions

### Performance
1. **Lazy loading**: Only load dev users when needed
2. **Caching**: Cache user lists appropriately
3. **Minimal overhead**: Ensure zero impact when disabled

## Integration Checklist

- [ ] Environment configuration (NODE_ENV, DEV_LOGIN_BYPASS)
- [ ] Server-side bypass logic in auth verification
- [ ] Development user API endpoints
- [ ] Client-side user switching store
- [ ] UI component for user selection
- [ ] Plugin registration and initialization
- [ ] Layout integration
- [ ] Production safety checks
- [ ] Testing coverage
- [ ] Documentation for team members

## Common Pitfalls

1. **Forgetting production checks**: Always validate environment
2. **Cookie/session conflicts**: Ensure dev sessions don't interfere with real auth
3. **Permission issues**: Remember to set appropriate permissions for dev users
4. **Caching problems**: Clear auth caches when switching users
5. **Build inclusion**: Accidentally including dev code in production builds

## Advanced Features

### Multi-Household Support
- Switch between users in different households
- Quick household switching
- Cross-household permission testing

### Role Testing
- Switch between user roles (admin, member, etc.)
- Permission boundary testing
- Access control verification

### State Preservation
- Maintain application state when switching users
- Selective data refresh
- Optimistic UI updates

This guide provides a solid foundation for implementing development login bypass in any Nuxt application while maintaining security and developer experience.