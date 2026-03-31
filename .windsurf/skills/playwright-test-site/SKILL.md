---
name: playwright-test-site
description: Test the WRFrontiersDB-Site with Playwright by checking list pages, detail pages, and errors
---

# WRFrontiersDB Site Testing with Playwright

This skill provides a comprehensive testing workflow for the WRFrontiersDB-Site using Playwright.

## Prerequisites

- Node.js and npm installed
- Playwright dependencies available
- Site builds successfully

## Testing Workflow

### 1. Start Development Server

```bash
# Start dev server with 60 second timeout
timeout 60 npm run dev || true
```

### 2. Launch Playwright Testing

Use Playwright to open and navigate the dev site automatically.

### 3. Test All List Pages

Navigate to and verify each list page, such as:

- `/modules` - Main modules list
- `/pilot_talents` - Pilot talents list

**Note**: Check `/robots.txt` page to discover all available list pages in the site.

For each list page:

- Verify page loads without errors
- Check that content is displayed (not blank)
- Verify navigation elements work
- Ensure data is populated correctly
- Get 2 IDs of items for the next step

### 4. Spot Check Detail Pages

For each object type, test 2 different detail pages, such as:

- `/modules/{module-id-1}`
- `/modules/{module-id-2}`

For each detail page:

- Verify page loads completely
- Check all data fields are populated
- Verify no blank cells or missing content
- Test navigation back to list pages

### 5. Error Checking

Throughout testing, monitor for:

- **Console errors**: Check browser console for JavaScript errors
- **Astro errors**: Look for Astro build/runtime errors
- **Blank content**: Identify empty cells, missing data, or blank pages
- **Localization issues**: Ensure there's no text with default sounding translation
- **Stat embedment issues**: Ensure stats are properly displayed and formatted and not defaulting to placeholders
- **Navigation issues**: Test links and routing
- **Performance**: Note slow-loading pages or resources

### 6. Reporting

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
