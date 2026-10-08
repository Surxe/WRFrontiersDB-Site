// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import process from 'node:process';
import { searchForWorkspaceRoot } from 'vite';

// Determine base path based on deployment environment
// For custom domain (wrf-db.info), use root path
// For GitHub Pages subdirectory, use /WRFrontiersDB-Site/
const isCustomDomain = process.env.CUSTOM_DOMAIN === 'true';

// https://astro.build/config
export default defineConfig({
    output: 'static',
    site: isCustomDomain ? 'https://wrf-db.info' : 'https://Surxe.github.io',
    base: '/',
    redirects: {
        '/shoulder_profiles': '/module_groups/shoulder'
    },
    vite: {
        server: {
            fs: {
                // The build-code codec is imported from the data repo
                // (WRFrontiersDB-Data/tools/js), which is a symlink to a sibling
                // checkout locally; let the dev server read it.
                allow: [
                    searchForWorkspaceRoot(process.cwd()),
                    fs.realpathSync('WRFrontiersDB-Data'),
                ],
            },
        },
    },
});
