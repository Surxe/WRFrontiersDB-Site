# Build Scripts for Different Deployment Targets

This directory contains build scripts for different deployment environments.

## Usage

### Custom Domain Deployment (wrf-db.info)

```bash
npm run build:custom-domain
```

### GitHub Pages Deployment (surxe.github.io/WRFrontiersDB-Site/)

```bash
npm run build:github-pages
```

### Development

```bash
npm run dev
```

The build scripts set the `CUSTOM_DOMAIN` environment variable which configures the base path in astro.config.mjs.

## Slug Management

Slugs (the URL path segment of each object page) are decided in WRFrontiersDB-Data:
`tools/wrfdb_data/slug_map.py` builds `index/slug_map.json`, and the Orchestrator
rebuilds it after every parse. The Site only copies it:

```bash
npm run sync:slugs
```

This updates `public/slug_map.json` (gitignored). To add an object type or change a
slug rule, change the data repo's tool, rebuild the map there, then sync.
