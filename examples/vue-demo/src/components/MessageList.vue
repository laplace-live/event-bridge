<script setup lang="ts">
import type { Message } from '@laplace.live/event-types'

// Define props
defineProps<{
  messages: Message[]
}>()
</script>

<template>
  <div class="message-container">
    <div v-if="messages.length === 0" class="no-messages">
      No messages received yet.
    </div>
    <div v-else class="message-list">
      <div v-for="(msg, index) in messages" :key="index" class="message">
        <div class="message-header">
          <span class="username">{{ msg.username }}</span>
          <span class="timestamp">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
        </div>
        <div class="message-content">{{ msg.message }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-container {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.no-messages {
  padding: 20px;
  text-align: center;
  color: #666;
}

.message-list {
  padding: 10px;
}

.message {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.username {
  font-weight: bold;
}

.timestamp {
  color: #666;
  font-size: 0.8em;
}

.message-content {
  word-break: break-word;
}
</style>
