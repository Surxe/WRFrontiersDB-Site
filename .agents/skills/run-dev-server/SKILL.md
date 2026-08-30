---
name: run-dev-server
description: Start and drive the WRFrontiersDB-Site Astro dev server to see or verify a change in the running app. Load when asked to run, start, serve, preview, or screenshot the site, or to confirm a change works in the browser.
---

# Run the dev server

Start the Astro dev server in the background and confirm the port before using it.

## Start

Run `npm run dev` as a background process (do not block on it). Astro serves on
`http://localhost:4321/` by default, but the port can shift if 4321 is taken, so
always confirm it.

## Confirm the port

Check the process output/logs for the line reporting the local URL (e.g.
`http://localhost:4321/`) and use whatever port it actually printed. Do not
assume 4321 without checking.

## Notes

- Give the server time to finish the initial build before hitting it; if it
  exits on its own, restart it.
- Use `npm run build` + `npm run preview` when you specifically need to verify
  the production build rather than dev.
- Stop the background server when finished.

> Tool note: whatever agent runs this, launch the server as a non-blocking
> background process and poll its output for the port - do not wait on it in the
> foreground.
