<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { LaplaceEvent } from '@laplace.live/event-types';
  import { messages } from '../stores/chatStore';
  import { eventBridgeClient } from '../services/eventBridge';
  import Timestamp from './Timestamp.svelte';

  let messageContainer: HTMLElement;
  let messageList: LaplaceEvent[] = [];

  // Subscribe to the messages store
  const unsubscribe = messages.subscribe(value => {
    messageList = value;
    // Scroll to bottom on new messages
    setTimeout(() => {
      if (messageContainer) {
        messageContainer.scrollTo({
          top: messageContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 0);
  });

  // Clean up on component destroy
  onDestroy(() => {
    unsubscribe();
    eventBridgeClient.disconnect();
  });

  // Component for routing messages based on their type
  function MessageRouter(event: LaplaceEvent) {
    if (event.type === 'system') {
      return `<div>${event.message}</div>`;
    }

    if (event.type === 'interaction') {
      const actionMap: { [key: number]: string } = {
        1: '进入直播间',
        2: '关注',
        3: '分享',
        4: '特别关注',
        5: '互相关注',
      };

      return `<div class="opacity-40">${event.username} ${actionMap[event.action]}</div>`;
    }

    if (event.type === 'message') {
      return `
        <div>
          <slot name="timestamp" timestamp={event.timestampNormalized}></slot>
          ${event.username}: ${event.message}
        </div>
      `;
    }

    if (event.type === 'superchat' || event.type === 'gift') {
      return `
        <div>
          <slot name="timestamp" timestamp={event.timestampNormalized}></slot>
          ${event.username}: [¥${event.priceNormalized}] ${event.message}
        </div>
      `;
    }

    if (event.type === 'entry-effect') {
      return `<div class="entry-effect">${event.message}</div>`;
    }

    return '';
  }
</script>

<div class="event-container" bind:this={messageContainer}>
  {#if messageList.length === 0}
    <div class="no-messages">No messages yet</div>
  {:else}
    {#each messageList as event (event.id)}
      {#if event.type === 'system'}
        <div>{event.message}</div>
      {:else if event.type === 'interaction'}
        <div class="interaction-message">
          {event.username} {event.action === 1 ? '进入直播间' :
          event.action === 2 ? '关注' :
          event.action === 3 ? '分享' :
          event.action === 4 ? '特别关注' :
          event.action === 5 ? '互相关注' : ''}
        </div>
      {:else if event.type === 'message'}
        <div class="message">
          <Timestamp timestamp={event.timestampNormalized.toString()} />
          <span class="username">{event.username}:</span> {event.message}
        </div>
      {:else if event.type === 'superchat' || event.type === 'gift'}
        <div class="paid-message">
          <Timestamp timestamp={event.timestampNormalized.toString()} />
          <span class="username">{event.username}:</span>
          <span class="price">[¥{event.priceNormalized.toString()}]</span>
          {event.message}
        </div>
      {:else if event.type === 'entry-effect'}
        <div class="entry-effect">{event.message}</div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .event-container {
    height: 32rem;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .no-messages {
    text-align: center;
    color: #888;
    padding: 2rem 0;
  }

  .message, .paid-message {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem;
  }

  .interaction-message {
    opacity: 0.4;
  }

  .username {
    font-weight: 500;
  }

  .price {
    color: #e74c3c;
    font-weight: 500;
  }

  .entry-effect {
    color: #3498db;
  }
</style>
