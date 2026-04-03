# Object References: `ref` vs `id`

## Convention

- **`ref`**: Internal database reference (identifying which class an object belongs to) ✅
- **`id`**: External identifier (URLs, components) ❌

## Usage

Use id wherever possible. The data is stored as a reference, so when its accessed, it should be converted to an id using utility functions. You should never check if a value is a ref or an id, you should instead look in the Data and see, for a given data structure, if its a ref or an id, then handle it appropriately.

### Routes

```typescript
const { id } = Astro.params; // ✅
```

### Components

```typescript
interface Props {
  id: string; // ✅
}
```

### Lookups

```typescript
const object = objects[id]; // ✅
```

## Files to Fix

Search for:

- `const { id }` in routes
- `id: string` in component props
- `objects[id]` access patterns

## Search

```bash
grep -r "const { id }" src/
grep -r "id: string" src/
```
