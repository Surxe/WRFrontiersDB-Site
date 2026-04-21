# WRFrontiersDB-Site Terminology

This document defines common terms and concepts used throughout the WRFrontiersDB-Site codebase to help developers understand the data structures and architecture.

## Game Entities

### Parse Object

The fundamental data structure representing any game object. All game entities extend this base interface, providing common fields for identification, routing, and production status. The `parseObjectClass` field corresponds to the Python class name defined in the backend Parser.

### Module

Individual weapons, equipment, or components that can be equipped on robots. Modules contain statistical data, upgrade progression, faction affiliation, and may grant abilities. Only modules use production status to indicate readiness.

### Core Module

Essential robot components that form the basic structure: Chassis (robot base), Torso (main body, sometimes with weapon mount), and Shoulder (weapon mounting points). These are determined by module category classification.

### Pilot

Characters that operate robots with unique abilities and talents. Pilots have levels that unlock different talent configurations, belong to classes with visual badges, and have rarity tiers that determine capabilities.

### Pilot Talent

Special combat abilities that pilots can use. Talents provide statistical bonuses, complex buff effects with modifiers, and have cooldown periods. They can affect the pilot, their robot, or other entities.

### Character Preset

Complete robot configurations representing specific bot builds. Presets define module loadouts with socket placement and assign a pilot operator.

**Types:**

- **Factory Bot**: Pre-built configurations available to players. In the source data they are called Factory Presets.
- **AI Bot**: Bot configurations used by AI when players vacate lobbies. Synonymous with Virtual Bot. In the source data they are just factory presets = false.

### Ability

Game abilities that can be granted by modules or pilot talents. Abilities have localized names and descriptions for UI display.

### Rarity

Quality tier system for game objects (Common, Rare, Epic, Legendary). Each rarity has a name for display and a hex color code for UI theming.

### Module Stat

Defines how specific statistics should be displayed and formatted, including naming conventions, unit patterns, decimal precision, and whether higher values are better.

## Technical Concepts

### Localization

Multi-language support system using key-based text references. All user-facing text uses LocalizationKey objects instead of hardcoded strings, with support for different namespaces and invariant (non-translatable) text.

### Object Reference

String-based references linking game objects together using the format `OBJID_[Type]::[Name].[Version]`. This allows objects to reference each other without direct object dependencies.

### Slug

URL-friendly identifiers for routing that replace raw object IDs. Slugs are human-readable, lowercase with hyphens, and generated at build time with mappings stored in `slug_map.json`.

### Production Status

Development readiness indicator used only by modules. A module with `"Ready"` status is complete and available for production; other values indicate incomplete or in-development content.

### Socket

Mounting points on robots where modules attach. Sockets have identifiers, hierarchical positions, and reference the equipped module.
