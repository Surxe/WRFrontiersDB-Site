/**
 * Live 3D construction of hitbox + untextured module models.
 *
 * Loads per-module model JSONs (current/Models/<CharacterModuleId>.json) plus
 * the mount-graph tables, resolves the module world transforms (preset socket
 * chain + adapter offsets + the runtime mount roll), and renders shoulder +
 * weapon combinations in three.js.
 *
 * Mount resolution (see mount.ts):
 *   world(module) = world(parent) x socketFrame(parent, socketName)
 *                   x T(adapterOffset) x R(mountRoll)
 *
 * This entry module wires the /models page controls to a {@link ModelViewer};
 * the geometry, mount math and data loading live in the sibling modules.
 */
import { fetchJSON } from './data';
import { refToId } from '../../utils/object_reference';
import { el, populateSelect } from './dom';
import {
  ModelViewer,
  type ShoulderSide,
  type WeaponMode,
} from './viewer';
import type { CharacterPreset } from '../../types/character_preset';
import type { VirtualBot } from '../../types/virtual_bot';

async function init(): Promise<void> {
  const loading = document.getElementById('model-loading');
  const hideLoading = (): void => {
    if (loading) loading.remove();
  };

  const status = el<HTMLElement>('model-status');
  try {
    const container = el<HTMLElement>('model-canvas');
    const viewer = new ModelViewer(container, status);

    const botSelect = el<HTMLSelectElement>('model-bot');
    const presetSelect = el<HTMLSelectElement>('model-preset');
    const sideSelect = el<HTMLSelectElement>('model-side');
    const weaponSelect = el<HTMLSelectElement>('model-weapon');
    const hitboxBox = el<HTMLInputElement>('model-hitbox');
    const skeletonBox = el<HTMLInputElement>('model-skeleton');

    status.textContent = 'Loading tables...';
    const bots = await fetchJSON<Record<string, VirtualBot>>(
      '/WRFrontiersDB-Data/current/Objects/VirtualBot.json',
    );
    const presets = await fetchJSON<Record<string, CharacterPreset>>(
      '/WRFrontiersDB-Data/current/Objects/CharacterPreset.json',
    );

    if (Object.keys(bots).length === 0 && Object.keys(presets).length === 0) {
      status.textContent =
        'No model data found. Run the parser to populate WRFrontiersDB-Data/current/.';
      hideLoading();
      return;
    }

    populateSelect(
      botSelect,
      Object.entries(bots).map(([id, bot]) => ({ value: id, label: bot.name?.Key ?? id })),
    );

    // A bot's factory presets when it declares any, else the full preset list.
    const presetsFor = (botId: string): { value: string; label: string }[] => {
      const refs = (bots[botId]?.factory_preset_refs ?? []).map(refToId).filter((id) => presets[id]);
      const ids = refs.length > 0 ? refs : Object.keys(presets);
      return ids.map((id) => ({ value: id, label: id }));
    };

    const rebuildPresetList = (): void => {
      populateSelect(presetSelect, presetsFor(botSelect.value));
    };
    botSelect.addEventListener('change', rebuildPresetList);
    rebuildPresetList();

    const rebuild = async (): Promise<void> => {
      const preset = presets[presetSelect.value];
      if (!preset) {
        status.textContent = 'No preset selected.';
        return;
      }
      try {
        await viewer.build({
          preset,
          side: sideSelect.value as ShoulderSide,
          weaponMode: weaponSelect.value as WeaponMode,
          hitbox: hitboxBox.checked,
          skeleton: skeletonBox.checked,
        });
      } catch (err) {
        console.error('model build failed:', err);
        status.textContent = `Failed to build model: ${err instanceof Error ? err.message : String(err)}`;
      }
    };

    for (const control of [presetSelect, sideSelect, weaponSelect, hitboxBox, skeletonBox]) {
      control.addEventListener('change', () => void rebuild());
    }

    await rebuild();
  } catch (err) {
    console.error('model viewer init failed:', err);
    status.textContent =
      'Could not start the viewer. Check the browser console; ' +
      `(${err instanceof Error ? err.message : String(err)})`;
  } finally {
    hideLoading();
  }
}

void init();
