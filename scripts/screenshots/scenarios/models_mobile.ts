/**
 * /models on a phone: the page flow (header, build panel, viewport, area
 * panel, build B), the 2D views with their part labels, and fullscreen.
 */
import type { Scenario } from '../harness';
import { A, COMPARE, modelsReady, VIEWPORT } from './models_common';

export const modelsMobile: Scenario = {
  name: 'models-mobile',
  description:
    '/models on a phone (400x860): page order, 3D and 2D viewport, part ' +
    'labels, fullscreen, and compare stacking. A is Anansi, B is Ares.',
  async run(session) {
    const single = await session.open(A, {
      preset: 'mobile',
      ready: modelsReady,
    });
    await single.shot('top', 'First screen: what a phone user lands on');
    await single.fullPage('page', 'Whole page: section order and widths');
    await single.shot('viewport-3d', '3D viewport and its controls', VIEWPORT);
    await single.click('[data-mode="2d"]', 2000);
    await single.shot(
      'viewport-2d',
      '2D: part labels around the robot',
      VIEWPORT
    );
    await single.click('#model-fullscreen', 1500);
    await single.shot('fullscreen-2d', 'Fullscreen 2D: label placement');
    await single.click('#model-fullscreen', 1500);
    await single.close();

    const cmp = await session.open(A + COMPARE, {
      preset: 'mobile',
      ready: modelsReady,
    });
    await cmp.fullPage('compare-page', 'Compare: where build B lands');
    await cmp.click('[data-mode="2d"]', 2000);
    await cmp.shot('compare-2d', 'Compare 2D: diff labels', VIEWPORT);
    await cmp.close();
  },
};
