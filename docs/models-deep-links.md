# Linking to the /models viewer

The 3D robot viewer at <https://wrf-db.info/models> reads its whole state from
the URL's query string. A link can open a specific build, compare two builds, or
turn the mesh or hitbox layers on and off. Every change the visitor makes is
written back to the URL (with no reload), so the address bar always holds a
link to the current view.

The quickest way to get a link is to set the build up in the viewer and copy
the URL. The rest of this page explains the format so you can generate links
yourself.

## Build params

Each filled slot is one param. The key says where the part mounts, and the
value is a Module id:

| Key                                                            | Slot                                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `chassis`                                                      | Chassis (the root of the build)                                                                           |
| `torso`                                                        | Torso, mounted on the chassis                                                                             |
| `Shoulder_L`, `Shoulder_R`                                     | Left and right shoulders, mounted on the torso                                                            |
| `Shoulder_L.Shoulder_Weapon_0`, `Shoulder_L.Shoulder_Weapon_1` | Weapons in the left shoulder. A shoulder has 0, 1 or 2 weapon slots. The same keys exist for `Shoulder_R` |
| `Torso_Weapon_0`                                               | Weapon mounted on the torso, if the torso has a weapon slot                                               |
| `Ability`                                                      | Supply gear                                                                                               |
| `UltAbility`                                                   | Cycle gear                                                                                                |

Nested keys are socket names joined by `.`, so a socket added to the game later
gets a key automatically.

### Module ids

Module ids are the keys of
[`current/Objects/Module.json`](https://github.com/Surxe/WRFrontiersDB-Data/blob/main/current/Objects/Module.json)
in the WRFrontiersDB-Data repo. A few examples:

- `DA_Module_ChassisAres.2`
- `DA_Module_TorsoAres.1`
- `DA_Module_ShoulderAres.0`
- `DA_Module_Weapon_Shredder.0`
- `DA_Module_Ability_ArmorShield.1`

The ids don't match the slugs in the site's `/modules/...` page URLs, so take
them from the data file or from a viewer URL.

### Missing and invalid slots

- A missing required slot (for example `torso`) gets the chassis's own part:
  `chassis=DA_Module_ChassisAnansi.2` with no `torso` param shows the Anansi
  torso. Only `chassis` is needed for a complete robot.
- A missing optional slot (weapons, gear) stays empty.
- A module that doesn't exist or doesn't fit the slot is ignored: the slot
  falls back as if the param were missing.
- If `chassis` is missing or invalid, the viewer picks a default chassis.

## Compare params

The viewer can compare build A (the build params above) with a second build B.
B is written as its differences from A:

| Param          | Value     | Meaning                                                               |
| -------------- | --------- | --------------------------------------------------------------------- |
| `compare`      | `1`       | Turn compare on. Without it, `b.` params are ignored                  |
| `b.<slot key>` | Module id | B uses this module in that slot, e.g. `b.torso=DA_Module_TorsoAres.1` |
| `b.<slot key>` | empty     | B leaves that slot empty, e.g. `b.Ability=`                           |
| `layout`       | `side`    | Show B next to A in the 3D view. Without it, the builds overlap       |

Every slot without a `b.` param is the same in B as in A. If B gets a shoulder
with different weapon slots, each new slot takes one of A's weapons of the
matching class (light or heavy) when one fits.

`compare=1` with no `b.` params opens compare mode with B identical to A.

## View and language params

| Param    | Values                                                                              | Default | Meaning                                      |
| -------- | ----------------------------------------------------------------------------------- | ------- | -------------------------------------------- |
| `mesh`   | `0`, `1`                                                                            | `1`     | Show the module meshes                       |
| `hitbox` | `0`, `1`                                                                            | `1`     | Show the collision hitboxes                  |
| `lang`   | `de`, `en`, `es`, `fr`, `ja`, `ko`, `pl`, `pt-BR`, `ru`, `tr`, `zh-Hans`, `zh-Hant` | `en`    | UI language (used on every page of the site) |

A missing or unknown `lang` redirects to the same URL with `lang=en`, so you
can leave it out.

## Examples

Just a chassis. Its own torso and shoulders are filled in, with no weapons or
gear:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisAres.2
```

A full build, with two weapons per shoulder and both gear slots:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisBulgasari.2&torso=DA_Module_TorsoBulgasari.1&Shoulder_L=DA_Module_ShoulderBulgasari.0&Shoulder_L.Shoulder_Weapon_0=DA_Module_Weapon_Shredder.0&Shoulder_L.Shoulder_Weapon_1=DA_Module_Weapon_Shredder.0&Shoulder_R=DA_Module_ShoulderBulgasari.0&Shoulder_R.Shoulder_Weapon_0=DA_Module_Weapon_Shredder.0&Shoulder_R.Shoulder_Weapon_1=DA_Module_Weapon_Shredder.0&Ability=DA_Module_Ability_ArmorShield.1&UltAbility=DA_Module_Ability_InfiniteAmmo.1
```

The Ares chassis with hitboxes only (no meshes) and the UI in German:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisAres.2&mesh=0&hitbox=1&lang=de
```

Comparing Anansi (A) with Ares (B), side by side:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisAnansi.2&torso=DA_Module_TorsoAnansi.1&Shoulder_L=DA_Module_ShoulderAnansi.0&Shoulder_R=DA_Module_ShoulderAnansi.0&compare=1&b.chassis=DA_Module_ChassisAres.2&b.torso=DA_Module_TorsoAres.1&b.Shoulder_L=DA_Module_ShoulderAres.0&b.Shoulder_R=DA_Module_ShoulderAres.0&layout=side
```

Testing a torso swap: A is the stock Ares, and B is the same robot with only
the torso changed:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisAres.2&compare=1&b.torso=DA_Module_TorsoBulgasari.1
```

## Building links in code

Module ids only contain letters, digits, `_` and `.`, so they need no escaping.
Still, building the query with a URL library is the safest approach:

```js
const params = new URLSearchParams({
  chassis: 'DA_Module_ChassisAres.2',
  'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_Weapon_Shredder.0',
});
const href = `https://wrf-db.info/models?${params}`;
```

Inside an HTML `href` attribute, `&` may be written as `&amp;`. Browsers decode
it before the viewer reads the URL.

## Source

The format is defined in `src/scripts/model_viewer/params.ts`, with the build
and compare parsing in `src/scripts/robot/build/params.ts` and
`src/scripts/robot/build/compare.ts`.
