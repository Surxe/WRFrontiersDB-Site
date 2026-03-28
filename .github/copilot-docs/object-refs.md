# Object References: `ref` vs `id`

## Convention

- **`ref`**: Internal database reference (identifying which class an object belongs to) ✅
- **`id`**: External identifier (URLs, components) ❌

## Usage

Use id wherever possible. The data is stored as a reference, so when its accessed, it should be converted to an id using utility functions.

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
