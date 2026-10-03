/**
 * Capture a scenario's screenshots for review:
 *
 *   npm run screenshots -- <scenario> [--url <base>] [--out <dir>]
 *   npm run screenshots -- --list
 *
 * Without --url, starts a dev server of its own (and stops it after). Shots go
 * to --out (default screenshots/<scenario>/, gitignored), which is emptied
 * first, but only if it is empty or holds a previous run (its index.md):
 * never anything else. Exits non-zero if the page logged console errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  launchBrowser,
  log,
  Session,
  startDevServer,
  type DevServer,
  type Scenario,
} from './harness';
import { modelsCompare } from './scenarios/models_compare';
import { modelsMobile } from './scenarios/models_mobile';

const SCENARIOS: readonly Scenario[] = [modelsCompare, modelsMobile];

const ROOT = path.resolve(import.meta.dirname, '../..');

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      out: { type: 'string' },
      list: { type: 'boolean' },
    },
  });
  if (values.list || positionals.length === 0) {
    for (const { name, description } of SCENARIOS) {
      log(`${name}\n  ${description}`);
    }
    return values.list ? 0 : 1;
  }
  const scenario = SCENARIOS.find(({ name }) => name === positionals[0]);
  if (!scenario) {
    console.error(`unknown scenario: ${positionals[0]} (see --list)`);
    return 1;
  }

  const outDir = path.resolve(
    values.out ?? path.join(ROOT, 'screenshots', scenario.name)
  );
  if (
    fs.existsSync(outDir) &&
    fs.readdirSync(outDir).length > 0 &&
    !fs.existsSync(path.join(outDir, 'index.md'))
  ) {
    console.error(
      `${outDir} has files but no index.md, so it is not a previous run; ` +
        'pick an empty or new --out dir'
    );
    return 1;
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let server: DevServer | null = null;
  const browser = await launchBrowser();
  try {
    let baseUrl = values.url;
    if (!baseUrl) {
      server = await startDevServer(ROOT);
      baseUrl = server.url;
    }
    log(`${scenario.name} against ${baseUrl} -> ${outDir}`);
    const session = new Session(browser, baseUrl, outDir);
    await scenario.run(session);
    log(`index: ${session.writeIndex(scenario)}`);
    if (session.errors.length > 0) {
      console.error(`console errors:\n${session.errors.join('\n')}`);
      return 1;
    }
    return 0;
  } finally {
    await browser.close();
    server?.stop();
  }
}

process.exitCode = await main();
