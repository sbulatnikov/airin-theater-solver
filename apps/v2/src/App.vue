<script setup lang="ts">
import engine from '@airin-play/core/v2';
import SolverApp from '@airin-play/ui';
import type { AppConfig } from '@airin-play/ui/config';
import manifest from '../package.json';

const config = {
  variant: 'strategy-tree',
  version: manifest.version,
  author: 'Бэкендер',
  quickChoice: true,
  idealRoute: true,
} satisfies AppConfig;
</script>

<template>
  <SolverApp :engine="engine" :config="config" />
</template>
