/**
 * Screenshot harness: drives the site in headless Chromium through a
 * scenario's named states, saving one PNG per state plus an index.md that
 * captions each and lists any console errors, for a human to review.
 *
 * WebGL works headless here only through SwiftShader, and only with no X
 * display in the browser's environment: given DISPLAY, ANGLE tries to reach
 * the X server first and WebGL fails to start. launchBrowser handles both.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  chromium,
  type Browser,
  type Locator,
  type Page,
  type ViewportSize,
} from 'playwright';

/** Viewport presets: a wide desktop and a phone. */
export const PRESETS = {
  desktop: { width: 1600, height: 1000 },
  mobile: { width: 400, height: 860 },
} as const satisfies Record<string, ViewportSize>;

export type Preset = keyof typeof PRESETS;

/** A sequence of states to capture. */
export interface Scenario {
  name: string;
  description: string;
  run(session: Session): Promise<void>;
}

interface ShotRecord {
  file: string;
  caption: string;
  url: string;
  preset: Preset;
}

/** Progress output (stdout; console.log is linted out of the site code). */
export function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Waits after an interaction for the page to settle (animations, rebuilds). */
const SETTLE_MS = 900;

/** Chromium with software WebGL; see the header. */
export function launchBrowser(): Promise<Browser> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== 'DISPLAY' && key !== 'WAYLAND_DISPLAY'
    )
  );
  return chromium.launch({
    // The full Chromium build, not the headless shell: its new headless
    // mode runs the same GPU path as a real window.
    channel: 'chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    env,
  });
}

/** One open page of a scenario. */
export class View {
  constructor(
    readonly page: Page,
    private readonly session: Session,
    readonly preset: Preset
  ) {}

  /** Click `selector`, then let the page settle. */
  async click(selector: string, settleMs = SETTLE_MS): Promise<void> {
    await this.page.click(selector);
    await this.page.waitForTimeout(settleMs);
  }

  /** Drag across the middle of `selector` by (dx, dy) pixels. */
  async drag(selector: string, dx: number, dy: number): Promise<void> {
    const box = await this.page.locator(selector).boundingBox();
    if (!box) throw new Error(`drag: ${selector} is not visible`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 10 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(SETTLE_MS);
  }

  /** Save the current state as the next numbered shot: the element matching
   * `target` if given, else the visible page. */
  shot(name: string, caption: string, target?: string): Promise<void> {
    return this.session.record(
      this,
      name,
      caption,
      target ? this.page.locator(target) : null
    );
  }

  close(): Promise<void> {
    return this.page.close();
  }
}

export interface OpenOptions {
  preset?: Preset;
  /** Resolves once the page is ready to capture (default: network idle). */
  ready?: (page: Page) => Promise<void>;
}

/** A scenario run: the browser, the base URL, and the shots taken so far. */
export class Session {
  private readonly shots: ShotRecord[] = [];
  readonly errors: string[] = [];

  constructor(
    private readonly browser: Browser,
    private readonly baseUrl: string,
    private readonly outDir: string
  ) {}

  /** Open `urlPath` (relative to the site root) in a fresh page. */
  async open(urlPath: string, options: OpenOptions = {}): Promise<View> {
    const preset = options.preset ?? 'desktop';
    const page = await this.browser.newPage({ viewport: PRESETS[preset] });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        this.errors.push(`${page.url()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) =>
      this.errors.push(`${page.url()}: ${String(error)}`)
    );
    await page.goto(new URL(urlPath, this.baseUrl).href, {
      waitUntil: 'networkidle',
    });
    await options.ready?.(page);
    return new View(page, this, preset);
  }

  async record(
    view: View,
    name: string,
    caption: string,
    target: Locator | null
  ): Promise<void> {
    const file = `${String(this.shots.length + 1).padStart(2, '0')}-${name}.png`;
    const filePath = path.join(this.outDir, file);
    if (target) await target.screenshot({ path: filePath });
    else await view.page.screenshot({ path: filePath });
    const url = new URL(view.page.url());
    this.shots.push({
      file,
      caption,
      url: url.pathname + url.search,
      preset: view.preset,
    });
    log(`  ${file}  ${caption}`);
  }

  /** index.md: every shot with its caption and URL, then any errors. */
  writeIndex(scenario: Scenario): string {
    const cell = (text: string): string => text.replaceAll('|', '\\|');
    const lines = [
      `# ${scenario.name}`,
      '',
      scenario.description,
      '',
      '| Shot | Preset | Caption | URL |',
      '| ---- | ------ | ------- | --- |',
      ...this.shots.map(
        ({ file, caption, url, preset }) =>
          `| ${file} | ${preset} | ${cell(caption)} | \`${url}\` |`
      ),
      '',
      '## Console errors',
      '',
      ...(this.errors.length === 0
        ? ['None.']
        : this.errors.map((error) => `- ${cell(error)}`)),
      '',
    ];
    const indexPath = path.join(this.outDir, 'index.md');
    fs.writeFileSync(indexPath, lines.join('\n'));
    return indexPath;
  }
}

/** A free local TCP port. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port'))
      );
    });
  });
}

/** A running Astro dev server. */
export interface DevServer {
  url: string;
  stop(): void;
}

/** Start `astro dev` on a free port and resolve with its URL once it
 * reports it. */
export async function startDevServer(cwd: string): Promise<DevServer> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    'npx',
    ['astro', 'dev', '--port', String(port)],
    { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  // Its own process group, so stopping it takes npx's children too.
  const stop = (): void => {
    if (child.pid && child.exitCode === null) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already gone
      }
    }
  };
  process.once('exit', stop);
  return new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`dev server did not start:\n${log}`));
    }, 120_000);
    const onData = (chunk: Buffer): void => {
      log += chunk.toString();
      const match = /http:\/\/localhost:(\d+)\//.exec(log);
      if (match) {
        clearTimeout(timer);
        resolve({ url: match[0], stop });
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`dev server exited (${code}):\n${log}`));
    });
  });
}
