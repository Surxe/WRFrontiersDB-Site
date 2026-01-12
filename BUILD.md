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
