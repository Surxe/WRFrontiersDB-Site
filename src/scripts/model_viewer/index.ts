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
 * This entry module wires the /models page controls to a {@link ModelViewer}
 * and to the URL query params (see params.ts); the geometry, mount math and data
 * loading live in the sibling modules.
 */
import { fetchJSON } from './data';
import { refToId } from '../../utils/object_reference';
import { el, populateSelect } from './dom';
import { ModelViewer } from './viewer';
import {
  parseModelParams,
  writeModelParams,
  type ModelQueryParams,
  type RenderMode,
  type ShoulderSide,
} from './params';
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

    const initial = parseModelParams(window.location.search);
    // `mode` has no control yet — it arrives from the deep link (or defaults).
    const mode: RenderMode = initial.mode ?? 'preset';

    populateSelect(
      botSelect,
      Object.entries(bots).map(([id, bot]) => ({ value: id, label: bot.name?.Key ?? id })),
    );

    // A bot's factory presets when it declares any, else the full preset list.
    const presetsFor = (botId: string): string[] => {
      const refs = (bots[botId]?.factory_preset_refs ?? [])
        .map(refToId)
        .filter((id) => presets[id]);
      return refs.length > 0 ? refs : Object.keys(presets);
    };

    // The bot whose factory presets include this preset, if any (lets a
    // preset-only link select the right bot in the control bar).
    const botForPreset = (presetId: string): string | undefined => {
      for (const [id, bot] of Object.entries(bots)) {
        if ((bot.factory_preset_refs ?? []).some((r) => refToId(r) === presetId)) {
          return id;
        }
      }
      return undefined;
    };

    const resolveInitialBot = (): string => {
      if (initial.bot && bots[initial.bot]) return initial.bot;
      if (initial.preset) {
        const derived = botForPreset(initial.preset);
        if (derived) return derived;
      }
      return botSelect.options[0]?.value ?? '';
    };
    botSelect.value = resolveInitialBot();

    const populatePresets = (preferred?: string): void => {
      const options = presetsFor(botSelect.value);
      // A deep-linked preset must be selectable even when it is not one of the
      // selected bot's factory presets (e.g. a non-factory / AI preset).
      if (preferred && presets[preferred] && !options.includes(preferred)) {
        options.unshift(preferred);
      }
      populateSelect(presetSelect, options.map((id) => ({ value: id, label: id })));
      presetSelect.value =
        preferred && options.includes(preferred) ? preferred : options[0] ?? '';
    };
    populatePresets(initial.preset);

    sideSelect.value = initial.side ?? 'Both';
    hitboxBox.checked = initial.hitbox ?? true;
    skeletonBox.checked = initial.skeleton ?? false;

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
          mode,
          hitbox: hitboxBox.checked,
          skeleton: skeletonBox.checked,
        });
      } catch (err) {
        console.error('model build failed:', err);
        status.textContent = `Failed to build model: ${err instanceof Error ? err.message : String(err)}`;
      }
    };

    const syncUrl = (): void => {
      const state: ModelQueryParams = {
        bot: botSelect.value || undefined,
        preset: presetSelect.value || undefined,
        mode,
        side: sideSelect.value as ShoulderSide,
        hitbox: hitboxBox.checked,
        skeleton: skeletonBox.checked,
      };
      writeModelParams(state);
    };

    botSelect.addEventListener('change', () => {
      populatePresets();
      syncUrl();
      void rebuild();
    });
    for (const control of [presetSelect, sideSelect, hitboxBox, skeletonBox]) {
      control.addEventListener('change', () => {
        syncUrl();
        void rebuild();
      });
    }

    // Reflect the resolved state back into the URL so the landing view — deep
    // linked or default — is immediately shareable.
    syncUrl();
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
