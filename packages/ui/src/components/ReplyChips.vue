<script setup lang="ts">
defineProps<{ reply: string }>();

const colorByLetter: Readonly<Record<string, string>> = {
  С: 'blue',
  З: 'green',
  К: 'red',
};
</script>

<template>
  <span class="reply-chips" role="img" :aria-label="`Реплика ${reply}`">
    <span
      v-for="(letter, index) in reply"
      :key="`${letter}-${index}`"
      class="letter-chip"
      :class="colorByLetter[letter]"
    >
      {{ letter }}
    </span>
  </span>
</template>
