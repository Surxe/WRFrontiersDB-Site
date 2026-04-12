---
name: module-group-knowledge
description: Module Type, Category, and Group knowledge distinctions
---

# Module Type, Category, and Group Analysis

## Overview

This document explains the differences between Module Type, Module Category, and Module Group in the WRFrontiersDB-Site project, and how Module Group mapping is implemented to provide user-friendly navigation.

## Module Category

**Purpose**: Defines the slot type where modules can be installed on a robot.

**Structure**: Each module belongs to exactly one category that determines its physical placement:

- **Chassis** - Defines robot mobility, weight capacity, and energy supply
- **Shoulder** - Provides weapon slots and shield generators
- **Torso** - Contains signature core gear modules, some with weapon slots
- **Weapon** - Weapons (heavy weapons only in universal slots, light weapons in any slot)
- **Ability** - Tactical consumables with limited uses per battle

**Problem**: Too broad for user navigation - groups Titan and non-Titan chassis together, losing important distinctions.

## Module Type

**Purpose**: Specific module variants within each category, including Titan-specific variants.

**Structure**: Each module has exactly one type that provides granular classification:

- **Standard vs Titan variants** for chassis, torso, and shoulders
- **Weapon classifications**: Light, Heavy, and multiple Titan weapon classes
- **Ability types**: Supply Gear and Cycle Gear variants

**Problem**: Too granular for user navigation - users don't think in terms of "TitanAlphaChassis" vs "TitanGrimChassis".

## Module Group

**Purpose**: User-friendly navigation that combines category and type variant into logical groups.

**Structure**: Intuitive groupings that match how players actually browse modules:

- **Titan vs Standard groups**: Separate groups for Titan and standard chassis, torsos, and shoulders
- **Weapon groups**: Light Weapons, Heavy Weapons, and Titan Weapons
- **Ability groups**: Supply Gear and Cycle Gear

## Module Group Mapping Implementation

### Mapping Implementation

The mapping uses a constant that maps each module type ID to a group ID, then enriches modules with their group assignments using standard enrichment patterns.

## Data Relationships

### Module Object Structure

Each module has:

- `module_type_ref`: Points to a specific ModuleType
- ModuleType has `module_category_ref`: Points to a ModuleCategory

### Navigation Flow

1. **Module** (actual game item)
2. **ModuleType** (specific variant)
3. **ModuleCategory** (slot type)
4. **ModuleGroup** (user-friendly grouping)

## Benefits of Module Groups

1. **User Experience**: Intuitive groups vs granular types or broad categories
2. **Logical Grouping**: Combines mechanical similarity (Titan vs standard) with functional similarity (weapon types, ability types)
3. **Scalability**: Easy to add new module types to existing groups
4. **Consistency**: Follows the same enrichment pattern as other object types in the codebase
5. **Localization Support**: Group names and descriptions support multiple languages

## Summary

- **Module Category**: Too broad - loses important distinctions between Titan and standard modules
- **Module Type**: Too granular - users don't distinguish between different Titan variants
- **Module Group**: Just right - combines category and type variant into intuitive user-facing groups

The Module Group system provides the optimal balance between specificity and usability for module navigation in the WRFrontiersDB-Site.
