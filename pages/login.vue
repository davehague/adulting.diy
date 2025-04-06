<template>
    <div class="flex justify-center items-center h-screen bg-gray-100">
        <div class="bg-white p-8 rounded-lg shadow-md">
            <h1 class="text-2xl font-bold mb-4 text-center">Login with Google</h1>
            <p class="mb-6 text-center text-gray-600">Sign in to access your account</p>
            <GoogleSignInButton @success="handleLoginSuccess" @error="handleLoginError" class="w-full">
            </GoogleSignInButton>

            <!-- Loading indicator -->
            <div v-if="isLoading" class="mt-4 flex justify-center">
                <div class="w-6 h-6 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
                <span class="ml-2 text-sm text-gray-600">Logging in...</span>
            </div>

            <!-- Error message -->
            <div v-if="errorMessage" class="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {{ errorMessage }}
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

const isLoading = ref(false);
const errorMessage = ref('');

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
                    email_verified: payload.email_verified,
                    name: payload.name,
                    picture: payload.picture,
                    given_name: payload.given_name,
                    family_name: payload.family_name,
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

definePageMeta({
    layout: 'landing'
})
</script>