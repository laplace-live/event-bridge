<script lang="ts">
  export let timestamp: string;

  // Format the timestamp to a readable time (HH:MM:SS)
  function formatTime(timestampStr: string): string {
    const timestamp = Number(timestampStr);
    if (isNaN(timestamp)) return timestampStr;

    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
</script>

<span class="timestamp">{formatTime(timestamp)}</span>

<style>
  .timestamp {
    font-size: 0.8em;
    color: #888;
    margin-right: 0.5em;
  }
</style>
