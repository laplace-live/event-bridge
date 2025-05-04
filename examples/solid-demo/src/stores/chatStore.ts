import { createStore } from 'solid-js/store';
import { LaplaceEvent } from '@laplace.live/event-types';

// Define the chat store state
export type ChatState = {
  messages: LaplaceEvent[];
};

// Create the store with initial state
const [chatState, setChatState] = createStore<ChatState>({
  messages: [],
});

// Create actions for the store
export const chatActions = {
  addMessage: (message: LaplaceEvent) => {
    setChatState('messages', (prev) => [...prev, message]);
  },
  clearMessages: () => {
    setChatState('messages', []);
  },
};

export { chatState };
