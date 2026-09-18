---
name: playwright-test-site
description: Browser-drive the built site with Playwright to load each list page and spot-check detail pages for blank data, broken images, and console or Astro errors, comparing dev against preview. Use to verify rendered pages rather than unit tests, respecting the known gaps in rules/not_implemented.md.
---

# WRFrontiersDB Site Testing with Playwright

This skill provides a comprehensive testing workflow for the WRFrontiersDB-Site using Playwright.

## Browser MCP

Browser driving is done through the **Playwright MCP server**, declared in the repo
root at `.mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless"],
      "env": {}
    }
  }
}
```

- Claude Code prompts to approve this project MCP server the first time a session
  opens the repo (`/mcp` lists it; re-approve if it shows as disabled). Once
  approved, the `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`,
  `browser_resize`, `browser_evaluate`, `browser_console_messages`, etc. tools are
  available.
- Chromium is already cached at `~/.cache/ms-playwright` on this workstation, so the
  first `npx @playwright/mcp` run does not need to download a browser. If a session
  reports a missing browser, run `npx playwright install chromium`.

### Fallback: direct Playwright script

When the MCP tools are not loaded in the current session (e.g. the server was added
mid-session and can't hot-load), the same checks can be run with a throwaway Node
script. Install `playwright` into a scratch dir (`npm i playwright`), launch
`chromium.launch({ headless: true })`, and drive the dev-server URL. This is the
method used to confirm layout bugs like the shoulder-legend overlap: navigate,
`page.evaluate` to measure `getBoundingClientRect()` for collisions, then
`element.screenshot()` the region. Sweep several viewport widths (see
"Responsive / layout regressions" below) — desktop-width Chromium hides some
flex-wrap bugs that only appear on narrow viewports.

## Prerequisites

- Node.js and npm installed
- Playwright dependencies available (MCP via `.mcp.json`, or a scratch `npm i playwright`)
- Chromium cached at `~/.cache/ms-playwright` (already present on this box)
- Dev server running (`npm run dev`, default `http://localhost:4321/`) or a preview build
- Working directory resolved for npm commands

## Testing Workflow

### 1. Production Build Verification

```bash
# Build the production site
npm run build

# Preview the production build to verify it matches dev
npm run preview
```

### 2. Start Development Server

```bash
# Start dev server with 60 second timeout
timeout 60 npm run dev || true
```

### 3. Launch Playwright Testing

Use Playwright to open and navigate to both dev and preview sites to compare:

- Development server: http://localhost:4321/
- Production preview: http://localhost:4321/ (from npm run preview)

### 4. Test All List Pages

Navigate to and verify each list page, such as:

- `/modules` - Main modules list
- `/pilot_talents` - Pilot talents list

**Note**: Check `/robots.txt` page to discover all available list pages in the site.

For each list page:

- Verify page loads without errors
- Check that content is displayed (not blank)
- Ensure there are not images that fail to render
- Verify navigation elements work
- Ensure data is populated correctly
- Get 2 IDs of items for the next step

### 5. Spot Check Detail Pages

For each object type, test 2 different detail pages, such as:

- `/modules/{module-id-1}`
- `/modules/{module-id-2}`

For each detail page:

- Verify page loads completely
- Check all data fields are populated
- Verify no blank cells or missing content
- Test navigation back to list pages

### 6. Error Checking

Throughout testing, monitor for:

- **Console errors**: Check browser console for JavaScript errors
- **Astro errors**: Look for Astro build/runtime errors
- **Blank content**: Identify empty cells, missing data, or blank pages
- **Localization issues**: Ensure there's no text with default sounding translation
- **Stat embedment issues**: Ensure stats are properly displayed and formatted and not defaulting to placeholders
- **Navigation issues**: Test links and routing
- **Performance**: Note slow-loading pages or resources

### 6b. Responsive / layout regressions

Some layout bugs (overlapping or clipped elements) only appear at certain viewport
widths. Desktop-width Chromium often expands `flex-flow: column wrap` containers so
they look fine, while narrow viewports let the extra columns overflow their box and
overlap or run off-screen. To catch these:

- Sweep several widths with `browser_resize` (or a new context per width): e.g.
  `1280, 1024, 768, 600, 480, 390`.
- At each width, `browser_evaluate` a script that pulls `getBoundingClientRect()`
  for the suspect elements and flags (a) any pair whose boxes intersect, and
  (b) any child whose right edge extends past its parent container's right edge.
- Screenshot the specific element (not just full-page) at the failing width for a
  clear visual.

Known example: the shoulder-profile chart legend
(`src/components/shoulder_profiles/UnifiedShoulderChart.astro`,
`/module_groups/shoulder`) uses `.legend-group-items { display:flex;
flex-direction:column; flex-wrap:wrap; max-height:4.8rem; }`. Groups with many
shoulders spill into extra columns that overflow the card on narrow viewports.

### 7. Reporting

Document any issues found:

- Page URLs where errors occurred
- Specific error messages
- Steps to reproduce issues
- Screenshots of problematic areas (if applicable)

## Expected Results

- All pages load without errors
- All data fields are populated
- No console or Astro errors
- Navigation works correctly
- Pages are responsive and functional

## Troubleshooting

- If pages don't load: Check dev server is running and correct port
- If data is missing: Verify data files are present and correctly formatted
- If console errors: Check JavaScript syntax and dependencies
- If blank content: Verify data structure matches component expectations
