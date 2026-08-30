---
name: coding-conventions
description: Site-wide TypeScript coding conventions for WRFrontiersDB-Site - where constants live, no backwards compatibility, and when NOT to add undefined/null guards. Load before writing or editing src/ TypeScript.
---

# Coding conventions

Apply these when writing or editing TypeScript in this repo.

## Constants

When defining constants - such as object ids (`DA_ModuleCategory_Torso.0`) or
refs (`ObjRef_ModuleCategory::DA_ModuleCategory_Torso.0`) - always define them in
`src/utils/constants.ts`, never inline.

## No backwards compatibility

Never add backwards-compatibility shims or fallbacks. This application is not at
the stage where backwards compatibility is needed; prefer the clean change.

## Undefined / null checks

Before wrapping a displayed value in an undefined/null check, first check the
TypeScript chain to see whether the object should always exist. For example, the
`Pilot` interface in `pilots.ts` declares `faction_ref` as required (not
optional), so resolving that faction ref needs no undefined/null guard. Only
guard values the types say can actually be missing.
