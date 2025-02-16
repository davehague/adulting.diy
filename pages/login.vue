<template>
    <div class="flex justify-center items-center h-screen bg-gray-100">
        <div class="bg-white p-8 rounded-lg shadow-md">
            <h1 class="text-2xl font-bold mb-4 text-center">Login with Google</h1>
            <p class="mb-6 text-center text-gray-600">Sign in to access your account</p>
            <GoogleSignInButton @success="handleLoginSuccess" @error="handleLoginError" class="w-full">
            </GoogleSignInButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import { GoogleSignInButton, type CredentialResponse } from "vue3-google-signin";
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import type { User } from "~/types";

const authStore = useAuthStore();
const router = useRouter();

const handleLoginSuccess = async (response: CredentialResponse) => {
    const { credential } = response;
    const api = useApi();

    if (!credential) {
        console.error("No credential found");
        return;
    }

    const payload = JSON.parse(atob(credential.split('.')[1]));

    try {
        authStore.setAccessToken(credential);

        try {
            const userData = await api.get<User>('/api/user/profile', {
                params: { email: payload.email }
            });
            authStore.setUser(userData);
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
            } else {
                throw error;
            }
        }

        router.push('/home');
    } catch (error) {
        console.error("Authentication error:", error);
        authStore.logout(); // Clear credentials if anything goes wrong
    }
};

const handleLoginError = () => {
    console.error("Login failed");
    // You might want to show an error message to the user here
};

definePageMeta({
    layout: 'landing'
})
</script>