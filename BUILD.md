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

### Rebuilding Slugs

After modifying slug generation logic or adding new object types, rebuild the slug map:

```bash
npm run build:slugs
```

This updates `public/slug-map.json`

**When to rebuild slugs:**

- Adding new object types to the site
- Modifying slug generation logic
