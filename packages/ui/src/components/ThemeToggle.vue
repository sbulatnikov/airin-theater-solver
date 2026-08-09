<script setup lang="ts">
defineProps<{ theme: 'dark' | 'light' }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    class="ghost-button icon-button theme-toggle"
    type="button"
    :title="theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
    :aria-label="theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
    @click="$emit('toggle')"
  >
    <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4"></circle>
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      ></path>
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path>
    </svg>
  </button>
</template>
