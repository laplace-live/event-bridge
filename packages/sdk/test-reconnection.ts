#!/usr/bin/env bun

/**
 * Test script for WebSocket reconnection behavior
 *
 * This script tests the SDK's ability to handle failed connections and
 * reconnection attempts without getting stuck. It simulates connecting
 * to an unreachable server and verifies that:
 *
 * 1. The SDK attempts reconnection up to the configured maximum
 * 2. Ping monitoring doesn't interfere with reconnection
 * 3. The SDK properly stops after max attempts
 *
 * Usage: bun run test-reconnection.ts
 */
import { ConnectionState, LaplaceEventBridgeClient } from './index'

// Test configuration
const unreachableUrl = 'ws://localhost:9999' // Intentionally unreachable port
const maxAttempts = 5
const reconnectInterval = 2000

console.log('🧪 Testing WebSocket reconnection behavior...')
console.log(`Configuration:`)
console.log(`  - URL: ${unreachableUrl}`)
console.log(`  - Max attempts: ${maxAttempts}`)
console.log(`  - Reconnect interval: ${reconnectInterval}ms`)
console.log('')

// Create client with test configuration
const client = new LaplaceEventBridgeClient({
  url: unreachableUrl,
  reconnect: true,
  maxReconnectAttempts: maxAttempts,
  reconnectInterval: reconnectInterval,
  pingTimeout: 5000, // Short timeout for testing
})

// Track connection state changes
let stateHistory: { state: ConnectionState; timestamp: Date }[] = []
let reconnectCount = 0

client.onConnectionStateChange(state => {
  const timestamp = new Date()
  stateHistory.push({ state, timestamp })

  console.log(`[${timestamp.toISOString()}] Connection state: ${state}`)

  if (state === ConnectionState.RECONNECTING) {
    reconnectCount++
  }
})

// Attempt to connect
console.log('🚀 Attempting initial connection...')
client.connect().catch(err => {
  console.log('❌ Initial connection failed (expected)')
})

// Monitor for stuck behavior
let lastStateChange = Date.now()
const monitorInterval = setInterval(() => {
  const timeSinceLastChange = Date.now() - lastStateChange

  if (timeSinceLastChange > 30000) {
    // 30 seconds
    console.error('⚠️  WARNING: No state change for 30 seconds - possible stuck behavior!')
  }
}, 5000)

// Update last state change time
client.onConnectionStateChange(() => {
  lastStateChange = Date.now()
})

// Run test for a limited time
const testDuration = (maxAttempts + 2) * reconnectInterval
console.log(`\n⏱️  Test will run for ${testDuration / 1000} seconds...`)

setTimeout(() => {
  clearInterval(monitorInterval)

  console.log('\n📊 Test Results:')
  console.log(`  - Total reconnection attempts: ${reconnectCount}`)
  console.log(`  - Final state: ${client.getConnectionState()}`)
  console.log(`  - State history:`)

  stateHistory.forEach((entry, index) => {
    const duration = index > 0 ? entry.timestamp.getTime() - stateHistory[index - 1]!.timestamp.getTime() : 0
    console.log(`    ${index + 1}. ${entry.state} ${duration > 0 ? `(after ${duration}ms)` : ''}`)
  })

  // Check for success criteria
  console.log('\n✅ Test completed!')

  if (reconnectCount === maxAttempts && client.getConnectionState() === ConnectionState.DISCONNECTED) {
    console.log('✅ PASS: Client correctly stopped after max attempts')
  } else if (reconnectCount > maxAttempts) {
    console.log('❌ FAIL: Client exceeded max reconnection attempts')
  } else if (client.getConnectionState() !== ConnectionState.DISCONNECTED) {
    console.log('❌ FAIL: Client did not reach disconnected state')
  }

  // Cleanup
  client.disconnect()
  process.exit(0)
}, testDuration)
