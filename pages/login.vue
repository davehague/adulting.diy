<template>
    <div class="flex justify-center items-center min-h-screen bg-gray-100 py-8">
        <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <h1 class="text-2xl font-bold mb-2 text-center">Sign In</h1>
            <p class="mb-6 text-center text-gray-600">Sign in to access your account</p>

            <!-- Auth Method Toggle -->
            <div class="flex mb-6 border-b">
                <button
                    @click="authMethod = 'google'"
                    :class="['flex-1 py-2 text-center font-medium', authMethod === 'google' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']"
                >
                    Google
                </button>
                <button
                    @click="authMethod = 'email'"
                    :class="['flex-1 py-2 text-center font-medium', authMethod === 'email' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']"
                >
                    Email
                </button>
            </div>

            <!-- Google Sign In -->
            <div v-if="authMethod === 'google'">
                <GoogleSignInButton @success="handleLoginSuccess" @error="handleLoginError" class="w-full">
                </GoogleSignInButton>
            </div>

            <!-- Email/Password Sign In -->
            <div v-else>
                <!-- Toggle between login and register -->
                <div class="flex mb-4 space-x-2">
                    <button
                        @click="emailMode = 'login'"
                        :class="['flex-1 py-2 px-4 rounded', emailMode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700']"
                    >
                        Login
                    </button>
                    <button
                        @click="emailMode = 'register'"
                        :class="['flex-1 py-2 px-4 rounded', emailMode === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700']"
                    >
                        Register
                    </button>
                </div>

                <form @submit.prevent="handleEmailAuth" class="space-y-4">
                    <div v-if="emailMode === 'register'">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            v-model="emailForm.name"
                            type="text"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your name"
                        >
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            v-model="emailForm.email"
                            type="email"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your email"
                        >
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            v-model="emailForm.password"
                            type="password"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            :placeholder="emailMode === 'register' ? 'Minimum 8 characters, include uppercase, lowercase, and number' : 'Enter your password'"
                        >
                    </div>

                    <button
                        type="submit"
                        :disabled="isLoading"
                        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {{ emailMode === 'login' ? 'Sign In' : 'Create Account' }}
                    </button>
                </form>
            </div>

            <!-- Loading indicator -->
            <div v-if="isLoading" class="mt-4 flex justify-center items-center">
                <div class="w-6 h-6 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
                <span class="ml-2 text-sm text-gray-600">{{ loadingMessage }}</span>
            </div>

            <!-- Error message -->
            <div v-if="errorMessage" class="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {{ errorMessage }}
            </div>

            <!-- Success message -->
            <div v-if="successMessage" class="mt-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
                {{ successMessage }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { GoogleSignInButton, type CredentialResponse } from "vue3-google-signin";
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { useApi } from '@/utils/api';
import type { User } from "~/types";

const authStore = useAuthStore();
const router = useRouter();
const api = useApi();

const authMethod = ref<'google' | 'email'>('google');
const emailMode = ref<'login' | 'register'>('login');
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const loadingMessage = ref('Logging in...');

const emailForm = ref({
    name: '',
    email: '',
    password: ''
});

const handleLoginSuccess = async (response: CredentialResponse) => {
    try {
        isLoading.value = true;
        errorMessage.value = '';
        const { credential } = response;

        if (!credential) {
            errorMessage.value = "No credential found";
            return;
        }

        const payload = JSON.parse(atob(credential.split('.')[1]));

        // Store the token
        authStore.setAccessToken(credential);

        // Try to get existing user
        try {
            const userData = await api.get<User>('/api/user/profile', {
                params: { email: payload.email }
            });
            authStore.setUser(userData);

            // Check if user has a household and redirect accordingly
            if (userData.householdId) {
                router.push('/home');
            } else {
                router.push('/setup-household');
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                // Create new user
                const userData = await api.post<User>('/api/user/register', {
                    email: payload.email,
                    emailVerified: payload.email_verified, // Map from snake_case payload
                    name: payload.name,
                    picture: payload.picture,
                    givenName: payload.given_name, // Map from snake_case payload
                    familyName: payload.family_name, // Map from snake_case payload
                    locale: payload.locale
                });
                authStore.setUser(userData);

                // New users always need to setup household
                router.push('/setup-household');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Authentication error:", error);
        errorMessage.value = "Failed to authenticate. Please try again.";
        authStore.logout(); // Clear credentials if anything goes wrong
    } finally {
        isLoading.value = false;
    }
};

const handleLoginError = (error: any) => {
    console.error("Login failed:", error);
    errorMessage.value = "Login failed. Please try again.";
    isLoading.value = false;
};

const handleEmailAuth = async () => {
    try {
        isLoading.value = true;
        errorMessage.value = '';
        successMessage.value = '';

        if (emailMode.value === 'register') {
            // Register new user
            loadingMessage.value = 'Creating account...';
            const response = await api.post('/api/auth/register-email', {
                email: emailForm.value.email,
                password: emailForm.value.password,
                name: emailForm.value.name
            });

            if (response.success) {
                successMessage.value = 'Account created successfully! Logging you in...';
                // Switch to login mode and attempt to login
                emailMode.value = 'login';
                // Wait a moment to show the success message
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Login (either after registration or direct login)
        if (emailMode.value === 'login' || successMessage.value) {
            loadingMessage.value = 'Logging in...';
            const loginResponse = await api.post('/api/auth/login-email', {
                email: emailForm.value.email,
                password: emailForm.value.password
            });

            if (loginResponse.success && loginResponse.token && loginResponse.user) {
                // Store the token
                authStore.setAccessToken(loginResponse.token);
                authStore.setUser(loginResponse.user);

                // Check if user has a household and redirect accordingly
                if (loginResponse.user.householdId) {
                    router.push('/home');
                } else {
                    router.push('/setup-household');
                }
            }
        }
    } catch (error: any) {
        console.error("Email authentication error:", error);

        if (error.response?.data?.message) {
            errorMessage.value = error.response.data.message;
        } else if (error.message) {
            errorMessage.value = error.message;
        } else {
            errorMessage.value = emailMode.value === 'register'
                ? "Failed to create account. Please try again."
                : "Failed to login. Please check your credentials.";
        }
        successMessage.value = '';
    } finally {
        isLoading.value = false;
    }
};

definePageMeta({
    layout: 'landing'
})
</script>