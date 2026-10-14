/**
 * /maps: the start view behind the first team's spawn with a mode's pins,
 * switching modes and maps, mode-only geometry (Mont's drill), the foliage
 * toggle, a map without game modes, and the page around the viewer. Flying
 * needs pointer lock, which a headless browser has no mouse for.
 */
import type { Page } from 'playwright';
import type { Scenario } from '../harness';

const VIEWPORT = '#map-viewport';

/** The map is drawn: the status line clears. Software WebGL is slow with
 * millions of triangles, so the frame gets time after that. */
async function mapReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('#map-status')?.textContent === '',
    null,
    { timeout: 120_000 }
  );
  await page.waitForTimeout(4000);
}

export const maps: Scenario = {
  name: 'maps',
  description:
    '/maps: start views with pins (EM1, Mont, Tortuga), mode switch, ' +
    'mode geometry, foliage on/off, a map without modes, the whole page.',
  async run(session) {
    const em1 = await session.open('/maps?map=EM1&mode=BeaconRush', {
      ready: mapReady,
    });
    await em1.shot(
      'em1-beacon-rush',
      'EM1, Warp Rush: behind blue spawn, beacons with labels',
      VIEWPORT
    );
    await em1.click('[data-mode="Spearhead"]', 3000);
    await em1.shot(
      'em1-spearhead',
      'Mode switch: Spearhead probes and spawns',
      VIEWPORT
    );
    await em1.shot('page', 'The page: pickers and viewer');
    await em1.close();

    const mont = await session.open('/maps?map=Mont&mode=TeamDeathMatchPlus', {
      ready: mapReady,
    });
    await mont.shot(
      'mont-tdm-plus',
      'Mont, TDM+: power-up labels, the drill (mode geometry) and its ring',
      VIEWPORT
    );
    await mont.close();

    const tortuga = await session.open('/maps?map=Tortuga&mode=CTF', {
      ready: mapReady,
    });
    await tortuga.shot('tortuga-ctf', 'Tortuga, CTF: foliage on', VIEWPORT);
    await tortuga.click('#map-foliage', 3000);
    await tortuga.shot('tortuga-no-foliage', 'Foliage off', VIEWPORT);
    await tortuga.close();

    const tutorial = await session.open('/maps?map=Tutorial', {
      ready: mapReady,
    });
    await tutorial.shot(
      'tutorial',
      'Tutorial: no game modes, framed from above',
      VIEWPORT
    );
    await tutorial.close();
  },
};
