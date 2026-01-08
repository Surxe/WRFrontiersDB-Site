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
# Run all tests in watch mode
npx vitest

# Run once
npx vitest run

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest tests/ts_utils/list/prepareObjectList.ts
```

## Tests for Typescript interfaces
Tests for typescript interfaces should read real data and compare to the interface with the following 3 tests:
* Every object should have every required field (except parseObjectClass and production_status which are inherited from the ParseObject interface)
* For each optional field, at least 1 object should have it
* Each key in the object should be a field in the interface

Required and optional fields should be determined dynamically.

## Best Practices

1. **Test behavior, not implementation**: Focus on inputs/outputs
2. **Keep tests isolated**: Don't depend on external data files when possible
3. **Use descriptive test names**: `it('should filter non-Ready objects when prodReadyOnly is true')`
4. **Test edge cases**: Empty inputs, missing fields, invalid data
5. **Mock external dependencies**: File system, network requests
6. **Coverage targets**: Aim for >80% on utility functions

## VS Code Integration

Install the Vitest extension for VS Code:
- Extension ID: `vitest.explorer`
- Features: Inline test running, debugging, coverage visualization
