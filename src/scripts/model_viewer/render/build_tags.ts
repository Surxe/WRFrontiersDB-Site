/**
 * Name tags over the 3D view while comparing side by side: one card per
 * build, centered above it, so which robot is A and which is B reads at a
 * glance. Cards never take pointer events, so orbiting still works through
 * them.
 */
import { cssHex } from '../colors';
import { AnchoredTags } from '../../viewer3d/anchored_tags';

export interface BuildTag {
  text: string;
  /** Swatch color, 0xRRGGBB. */
  color: number;
}

export class BuildTags extends AnchoredTags {
  constructor(container: HTMLElement, tags: readonly BuildTag[]) {
    super(container, 'model-build-tags');
    this.setCards(
      tags.map(({ text, color }) => {
        const card = document.createElement('div');
        card.className = 'model-build-tag';
        const swatch = document.createElement('span');
        swatch.className = 'model-swatch';
        swatch.style.background = cssHex(color);
        card.append(swatch, text);
        return card;
      })
    );
  }
}
