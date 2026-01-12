# WRFrontiersDB-Site Copilot Instructions

Before answering any question, always say 'I have read the copilot instructions and will follow them.'

## Project Overview

Static Astro site displaying War Robots Frontiers game data from versioned JSON archives. The site builds static pages for game objects (modules, pilots, talents) across multiple game versions with client-side localization.

## Quick Reference

**Detailed Documentation**:

- [Architecture](copilot-docs/architecture.md) - Data layer, SSG, build vs runtime
- [Conventions](copilot-docs/conventions.md) - Parse objects, localization, file organization
- [Common Tasks](copilot-docs/common-tasks.md) - Step-by-step workflows
- [Testing](copilot-docs/testing.md) - Vitest setup, patterns, and guidelines

## Critical Rules

**Always follow these rules**:

1. **Environment-based base path**: Use `import.meta.env.BASE_URL` instead of hardcoded paths in Astro files, and `window.__ASTRO_BASE_PATH__` in client-side JavaScript
2. **Production filtering**: Only objects with `production_status === 'Ready'` appear in production lists
3. **No TypeScript in public/js**: Client-side scripts must be plain JavaScript with JSDoc
4. **Localization is version-specific**: Each game version has its own localization files
5. **Tests go in tests/ directory**: Never place test files next to source files

## Tech Stack

- **Framework**: Astro 5.x (static output)
- **Language**: TypeScript (build-time), JavaScript (runtime)
- **Testing**: Vitest

## File Structure

```
src/
  pages/          # Astro pages (list and detail views)
  components/     # Reusable UI components
  utils/          # Build-time helpers (TypeScript + Node.js)
  types/          # TypeScript interfaces
public/
  js/             # Client-side scripts (plain JavaScript)
tests/            # Test files organized by type
  ts_utils/       # Tests for src/utils/*.ts
  components/     # Tests for components
  pages/          # Tests for page logic
  js/             # Tests for public/js/*.js
WRFrontiersDB-Data/  # External data repository (read-only)
  archive/        # Versioned game data
  versions.json   # Version registry
```

## Quick Commands

```bash
npm run dev      # Start dev server
npx vitest       # Run tests in watch mode
npx vitest run   # Run tests once
```
