#!/usr/bin/env bun
import { program } from 'commander'
import chalk from 'chalk'
import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'

// Define version and description
program.name('event-bridge-cli').description('CLI for LAPLACE Event Bridge').version('0.1.0')

// Define options
program
  .option('-u, --url <url>', 'WebSocket URL', 'ws://localhost:9696')
  .option('-r, --reconnect', 'Enable auto-reconnect', true)
  .option('-i, --interval <ms>', 'Reconnect interval in milliseconds', '3000')
  .option('-a, --attempts <number>', 'Maximum reconnect attempts', '10')

program.parse()

const options = program.opts()

// Create timestamp
const getTimestamp = (): string => {
  const now = new Date()
  return chalk.gray(`[${now.toLocaleTimeString()}]`)
}

console.log(chalk.blue('LAPLACE Event Bridge CLI'))
console.log(chalk.blue('========================'))
console.log(chalk.yellow('Connecting to:'), options.url)

// Initialize the client
const client = new LaplaceEventBridgeClient({
  url: options.url,
  reconnect: options.reconnect,
  reconnectInterval: parseInt(options.interval),
  maxReconnectAttempts: parseInt(options.attempts),
})

// Setup event listeners
client.on('message', event => {
  console.log(`${getTimestamp()} ${chalk.green(event.username)}: ${event.message}`)
})

// Connection state changes
client.onConnectionStateChange(state => {
  console.log(`${getTimestamp()} ${chalk.yellow('Connection state changed to:')} ${state}`)
})

// Handle process exit
process.on('SIGINT', async () => {
  console.log(`${getTimestamp()} ${chalk.yellow('Shutting down...')}`)
  client.disconnect()
  process.exit(0)
})

// Connect to the event bridge
try {
  await client.connect()
  console.log(`${getTimestamp()} ${chalk.green('Listening for message events...')}`)

  // Log some helpful info
  console.log(`${getTimestamp()} ${chalk.yellow('Press Ctrl+C to exit')}`)
} catch (error) {
  console.error(`${getTimestamp()} ${chalk.red('Failed to connect:')}`, error)
  process.exit(1)
}
