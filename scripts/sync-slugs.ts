#!/usr/bin/env node

/**
 * Copy the slug map from WRFrontiersDB-Data into public/slug_map.json.
 * Usage: npm run sync:slugs
 *
 * The data repo owns the slug rules (tools/wrfdb_data/slug_map.py) and publishes
 * the map as index/slug_map.json, so every consumer links to the same pages. The
 * build reads the copy in public/; it is gitignored.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const source = path.join(
  projectRoot,
  'WRFrontiersDB-Data',
  'index',
  'slug_map.json'
);
const target = path.join(projectRoot, 'public', 'slug_map.json');

if (!fs.existsSync(source)) {
  console.error(
    `Slug map not found: ${source}\n` +
      'Check out WRFrontiersDB-Data (see README.md) at a version that has index/slug_map.json.'
  );
  process.exit(1);
}

const slugMap: unknown = JSON.parse(fs.readFileSync(source, 'utf-8'));
if (typeof slugMap !== 'object' || slugMap === null || Array.isArray(slugMap)) {
  console.error(`Slug map is not an object of id -> slug: ${source}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(slugMap, null, 2));
console.warn(`Copied ${Object.keys(slugMap).length} slugs to ${target}`);
