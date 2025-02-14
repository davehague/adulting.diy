<template>
    <div class="flex flex-col min-h-screen">
        <main class="flex-grow">
            <slot />
        </main>

        <footer class="bg-gray-800 text-white py-4">
            <div class="container mx-auto px-6">
                <div class="text-center">
                    &copy; {{ new Date().getFullYear() }} Adulting.DIY
                </div>
            </div>
        </footer>
    </div>
</template>