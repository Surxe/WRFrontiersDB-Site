# Linking to the /models viewer

The 3D robot viewer at <https://wrf-db.info/models> reads its whole state from
the URL's query string. A link can open a specific build, compare two builds, or
turn the mesh or hitbox layers on and off. Every change the visitor makes is
written back to the URL (with no reload), so the address bar always holds a
link to the current view.

The quickest way to get a link is to set the build up in the viewer and copy
the URL. The rest of this page explains the format so you can make links
yourself.

## Build codes

The viewer writes each build as a **build code**, a short string that stands
for every part of the robot:

| Param | Value      | Meaning                                                                 |
| ----- | ---------- | ----------------------------------------------------------------------- |
| `a`   | build code | The build shown (build A)                                               |
| `b`   | build code | A second build to compare against A. Its presence turns compare mode on |

```text
https://wrf-db.info/models?a=544KK4KK24
https://wrf-db.info/models?a=10000&b=322002&layout=side
```

A full build is about 11 characters. Codes are made from the data repo's
build-code registry and stay valid as the game adds parts. The format is
specified in WRFrontiersDB-Data's `docs/build-codes.md`.

To link without making codes yourself, use the readable params below. The
viewer reads them and rewrites the address bar to build codes.

### Codes the viewer can't read

- A code made with newer game data than the site has (for example, from a tool
  running on data the site hasn't deployed yet) shows the default robot with
  the message "This build uses parts newer than this site's data". The address
  bar keeps the link unchanged until the visitor changes the build, so the same
  link works once the site has the newer data.
- A string that isn't a build code shows the default robot with a message that
  the link's build code isn't valid.

### When the viewer writes readable params instead

A build that has a part with no build code, such as an unreleased module from a
tutorial preset, is written with the readable params below. The same applies to
build B: if either build can't be encoded, both are written as readable params.

## Readable params

Readable params spell out each part. The viewer reads them whenever `a` is
absent. When `a` is present, readable build params are ignored.

### Build params

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

Module ids are the keys of
[`current/Objects/Module.json`](https://github.com/Surxe/WRFrontiersDB-Data/blob/main/current/Objects/Module.json)
in the WRFrontiersDB-Data repo, for example `DA_Module_ChassisAres.2` or
`DA_Module_Weapon_Shredder.0`. They don't match the slugs in the site's
`/modules/...` page URLs.

- A missing required slot (for example `torso`) gets the chassis's own part:
  `chassis=DA_Module_ChassisAnansi.2` with no `torso` param shows the Anansi
  torso. Only `chassis` is needed for a complete robot.
- A missing optional slot (weapons, gear) stays empty.
- A module that doesn't exist or doesn't fit the slot is ignored: the slot
  falls back as if the param were missing.
- If `chassis` is missing or invalid, the viewer picks a default chassis.

### Compare params

| Param          | Value     | Meaning                                                               |
| -------------- | --------- | --------------------------------------------------------------------- |
| `compare`      | `1`       | Turn compare on. Without it, `b.` params are ignored                  |
| `b.<slot key>` | Module id | B uses this module in that slot, e.g. `b.torso=DA_Module_TorsoAres.1` |
| `b.<slot key>` | empty     | B leaves that slot empty, e.g. `b.Ability=`                           |

Build B is written as its differences from A. Every slot without a `b.` param
is the same in B as in A. If B gets a shoulder with different weapon slots,
each new slot takes one of A's weapons of the matching class (light or heavy)
when one fits. `compare=1` with no `b.` params opens compare mode with B
identical to A.

`b.<slot key>` (readable) and `b` (a build code) are different params.

## View and language params

These work with both build codes and readable params.

| Param    | Values                                                                              | Default   | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `layout` | `side`                                                                              | (overlap) | While comparing, show B next to A in the 3D view instead of overlapping |
| `mesh`   | `0`, `1`                                                                            | `1`       | Show the module meshes                                                  |
| `hitbox` | `0`, `1`                                                                            | `1`       | Show the collision hitboxes                                             |
| `lang`   | `de`, `en`, `es`, `fr`, `ja`, `ko`, `pl`, `pt-BR`, `ru`, `tr`, `zh-Hans`, `zh-Hant` | `en`      | UI language (used on every page of the site)                            |

The viewer writes `mesh` and `hitbox` only when a layer is off (`0`). A missing
or unknown `lang` redirects to the same URL with `lang=en`, so you can leave it
out.

## Examples

A full build, with two weapons per shoulder and both gear slots:

```text
https://wrf-db.info/models?a=544KK4KK24
```

The same build with readable params (the viewer rewrites it to the code above):

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisBulgasari.2&torso=DA_Module_TorsoBulgasari.1&Shoulder_L=DA_Module_ShoulderBulgasari.0&Shoulder_L.Shoulder_Weapon_0=DA_Module_Weapon_Shredder.0&Shoulder_L.Shoulder_Weapon_1=DA_Module_Weapon_Shredder.0&Shoulder_R=DA_Module_ShoulderBulgasari.0&Shoulder_R.Shoulder_Weapon_0=DA_Module_Weapon_Shredder.0&Shoulder_R.Shoulder_Weapon_1=DA_Module_Weapon_Shredder.0&Ability=DA_Module_Ability_ArmorShield.1&UltAbility=DA_Module_Ability_InfiniteAmmo.1
```

Comparing Anansi (A) with Ares (B), side by side:

```text
https://wrf-db.info/models?a=10000&b=322002&layout=side
```

The Ares chassis with hitboxes only (no meshes) and the UI in German:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisAres.2&mesh=0&lang=de
```

Testing a torso swap: A is the stock Ares, and B is the same robot with only
the torso changed:

```text
https://wrf-db.info/models?chassis=DA_Module_ChassisAres.2&compare=1&b.torso=DA_Module_TorsoBulgasari.1
```

## Building links in code

Readable params need no codec. Module ids only contain letters, digits, `_` and
`.`, so they need no escaping. Still, building the query with a URL library is
the safest approach:

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

The URL format is defined in `src/scripts/model_viewer/params.ts`, with the
readable build and compare parsing in `src/scripts/robot/build/params.ts` and
`src/scripts/robot/build/compare.ts`. Build codes come from the data repo's
codec (`tools/js/build_code.js`), wrapped in `src/scripts/robot/build/code.ts`.
Links rendered into other pages go through `src/utils/build_codes.ts`.
