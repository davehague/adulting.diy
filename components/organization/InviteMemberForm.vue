<script setup lang="ts">
import { ref } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import type { CreateInviteDTO } from '@/types/organization'

const organizationStore = useOrganizationStore()

const emit = defineEmits<{
    (e: 'invited'): void
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const formData = ref<CreateInviteDTO>({
    email: '',
    role: 'member'
})

const handleSubmit = async () => {
    if (!formData.value.email.trim()) {
        error.value = 'Email is required'
        return
    }

    loading.value = true
    error.value = null

    try {
        await organizationStore.inviteMember(formData.value)

        // Reset form
        formData.value = {
            email: '',
            role: 'member'
        }

        emit('invited')
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to send invitation'
    } finally {
        loading.value = false
    }
}
</script>