---
name: screenshot-review
description: Capture a set of named screenshots of a UI change (e.g. /models viewer states) for the user to review, with the checked-in Playwright harness (`npm run screenshots`). Load when asked to screenshot, visually verify, or hand over shots of a page or feature, or when adding a screenshot scenario. Covers headless WebGL.
---

# Screenshot review

Shows a UI change to a human: a scenario drives the site through named states
and saves one PNG per state, plus an `index.md` captioning each with its URL and
listing any console errors. It complements the other browser skills:

- `playwright-test-site` - broad smoke test of every list/detail page.
- Playwright MCP (`.mcp.json`) - exploratory, one-off poking around.
- **this skill** - a repeatable set of states for a specific feature, re-run
  after every change and handed to the user.

## Run

```bash
npm run screenshots -- --list                  # scenarios
npm run screenshots -- models-compare          # starts its own dev server
npm run screenshots -- models-compare --url http://localhost:4321/  # reuse one
npm run screenshots -- models-compare --out /srv/dev/scratch/<topic>-shots
```

- With no `--url`, the runner starts `astro dev` on a free port and stops it
  afterwards. Pass `--url` to reuse a dev server that is already running.
- Output goes to `screenshots/<scenario>/` by default (gitignored). Use
  `--out` to keep a set past the next run, e.g. in the box's scratch dir.
- Each run empties its output dir first. To protect other files, it refuses a
  dir that has files but no `index.md` (so isn't a previous run). Give `--out`
  a new dir rather than one holding other files.
- The exit code is non-zero if any page logged a console error or threw. The
  errors are listed in `index.md` too.

## Review and hand over

1. Read `index.md` for the shot list, and check its console-error section.
2. Open the shots with the Read tool, which shows them to the user in chat.
   Open the ones that prove the change; there is no need to open every one.
3. In the report, give the output dir and a table of the states and what to
   check in each. Mention what a still image can't show (an animation, say).

## Add a scenario

A scenario is a `Scenario` (`scripts/screenshots/harness.ts`): a name, a
one-line description, and `run(session)`. Put it in
`scripts/screenshots/scenarios/<snake_name>.ts` and add it to `SCENARIOS` in
`scripts/screenshots/run.ts`. `scenarios/models_compare.ts` is the model;
/models scenarios share their builds and readiness check through
`scenarios/models_common.ts`:

```ts
const view = await session.open('/models?...', { ready: modelsReady });
await view.click('[data-layout="side"]'); // waits for the page to settle
await view.drag('#model-canvas', -250, 60); // orbit / pan
await view.shot('side-3d', 'Side by side: tags shown', '#model-viewport');
await view.shot('full-page', 'Whole page'); // no target: the visible page
await view.close();
const phone = await session.open('/models?...', { preset: 'mobile' });
```

- **Name each state** after what it shows. Captions say what the reviewer
  should check.
- **Presets:** `desktop` (1600x1000) and `mobile` (400x860, touch, so
  `pointer: coarse` rules apply). Add one to `PRESETS` rather than inlining
  viewport sizes.
- **Whole page:** `view.fullPage(name, caption)` saves the full scrollable page,
  for checking section order on a phone.
- **Readiness:** pass `ready` when network idle isn't enough. The /models
  viewer is ready once `#model-status` empties, then a short pause for the
  first frame.
- **Fullscreen:** click the page's own fullscreen button, then shoot with no
  target so the shot is the whole screen.
- **Deep links:** start from a URL with the state already in it to check that
  the URL state loads, as well as reaching the same state by clicking.
- Pick test data that makes the change visible, e.g. a compare B that swaps
  parts, so the diff colors show.

## Headless WebGL

`launchBrowser()` already handles this; the notes are for when it breaks.

- WebGL runs on SwiftShader (`--use-angle=swiftshader
--enable-unsafe-swiftshader`) in the full Chromium build (`channel:
'chromium'`).
- `DISPLAY` / `WAYLAND_DISPLAY` are removed from the browser's environment.
  With them set, ANGLE tries the X server first. When the agent user can't
  connect to it (as on the workstation), the GPU process fails and three.js
  reports "Error creating WebGL context". The page then shows "3D view
  unavailable: WebGL could not start."
- To check WebGL quickly, `chrome://gpu` should show "WebGL: Hardware
  accelerated" and a SwiftShader renderer.

## Why Playwright (not Puppeteer)

Both drive headless Chromium with similar page APIs. Playwright wins here
because:

- the repo already uses it: the Playwright MCP server, `playwright-test-site`,
  and the browsers cached in `~/.cache/ms-playwright`;
- the `playwright` library has no install-time browser download, so CI's
  `npm ci` stays lean;
- it has auto-waiting locators, element screenshots, viewport presets, and a
  launch-time `env` (used to drop `DISPLAY`) built in.

Puppeteer would add a second browser cache (Chrome for Testing in
`~/.cache/puppeteer`) for no gain.

`playwright` is pinned to an exact version (package.json), because each
version expects one Chromium build. If you bump it and the run reports a
missing browser, run `npx playwright install chromium` once on the box.
