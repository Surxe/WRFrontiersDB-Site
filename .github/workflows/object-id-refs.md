# Object References: `ref` vs `id`

## Convention
- **`ref`**: External object reference (URLs, components) ✅
- **`id`**: Internal database identifier ❌

## Usage

### Routes
```typescript
const { ref } = Astro.params; // ✅
```

### Components
```typescript
interface Props {
  ref: string; // ✅
}
```

### Lookups
```typescript
const object = objects[ref]; // ✅
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
