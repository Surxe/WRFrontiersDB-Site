import { describe, it, expect } from 'vitest';
import {
  ElementFilter,
  type Hideable,
} from '../../src/scripts/search/element_filter';

const el = (): Hideable => ({ hidden: false });

function setup() {
  const robotsHeader = el();
  const titansHeader = el();
  const typhon = el();
  const raven = el();
  const colossus = el();
  const filter = new ElementFilter([
    {
      header: robotsHeader,
      items: [
        { element: typhon, text: 'Typhon' },
        { element: raven, text: 'Raven' },
      ],
    },
    { header: titansHeader, items: [{ element: colossus, text: 'Colossus' }] },
  ]);
  return { filter, robotsHeader, titansHeader, typhon, raven, colossus };
}

describe('ElementFilter', () => {
  it('hides misses and headers whose items all miss', () => {
    const s = setup();
    expect(s.filter.apply('typh')).toBe(1);
    expect(s.typhon.hidden).toBe(false);
    expect(s.raven.hidden).toBe(true);
    expect(s.colossus.hidden).toBe(true);
    expect(s.robotsHeader.hidden).toBe(false);
    expect(s.titansHeader.hidden).toBe(true);
  });

  it('shows everything again for a blank query', () => {
    const s = setup();
    s.filter.apply('zzz');
    expect(s.filter.apply('')).toBe(3);
    expect(
      [s.typhon, s.raven, s.colossus, s.titansHeader].map((e) => e.hidden)
    ).toEqual([false, false, false, false]);
  });

  it('matches case-insensitively', () => {
    const s = setup();
    expect(s.filter.apply('COLOSSUS')).toBe(1);
    expect(s.colossus.hidden).toBe(false);
  });

  it('leaves ungrouped items without a header', () => {
    const item = el();
    const filter = new ElementFilter([
      { header: null, items: [{ element: item, text: 'Empty' }] },
    ]);
    expect(filter.apply('x')).toBe(0);
    expect(item.hidden).toBe(true);
  });
});
