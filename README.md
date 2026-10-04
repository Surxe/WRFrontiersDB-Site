# WRFrontiersDB-Site

Static [Astro](https://astro.build) site for the War Robots: Frontiers database,
published at [wrf-db.info](https://wrf-db.info). It builds a page for every game
object (modules, pilots, robots, character presets, ...) from the latest game
data, plus a 3D robot model viewer at `/models`. Text is localized client-side
into every game language.

## Setup

The site reads game data from
[WRFrontiersDB-Data](https://github.com/Surxe/WRFrontiersDB-Data), which is not
committed here. Clone it next to this repo and link it in (both paths are
gitignored):

```bash
git clone https://github.com/Surxe/WRFrontiersDB-Data ../WRFrontiersDB-Data
ln -s ../WRFrontiersDB-Data WRFrontiersDB-Data
ln -s ../WRFrontiersDB-Data public/WRFrontiersDB-Data
```

Shared styles come from the
[WRFrontiersDB-Design](https://github.com/Surxe/WRFrontiersDB-Design) submodule:

```bash
git submodule update --init
npm install
npm run sync:slugs    # copies the data repo's slug map to public/ (gitignored); dev + build need it
```

Slugs (the URL path segment of each object page) are decided in WRFrontiersDB-Data:
its `tools/wrfdb_data/slug_map.py` builds `index/slug_map.json`, which the Discord bot
reads too. Run `sync:slugs` after cloning and after pulling new data; CI and the
pipeline copy it on every build.

AI agent docs live in `.agents/`; run `bash .agents/setup-symlinks.sh` once per
checkout (see [.agents/README.md](.agents/README.md)).

## Commands

| Command                | Action                                      |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Start the dev server at `localhost:4321`    |
| `npm run build`        | Build the site to `./dist/`                 |
| `npm run preview`      | Preview the build locally                   |
| `npm run sync:slugs`   | Copy the data repo's slug map to `public/`  |
| `npm run lint`         | ESLint                                      |
| `npm run lint:styles`  | Design-system style lint                    |
| `npm run format:check` | Prettier check (`format:fix` to apply)      |
| `npm run vitest`       | Run all non-heavy tests                     |
| `npm run vitest:heavy` | Run all tests, including heavy ones (POSIX) |

Deployment targets are described in [BUILD.md](BUILD.md).

## Docs

Start at [docs/overview.md](docs/overview.md) for architecture, conventions and
the project layout.
