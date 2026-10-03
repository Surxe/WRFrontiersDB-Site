/**
 * /models compare mode: the Overlap / Side by side layouts across the 3D and
 * 2D views, layer toggles, deep links, fullscreen and a phone screen.
 */
import type { Scenario } from '../harness';
import { A, COMPARE, modelsReady, VIEWPORT } from './models_common';

export const modelsCompare: Scenario = {
  name: 'models-compare',
  description:
    '/models compare: Overlap vs Side by side, the 2D views, layer toggles, ' +
    'deep link, fullscreen and mobile. Build A is Anansi, B is Ares.',
  async run(session) {
    const view = await session.open(A, { ready: modelsReady });
    await view.shot('single-3d', 'No compare: layout toggle hidden', VIEWPORT);
    await view.click('#model-compare', 2500);
    await view.shot(
      'compare-overlap',
      'Compare on (B = A): toggle shown, overlap',
      VIEWPORT
    );
    await view.close();

    const cmp = await session.open(A + COMPARE, { ready: modelsReady });
    await cmp.shot(
      'overlap-3d',
      'Overlap: changed parts translucent',
      VIEWPORT
    );
    await cmp.click('[data-layout="side"]');
    await cmp.shot(
      'side-3d',
      'Side by side: B whole and opaque, A/B tags',
      VIEWPORT
    );
    await cmp.drag('#model-canvas', -250, 60);
    await cmp.shot('side-orbited', 'Orbited: tags follow the builds', VIEWPORT);
    await cmp.click('[data-view="front"]');
    await cmp.shot('side-front', '3D Front button frames both', VIEWPORT);
    await cmp.click('[data-mode="2d"]', 2000);
    await cmp.shot(
      'side-then-2d',
      '2D: overlapped diff image; toggle and tags hidden',
      VIEWPORT
    );
    await cmp.click('[data-mode="3d"]');
    await cmp.shot('back-to-3d', 'Back to 3D: still side by side', VIEWPORT);
    await cmp.click('#model-mesh');
    await cmp.shot('side-hitbox-only', 'Mesh off: B stays put', VIEWPORT);
    await cmp.click('#model-mesh');
    await cmp.click('[data-layout="overlap"]');
    await cmp.shot(
      'back-to-overlap',
      'Overlap again: camera eased back',
      VIEWPORT
    );
    await cmp.click('[data-layout="side"]');
    await cmp.click('#model-compare', 1500);
    await cmp.shot(
      'compare-stopped',
      'Compare stopped: toggle hidden, layout dropped from URL',
      VIEWPORT
    );
    await cmp.close();

    const deep = await session.open(A + COMPARE + '&layout=side', {
      ready: modelsReady,
    });
    await deep.shot('deep-link-side', 'layout=side deep link', VIEWPORT);
    await deep.click('#model-fullscreen', 1500);
    await deep.shot('fullscreen-side', 'Fullscreen, side by side');
    await deep.close();

    const phone = await session.open(A + COMPARE + '&layout=side', {
      preset: 'mobile',
      ready: modelsReady,
    });
    await phone.shot('mobile-side', 'Phone: both builds fit', VIEWPORT);
    await phone.close();
  },
};
