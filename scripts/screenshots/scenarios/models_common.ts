/** Builds, selectors and readiness shared by the /models scenarios. */
import type { Page } from 'playwright';

export const A =
  '/models?chassis=DA_Module_ChassisAnansi.2&torso=DA_Module_TorsoAnansi.1' +
  '&Shoulder_L=DA_Module_ShoulderAnansi.0&Shoulder_R=DA_Module_ShoulderAnansi.0';
/** B swaps every structural part, so the diff colors show. */
export const COMPARE =
  '&compare=1&b.chassis=DA_Module_ChassisAres.2&b.torso=DA_Module_TorsoAres.1' +
  '&b.Shoulder_L=DA_Module_ShoulderAres.0&b.Shoulder_R=DA_Module_ShoulderAres.0';

export const VIEWPORT = '#model-viewport';

/** The viewer has drawn the build: the status line clears. */
export async function modelsReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('#model-status')?.textContent === '',
    null,
    { timeout: 60_000 }
  );
  await page.waitForTimeout(1500);
}
