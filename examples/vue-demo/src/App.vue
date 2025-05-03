<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'
import type { Message } from '@laplace.live/event-types'
import MessageList from './components/MessageList.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import ConnectionControls from './components/ConnectionControls.vue'
import { createEventBridgeClient, getDefaultWebSocketUrl } from './utils/eventBridge'

// Define reactive state
const connected = ref(false)
const messages = ref<Message[]>([])
const connectionStatus = ref('Disconnected')
const connectionUrl = ref(getDefaultWebSocketUrl())
const client = ref<LaplaceEventBridgeClient | null>(null)

// Connect to event bridge
const connect = async () => {
  try {
    // Initialize client
    client.value = createEventBridgeClient(connectionUrl.value)

    // Set up connection status event listeners
    client.value.on('connected', () => {
      connectionStatus.value = 'Connected'
      connected.value = true
    })

    client.value.on('disconnected', () => {
      connectionStatus.value = 'Disconnected'
      connected.value = false
    })

    // Listen for message events
    client.value.on('message', (event) => {
      messages.value.push(event)
      // Keep only latest 50 messages
      if (messages.value.length > 50) {
        messages.value = messages.value.slice(-50)
      }
    })

    // Connect to the bridge
    await client.value.connect()
  } catch (error) {
    connectionStatus.value = `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}

// Disconnect from event bridge
const disconnect = () => {
  if (client.value) {
    client.value.disconnect()
    client.value = null
    messages.value = []
    connected.value = false
    connectionStatus.value = 'Disconnected'
  }
}

// Connect on component mount
onMounted(() => {
  connect()
})

// Disconnect on component unmount
onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="app">
    <header>
      <h1>LAPLACE Event Bridge Demo</h1>
      <div class="connection-info">
        <ConnectionStatus :connected="connected" :status="connectionStatus" />
        <ConnectionControls
          :connected="connected"
          v-model:url="connectionUrl"
          @connect="connect"
          @disconnect="disconnect"
        />
      </div>
    </header>

    <main>
      <section class="messages">
        <h2>Messages</h2>
        <MessageList :messages="messages" />
      </section>
    </main>

    <footer>
      <p>Using LAPLACE Event Bridge SDK</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  margin-bottom: 20px;
}

h1 {
  margin-bottom: 10px;
}

.connection-info {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 10px;
}

.messages {
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 20px;
}

h2 {
  margin-top: 0;
  margin-bottom: 15px;
}

footer {
  text-align: center;
  color: #666;
  font-size: 0.8em;
}
</style>
