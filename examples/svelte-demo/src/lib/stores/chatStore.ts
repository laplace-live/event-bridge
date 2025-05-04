import { writable } from 'svelte/store';
import type { LaplaceEvent } from '@laplace.live/event-types';

// Create a writable store for messages
export const messages = writable<LaplaceEvent[]>([]);

// Add a message to the store
export function addMessage(message: LaplaceEvent) {
	messages.update((currentMessages) => [...currentMessages, message]);
}

// Clear all messages
export function clearMessages() {
	messages.set([]);
}
