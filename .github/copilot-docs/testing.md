# Testing

## Testing Framework

This project uses **Vitest** for unit and integration testing.

### Setup

```bash
npm install --save-dev vitest @vitest/ui
```

Configuration: `vitest.config.ts` in project root

## Test Organization

Tests are located in the `tests/` directory, organized by type:

```
tests/
├── ts_utils/          # Tests for src/utils/*.ts
├── ts_types/          # Type validation tests
├── components/        # Tests for Astro components
├── pages/             # Tests for page logic
└── js/                # Tests for public/js/*.js
```

### Naming Convention

- Test files: `{fileName}/{functionOrInterfaceName}.ts`
- Place in `tests/` subdirectory (not next to source files)

## Running Tests

```bash
# Run specific test file
npx vitest tests/ts_utils/list/prepareObjectList.ts
```

## Tests for Typescript interfaces

Tests for typescript interfaces should read real data and compare to the interface with the following 3 tests:

- Every real object should have every required field (except parseObjectClass which is set at build time)
- For each optional field, at least 1 real object should have it
- Each key in the real object should be a field in the interface

Required and optional fields should NOT be determined dynamically.
These tests should extend to nested fields as well.
When reading in real objects, use dynamically the latest version dir within the archive dir

**IMPORTANT: While adding a test for an interface, if the interface does not accurately represent the Data, the interface should be updated, as opposed to modifying the test to work around the innaccurate interface.**

## Tests for astro components

Test logic and data structures, but do not actually render the Astro component.

## Best Practices

1. **Test behavior, not implementation**: Focus on inputs/outputs
2. **Keep tests isolated**: Don't depend on external data files when possible, except for interface tests
3. **Use descriptive test names**: `it('should filter non-Ready objects when prodReadyOnly is true')`
4. **Test edge cases**: Empty inputs, missing fields, invalid data
5. **Mock external dependencies**: File system, network requests
