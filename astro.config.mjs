// @ts-check
import { defineConfig } from 'astro/config';
import process from 'node:process';

// Determine base path based on deployment environment
// For custom domain (wrf-db.info), use root path
// For GitHub Pages subdirectory, use /WRFrontiersDB-Site/
const isCustomDomain = process.env.CUSTOM_DOMAIN === 'true';

// https://astro.build/config
export default defineConfig({
    output: 'static',
    site: isCustomDomain ? 'https://wrf-db.info' : 'https://Surxe.github.io',
    base: '/'
});
