---
"@laplace.live/event-bridge-sdk": minor
---

Add `/info` room discovery: a standalone `fetchInfo({ url, token })` and a `client.getInfo()` method that fetch the LAPLACE Event Fetcher `/info` endpoint and return the configured rooms plus instance metadata (`FetcherInfo` / `FetcherRoom`). Returns `null` when discovery is unsupported (a plain Event Bridge server or an older fetcher), so callers can fall back to manual entry. No active connection required.
