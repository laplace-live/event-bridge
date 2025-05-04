import { Component, createSignal } from 'solid-js';
import EventList from './components/EventList';

const App: Component = () => {
  return (
    <main>
      <div class="container">
        <h1>SolidJS + LAPLACE Event Bridge</h1>
        <p>A simple demo showing live events from LAPLACE.live</p>

        <EventList />
      </div>
    </main>
  );
};

export default App;
