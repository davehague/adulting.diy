<template>
  <div>
    <p v-if="comments.length === 0" class="text-sm text-stone-500">No comments yet.</p>
    <ul v-else class="space-y-3">
      <li v-for="c in comments" :key="c.id" class="border border-stone-200 rounded-lg p-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span class="font-medium text-stone-900">{{ c.author.name }}</span>
          <span class="text-stone-500">{{ formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) }}</span>
        </div>

        <div v-if="editingId === c.id" class="mt-2 space-y-2">
          <textarea v-model="editBody" rows="3" aria-label="Edit comment"
                    class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm" />
          <div class="flex gap-2">
            <button type="button" class="px-3 py-1 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    :disabled="!editBody.trim() || submitting" @click="saveEdit(c.id)">
              Save
            </button>
            <button type="button" class="px-3 py-1 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
                    @click="editingId = null">
              Cancel
            </button>
          </div>
        </div>
        <template v-else>
          <p class="mt-2 text-sm text-stone-700 whitespace-pre-wrap break-words">{{ c.body }}</p>
          <div v-if="c.author.id === currentUserId" class="mt-2 flex gap-3 text-sm">
            <button type="button" class="text-amber-700 hover:text-amber-800" @click="startEdit(c.id, c.body)">Edit</button>
            <button type="button" class="text-red-600 hover:text-red-700" @click="emit('remove', c.id)">Delete</button>
          </div>
        </template>
      </li>
    </ul>

    <form class="mt-4 space-y-2" @submit.prevent="submitNew">
      <textarea v-model="newBody" rows="3" placeholder="Add a comment" aria-label="New comment"
                class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm" />
      <button type="submit" class="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              :disabled="!newBody.trim() || submitting">
        Add comment
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { type ProviderCommentDto } from '@/types/provider';

// onAdd/onUpdate resolve true on success so the text is only cleared/closed when the save worked.
const props = defineProps<{
  comments: ProviderCommentDto[];
  currentUserId: string | null;
  onAdd: (body: string) => Promise<boolean>;
  onUpdate: (id: string, body: string) => Promise<boolean>;
}>();

const emit = defineEmits<{
  (e: 'remove', id: string): void;
}>();

const newBody = ref('');
const editingId = ref<string | null>(null);
const editBody = ref('');

// True while an add/save request is in flight, so a double click cannot post the comment twice.
const submitting = ref(false);

const submitNew = async (): Promise<void> => {
  const body = newBody.value.trim();
  if (!body || submitting.value) return;
  submitting.value = true;
  try {
    if (await props.onAdd(body)) newBody.value = '';
  } finally {
    submitting.value = false;
  }
};

const startEdit = (id: string, body: string): void => {
  editingId.value = id;
  editBody.value = body;
};

const saveEdit = async (id: string): Promise<void> => {
  const body = editBody.value.trim();
  if (!body || submitting.value) return;
  submitting.value = true;
  try {
    if (await props.onUpdate(id, body)) editingId.value = null;
  } finally {
    submitting.value = false;
  }
};
</script>
