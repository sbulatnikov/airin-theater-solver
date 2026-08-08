<script setup lang="ts">
import engine from "@airin-play/core/v1";
import SolverApp from "@airin-play/ui";
import type { AppConfig } from "@airin-play/ui/config";
import manifest from "../package.json";

const config = {
  variant: "classic",
  version: manifest.version,
  author: "Бэкендер",
  quickChoice: false,
  idealRoute: false
} satisfies AppConfig;
</script>

<template>
  <SolverApp :engine="engine" :config="config" />
</template>
