import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  // Extend the main config but override for testing
  extends: './nuxt.config.ts',
  
  // Override specific settings for testing
  googleSignIn: {
    clientId: 'test-client-id' // Provide test client ID
  },
  
  // Disable SSR for testing
  ssr: false,
  
  // Test-specific app configuration
  appConfig: {
    googleSignIn: {
      clientId: 'test-client-id'
    }
  },
  
  // Disable certain modules that might interfere with testing
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    // Skip 'nuxt-vue3-google-signin' for tests
  ],
  
  // Test database URL
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000/api'
    },
    private: {
      googleClientId: 'test-client-id',
      googleClientSecret: 'test-client-secret',
      mailjetApiKey: 'test-mailjet-key',
      mailjetSecretKey: 'test-mailjet-secret',
      mailjetFromEmail: 'test@example.com',
      databaseUrl: 'postgresql://test:test@localhost:5432/test'
    }
  }
})