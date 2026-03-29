// @ts-check
import { defineConfig } from 'astro/config';
import vercelStatic from '@astrojs/vercel';
import process from 'node:process';

// Determine environment and configuration
const isDev = process.env.NODE_ENV === 'development';
const isCustomDomain = process.env.CUSTOM_DOMAIN === 'true';

// https://astro.build/config
export default defineConfig({
    output: isDev ? 'server' : 'static',
    adapter: isDev ? undefined : vercelStatic(),
    site: isCustomDomain ? 'https://wrf-db.info' : 'https://Surxe.github.io',
    base: '/'
});
