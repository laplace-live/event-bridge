<script lang="ts">
  import EventList from '$lib/components/EventList.svelte';
</script>

<div class="container">
  <h1>SvelteKit + LAPLACE Event Bridge</h1>
  <p>A simple demo showing live events from LAPLACE.live</p>

  <div class="event-list">
    <EventList />
  </div>
</div>

<style>
  .container {
    max-width: 64rem;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }

  p {
    margin-bottom: 2rem;
    color: #555;
  }

  .event-list {
    max-width: 32rem;
    margin: 0 auto;
  }
</style>
