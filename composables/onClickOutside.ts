import { onMounted, onBeforeUnmount } from "vue";
import type { Ref } from "vue";

/**
 * Composable to detect clicks outside a target element
 */
export function onClickOutside(target: Ref<boolean>, handler: () => void) {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return;

  const listener = (event: MouseEvent) => {
    // Check if the click was outside the element
    if (event.target && target.value) {
      handler();
    }
  };

  onMounted(() => {
    window.addEventListener("click", listener);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("click", listener);
  });
}
