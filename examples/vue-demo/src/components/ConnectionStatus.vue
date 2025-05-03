<script setup lang="ts">
// Define props
defineProps<{
  connected: boolean
  status: string
}>()
</script>

<template>
  <div class="status" :class="{ connected }">
    {{ status }}
  </div>
</template>

<style scoped>
.status {
  background-color: #f44336;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.status.connected {
  background-color: #4caf50;
}
</style>
