# Browser Data Access for Testing

## Overview

Complete object data is stored as JSON in the `data-json` attribute of a hidden `<div id="browser-data">` on all detail pages for easy browser access during testing.

## How to Access

### In Browser Console

```javascript
// Get the complete object data
const data = JSON.parse(document.getElementById('browser-data').dataset.json);

console.log(data.id); // "DA_Module_ChassisAlpha.1"
console.log(data.slug); // "titan-chassis-alpha"
console.log(data.parseObjectClass); // "Module"
```

### Available Data

The complete object data is stored, including:

- All object properties (id, name, description, etc.)
- Added `slug` property for URL mapping
- Type-specific references (module_rarity_ref, pilot_class_ref, etc.)
- Nested arrays and objects

## Pages with Browser Data

All detail pages include this data, such as `/modules/[slug]` and `/pilots/[slug]`
