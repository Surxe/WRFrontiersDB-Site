/**
 * Measure drive mode (the movement simulator) on a map: collision build
 * time and memory, then collision and simulation time while driving a
 * scripted route. Headless Chromium has only software WebGL here, so frame
 * rates are not representative; collision and simulation times are CPU
 * work and are. Use a desktop browser for the 60 fps check.
 *
 *   npm run bench:drive -- [--url http://localhost:4321/] [--map CrashSite]
 *                          [--seconds 60] [--query tier=0&hz=60]
 *                          [--shot drive.png]
 *
 * Without --url it starts its own dev server.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  launchBrowser,
  startDevServer,
  type DevServer,
} from '../screenshots/harness';
import type {
  DriveReport,
  DriveHooks,
  StepBench,
} from '../../src/scripts/map_viewer/drive/drive_mode';
import type { InputState } from '../../src/scripts/movement/input/input_state';

declare global {
  interface Window {
    __wrfDrive?: DriveHooks;
  }
}

const ROOT = path.resolve(import.meta.dirname, '../..');
const BUILD_TIMEOUT_MS = 15 * 60_000;

/** The route: [seconds, forward, right, yaw degrees per second]. */
const ROUTE: [number, number, number, number][] = [
  [10, 1, 0, 0],
  [10, 1, 0, 36],
  [10, 1, 1, -20],
  [10, 1, 0, 90],
  [10, 0, 1, 10],
  [10, 1, 0, -45],
];

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    map: { type: 'string', default: 'CrashSite' },
    seconds: { type: 'string', default: '60' },
    query: { type: 'string', default: '' },
    shot: { type: 'string' },
  },
});

async function main(): Promise<void> {
  let server: DevServer | null = null;
  const base = values.url ?? (server = await startDevServer(ROOT)).url;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error')
        warnings.push(msg.text());
    });
    const extra = values.query ? `&${values.query}` : '';
    const url = new URL(
      `maps?map=${values.map}&foliage=0&drive=1${extra}`,
      base
    ).href;
    process.stdout.write(`Opening ${url}\n`);
    const opened = Date.now();
    await page.goto(url);
    await page.waitForFunction(
      () => window.__wrfDrive?.report().build != null,
      null,
      { timeout: BUILD_TIMEOUT_MS, polling: 1000 }
    );
    const loadedSeconds = (Date.now() - opened) / 1000;
    const built = (await page.evaluate(() =>
      window.__wrfDrive!.report()
    )) as DriveReport;
    process.stdout.write(
      `Collision built: ${JSON.stringify(built.build)} (page open to drivable: ${loadedSeconds.toFixed(1)} s)\n`
    );

    // Settle on the floor, then drive the route.
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__wrfDrive!.resetStats());
    const total = Number(values.seconds);
    let yaw = 0;
    let elapsed = 0;
    const tick = 0.25;
    for (const [seconds, forward, right, yawRate] of ROUTE) {
      for (let t = 0; t < seconds && elapsed < total; t += tick) {
        yaw += yawRate * tick;
        const input: InputState = {
          forward,
          right,
          viewYaw: yaw,
          viewPitch: -15,
          jump: false,
        };
        await page.evaluate((i) => window.__wrfDrive!.script(i), input);
        await page.waitForTimeout(tick * 1000);
        elapsed += tick;
      }
    }
    await page.evaluate(() => window.__wrfDrive!.script(null));
    // Then many updates back to back, without drawing: the collision cost
    // at the game's one update per frame, independent of software WebGL.
    const benches: [string, StepBench][] = [];
    for (const [label, seconds] of [
      ['60 fps (1/60 s updates)', 1 / 60],
      ['30 fps (1/30 s updates)', 1 / 30],
    ] as const) {
      const bench = (await page.evaluate(
        ([s]) => window.__wrfDrive!.benchSteps(3600, s, 0.25),
        [seconds] as const
      )) as StepBench;
      benches.push([label, bench]);
    }
    if (values.shot) {
      // The "Fly" prompt sits over the capsule until the mouse is captured.
      await page.evaluate(() =>
        document.querySelector('#map-fly')?.setAttribute('hidden', '')
      );
      await page.waitForTimeout(8000);
      await page.screenshot({ path: values.shot });
      process.stdout.write(`Screenshot: ${values.shot}\n`);
    }
    const report = (await page.evaluate(() =>
      window.__wrfDrive!.report()
    )) as DriveReport;
    const heap = await page.evaluate(() => {
      const memory = (performance as { memory?: { usedJSHeapSize: number } })
        .memory;
      return memory ? memory.usedJSHeapSize : null;
    });
    const s = report.summary;
    const f = (x: { mean: number; p95: number; max: number }, d = 3): string =>
      `${x.mean.toFixed(d)} / ${x.p95.toFixed(d)} / ${x.max.toFixed(d)}`;
    process.stdout.write(
      [
        '',
        `Map ${values.map}, ${report.frames} frames over ~${total} s`,
        `Build: ${built.build?.parts}: ${built.build?.colliders.toLocaleString('en')} colliders, ${built.build?.triangles.toLocaleString('en')} triangles, ${built.build?.seconds.toFixed(2)} s, typed arrays ${built.build ? Math.round(built.build.bytes / 1e6) : '?'} MB, JS heap ${heap ? Math.round(heap / 1e6) : '?'} MB`,
        '                         mean / p95 / max',
        `collision ms per step:  ${f(s.collisionMsPerStep)}`,
        `collision ms per frame: ${f(s.collisionMs)}`,
        `sim ms per frame:       ${f(s.simMs)}`,
        `queries per frame:      ${f(s.queries, 1)}`,
        `steps per frame:        ${f(s.steps, 1)}`,
        `frame ms (software GL): ${f(s.frameMs, 1)}`,
        `final mode ${report.mode}, speed ${Math.round(report.speed)} cm/s`,
        '',
        'Back-to-back updates (no drawing), per update in ms, mean / p95 / max:',
        ...benches.flatMap(([label, b]) => [
          `  ${label}, ${b.steps} updates, ${b.fallingSteps} falling, ${b.queriesPerStep.toFixed(1)} queries each:`,
          `    collision ${f(b.collisionMs)}`,
          `    whole update ${f(b.updateMs)} (exact mean ${b.updateMeanMs.toFixed(3)})`,
        ]),
        '',
        'Console warnings/errors:',
        ...warnings.map((w) => `  ${w.split('\n').join('\n  ')}`),
        '',
      ].join('\n')
    );
  } finally {
    await browser.close();
    server?.stop();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
