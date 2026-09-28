---
name: add-test
description: Add a Vitest unit or integration test for a util, type, component, or page. Use when asked to write or add a test. Covers the tests/ directory layout, naming convention, and what not to test (no Astro rendering, no parse-object interface tests).
---

# Testing

## Testing Framework

This project uses **Vitest** for unit and integration testing.

**Quick Reference**

- Run all non-heavy tests: `npm run vitest`
- Run all regular and heavy tests: `npm run vitest:heavy` (POSIX shell syntax; on Windows run it from git-bash or WSL)

### Setup

```bash
npm install --save-dev vitest @vitest/ui
```

Configuration: `vitest.config.ts` in project root

## Test Organization

Tests are located in the `tests/` directory, organized by type:

```
tests/
├── *.test.ts          # Cross-cutting data checks (slugs, socket mapping, all parse objects)
├── ts_utils/          # Tests for src/utils/*.ts
├── utils/             # Tests for src/utils (older .test.ts style)
├── ts_types/          # Type validation tests
├── components/        # Tests for Astro components
├── robot/             # Tests for src/scripts/robot (mirrors its tree)
└── model_viewer/      # Tests for src/scripts/model_viewer
```

### Naming Convention

Test files mirror the source they cover; the granularity depends on the area:

- `src/utils/{fileName}.ts`: one test file per function, `tests/ts_utils/{fileName}/{functionName}.ts`
- Components: one file per component, `tests/components/{Component}.ts` (subdirectory for grouped components, e.g. `tests/components/pilot/`)
- `src/scripts/**`: one file per source module, same relative path (`src/scripts/robot/build/params.ts` -> `tests/robot/build/params.ts`)
- The `.test.ts` suffix is optional; Vitest runs every `tests/**/*.ts`. Prefer plain `.ts` for new files
- Name slow, real-data tests `*.heavy.ts`; they run only under `npm run vitest:heavy`
- Place in `tests/` subdirectory (not next to source files)

## Running Tests

```bash
# Run specific test file
npx vitest tests/ts_utils/list/prepareObjectList.ts
```

## Tests for Typescript interfaces

We no longer create tests for typescript interfaces for parse objects.

## Tests for astro components

Test logic and data structures, but do not actually render the Astro component.

## Best Practices

1. **Test behavior, not implementation**: Focus on inputs/outputs
2. **Keep tests isolated**: Don't depend on external data files when possible, except for interface tests
3. **Use descriptive test names**: `it('should filter non-Ready objects when prodReadyOnly is true')`
4. **Test edge cases**: Empty inputs, missing fields, invalid data
5. **Mock external dependencies**: File system, network requests
