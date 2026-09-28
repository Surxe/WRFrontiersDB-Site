import { describe, it, expect } from 'vitest';
import {
  matchesTerms,
  normalizeSearchText,
  parseQuery,
} from '../../src/scripts/search/text';

describe('normalizeSearchText', () => {
  it('lower-cases, strips accents and collapses whitespace', () => {
    expect(normalizeSearchText('  Énergie   Shield\t')).toBe('energie shield');
  });

  it('folds non-Latin scripts the same way on both sides', () => {
    // й decomposes to и + a mark, so either spelling matches.
    expect(normalizeSearchText('Тайфун')).toBe(normalizeSearchText('таифун'));
  });
});

describe('parseQuery', () => {
  it('splits into normalized words', () => {
    expect(parseQuery(' Heavy  RAIL ')).toEqual(['heavy', 'rail']);
  });

  it('has no terms for a blank query', () => {
    expect(parseQuery('   ')).toEqual([]);
  });
});

describe('matchesTerms', () => {
  const text = normalizeSearchText('Railgun (Heavy)');

  it('matches every word in any order, as substrings', () => {
    expect(matchesTerms(text, parseQuery('heavy rail'))).toBe(true);
  });

  it('misses when any word is absent', () => {
    expect(matchesTerms(text, parseQuery('heavy laser'))).toBe(false);
  });

  it('matches everything for a blank query', () => {
    expect(matchesTerms(text, [])).toBe(true);
  });
});
