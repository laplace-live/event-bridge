<script setup lang="ts">
// Define props
defineProps<{
  connected: boolean
  url: string
}>()

// Define emits
defineEmits<{
  (e: 'connect'): void
  (e: 'disconnect'): void
  (e: 'update:url', value: string): void
}>()
</script>

<template>
  <div class="connection-controls">
    <input
      :value="url"
      @input="$emit('update:url', ($event.target as HTMLInputElement).value)"
      placeholder="WebSocket URL"
      :disabled="connected"
    />
    <button @click="$emit('connect')" :disabled="connected">Connect</button>
    <button @click="$emit('disconnect')" :disabled="!connected">Disconnect</button>
  </div>
</template>

<style scoped>
.connection-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 300px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #2196f3;
  color: white;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>
