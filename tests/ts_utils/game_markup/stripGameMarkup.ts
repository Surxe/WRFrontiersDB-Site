import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripGameMarkup,
  stripGameMarkupFromLocData,
  styleTagNames,
} from '../../../public/js/game_markup.js';

// Cases are real strings from the game's localization.
describe('stripGameMarkup', () => {
  it('keeps the text of styled spans', () => {
    expect(
      stripGameMarkup(
        'You can freely switch some robot <Orange>Gear</> modules.\r\n<Orange>Cycle Gear</> needs to charge up.'
      )
    ).toBe(
      'You can freely switch some robot Gear modules.\r\nCycle Gear needs to charge up.'
    );
    expect(stripGameMarkup('Reach <Level>Level {0}</> to unlock Pilots')).toBe(
      'Reach Level {0} to unlock Pilots'
    );
  });

  it('removes icons and key glyphs with the space before them', () => {
    expect(
      stripGameMarkup(
        'Complete them to earn extra <img id="Credits"/> <credits>Credits</> as well as rare <img id="Intel"/> <intel>Intel</>.'
      )
    ).toBe('Complete them to earn extra Credits as well as rare Intel.');
    expect(stripGameMarkup('Hold <key name="Spacebar"/> to Continue')).toBe(
      'Hold to Continue'
    );
  });

  it('removes icons written as an empty pair', () => {
    expect(
      stripGameMarkup(
        'You are about to spend <img id="{currency}"></> {count}.\nContinue?'
      )
    ).toBe('You are about to spend {count}.\nContinue?');
  });

  it('leaves story text in angle brackets alone', () => {
    const bio = 'Nonsense, obviously. <LIE> Oh, shut up! Where was I?';
    expect(stripGameMarkup(bio)).toBe(bio);
  });

  it('strips unclosed openers and stray closers of style names only', () => {
    const styles = new Set(['Italic', 'Orange']);
    expect(
      stripGameMarkup('Note: <Italic>destroyed robots redeploy.', styles)
    ).toBe('Note: destroyed robots redeploy.');
    expect(stripGameMarkup('Gear</> modules', styles)).toBe('Gear modules');
    const bio = 'Nonsense. <LIE> Oh, shut up!';
    expect(stripGameMarkup(bio, styles)).toBe(bio);
  });

  it('leaves unclosed openers alone without style names', () => {
    expect(stripGameMarkup('Note: <Italic>destroyed.')).toBe(
      'Note: <Italic>destroyed.'
    );
  });

  it('passes through empty and plain text', () => {
    expect(stripGameMarkup('')).toBe('');
    expect(stripGameMarkup('Plain text')).toBe('Plain text');
  });
});

describe('styleTagNames', () => {
  it('collects names closed with </> anywhere, but not unclosed ones', () => {
    const locData = {
      Tutorial_tips: {
        Tip: '<Bold>TIP:</> <img id="Craft"></> <Italic>Mind who is under.</>',
        Slip: 'Note: <Italic>unclosed',
      },
      Pilot_Bio: { Duncan: 'Nonsense. <LIE> Oh, shut up!' },
    };
    expect(styleTagNames(locData)).toEqual(new Set(['Bold', 'Italic']));
  });
});

describe('stripGameMarkupFromLocData', () => {
  it('strips every string of every namespace', () => {
    const locData = {
      UI_ConstructorInventory: { Supply: '<Orange>Supply Gear</> modules' },
      Web_UI: { Plain: 'Plain' },
    };
    expect(stripGameMarkupFromLocData(locData)).toEqual({
      UI_ConstructorInventory: { Supply: 'Supply Gear modules' },
      Web_UI: { Plain: 'Plain' },
    });
  });

  it("uses the dictionary's own style names for unclosed openers", () => {
    const locData = {
      Tutorial_tips: {
        Closed: '<Italic>Shields recharge.</>',
        Slip: 'Note: <Italic>unclosed',
      },
      Pilot_Bio: { Duncan: 'Nonsense. <LIE> Oh, shut up!' },
    };
    expect(stripGameMarkupFromLocData(locData)).toEqual({
      Tutorial_tips: { Closed: 'Shields recharge.', Slip: 'Note: unclosed' },
      Pilot_Bio: { Duncan: 'Nonsense. <LIE> Oh, shut up!' },
    });
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters so story text renders as written', () => {
    expect(escapeHtml('Nonsense. <LIE> R&D')).toBe(
      'Nonsense. &lt;LIE&gt; R&amp;D'
    );
  });
});
