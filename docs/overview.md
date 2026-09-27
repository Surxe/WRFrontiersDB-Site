# WRFrontiersDB-Site Copilot Instructions

Before answering any question, always say 'I have read the copilot instructions and will follow them.'

## Project Overview

Static Astro site displaying War Robots Frontiers game data from WRFrontiersDB-Data/current. The site builds static pages for game objects (modules, pilots, talents) for the latest game version with client-side localization.

## Quick Reference

- [Architecture](architecture.md) - Data layer, SSG, build vs runtime
- [Conventions](conventions.md) - Parse objects, localization, file organization
- [Object References](object_refs.md) - ObjRef component family and reference resolution
- [Character Preset Modules Logic](character_preset_modules_logic.md) - Module integration in character presets
- [Ability Relationships](ability_relationships.md) - Ability system connections and dependencies
- [Browser Data Access](browser-data-access.md) - Testing data accessibility and patterns
- [Weapon Mount Findings](weapon_mount_findings.md) - Source investigation behind the /models mount-correction constants
- Robot models / `/models` page: see Architecture > "Robot builds and 3D models"

## Critical Rules

**Always follow these rules**:

1. **Production filtering**: Only objects that support `production_status` attribute and have it set to `'Ready'` appear in production lists
2. **No TypeScript in public/js**: Client-side scripts must be plain JavaScript with JSDoc
3. **Tests go in tests/ directory**: Never place test files next to source files

## Tech Stack

- **Framework**: Astro 5.x (static output)
- **Language**: TypeScript (build-time and bundled `src/scripts`), JavaScript (`public/js` runtime)
- **Testing**: Vitest

## File Structure

```
src/
  pages/          # Astro pages (list and detail views)
  components/     # Reusable UI components
  utils/          # Build-time helpers (TypeScript + Node.js)
  scripts/        # Client TypeScript bundled by Astro <script> tags
    robot/        # Headless robot builds, models, hitbox areas (browser + Node)
    model_viewer/ # The /models page (three.js viewer + DOM UI)
  types/          # TypeScript interfaces
public/
  js/             # Client-side scripts (plain JavaScript)
tests/            # Test files organized by type
  ts_utils/       # Tests for src/utils/*.ts
  components/     # Tests for components
  pages/          # Tests for page logic
  js/             # Tests for public/js/*.js
  robot/          # Tests for src/scripts/robot (mirrors its tree)
  model_viewer/   # Tests for src/scripts/model_viewer
WRFrontiersDB-Data/  # External data repository (read-only)
  current/        # Current game data
```

## Quick Commands

```bash
npm run dev            # Start dev server
npm run lint           # Run linting
npm run format:check   # Run formatting check
npm run format:fix     # Run formatting fix
npm run vitest         # Run all non-heavy tests
npm run vitest:heavy   # Run all tests including heavy ones
```
