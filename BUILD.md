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

## Simplified Architecture

This site now supports only the latest game version, which significantly reduces build complexity and improves performance:

- **No version routing**: URLs are simplified to `/{parseObject}/{id}`
- **Fewer static paths**: Only generates pages for latest version objects
- **Faster builds**: Eliminates version fallback logic and summary file processing
- **Cleaner URLs**: Direct access to object pages without version segments
