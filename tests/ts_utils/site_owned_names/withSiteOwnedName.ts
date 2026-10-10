import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  SITE_OWNED_NAME_KEYS,
  withSiteOwnedName,
} from '../../../src/utils/site_owned_names';
import { getParseObjects } from '../../../src/utils/parse_object';
import type { ModuleGroup } from '../../../src/types/module_group';

const TITAN_SHOULDER_KEY = {
  Key: 'GRP_TitanShoulders_Name',
  TableNamespace: 'ModuleGroups',
};

describe('withSiteOwnedName', () => {
  it('attaches the site key to a keyless name the site owns', () => {
    const name = withSiteOwnedName('ModuleGroup', 'titan-shoulder', {
      InvariantString: 'Titan Shoulder',
      en: 'Titan Shoulder',
    });

    expect(name).toEqual({ ...TITAN_SHOULDER_KEY, en: 'Titan Shoulder' });
  });

  it('takes en from InvariantString when the name has no en', () => {
    const name = withSiteOwnedName('ModuleGroup', 'titan-shoulder', {
      InvariantString: 'Titan Shoulder',
    });

    expect(name).toEqual({ ...TITAN_SHOULDER_KEY, en: 'Titan Shoulder' });
  });

  it('leaves a name that already has a key alone', () => {
    const gameName = {
      Key: 'CMP_Type_Titan_Shoulder',
      TableNamespace: 'Component_Tags',
      en: 'Titan Shoulder',
    };

    expect(withSiteOwnedName('ModuleGroup', 'titan-shoulder', gameName)).toBe(
      gameName
    );
  });

  it('leaves names the site has no key for alone', () => {
    const name = { InvariantString: 'Some Name' };

    expect(withSiteOwnedName('ModuleGroup', 'light-weapon', name)).toBe(name);
    expect(withSiteOwnedName('Pilot', 'titan-shoulder', name)).toBe(name);
    expect(
      withSiteOwnedName('ModuleGroup', 'titan-shoulder', undefined)
    ).toBeUndefined();
  });
});

describe('SITE_OWNED_NAME_KEYS', () => {
  it('only names keys public/locales/en.json has', () => {
    const siteEn = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'public/locales/en.json'),
        'utf8'
      )
    );

    for (const names of Object.values(SITE_OWNED_NAME_KEYS)) {
      for (const { Key, TableNamespace } of Object.values(names)) {
        expect(siteEn[TableNamespace]?.[Key], Key).toBeTruthy();
      }
    }
  });
});

describe('getParseObjects', () => {
  it('gives the titan shoulder group its site-owned name key', () => {
    const groups = getParseObjects<ModuleGroup>('Objects/ModuleGroup.json');

    expect(groups['titan-shoulder'].name).toEqual({
      ...TITAN_SHOULDER_KEY,
      en: 'Titan Shoulder',
    });
  });
});
