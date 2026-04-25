# Important Components for Agents

This document outlines the most important components that agents should consider using when working with the WRFrontiersDB-Site codebase.

## Core Infrastructure Components

### 1. ObjRef Family (`src/components/obj_ref/`)

#### `ObjRef.astro`

Universal object reference component that handles:

- Icons, links, localization, hover tooltips, stat choices
- Used across ALL list/detail pages for consistent object references
- Replaces manual `<a href>` + `<Icon>` combinations

### 2. LocalizedText.astro

Core localization component for UI text:

- Handles lazy-loading and fallback text
- Used throughout site for translatable content

### 3. Page.astro

Base page layout component:

- Handles meta tags, SEO, language selector, header images
- Provides consistent page structure

## Data Display Components

### 4. StatEmbedLocalizedText.astro

Handles stat value formatting with localization:

- Critical for module/pilot talent displays
- Supports multiple choice patterns and unit formatting

### 5. ParseObjectPage.astro

Standard detail page layout:

- Handles meta descriptions, breadcrumbs, structured data
- Used by ALL detail pages (modules, pilots, etc.)

### 7. Navigation Components (`src/components/nav/`)

#### `BaseNavBox.astro` - Base navigation component

- Provides consistent navigation structure
- Used by all specialized navigation components

### 8. Icon.astro

Simple icon display component:

- Renders icon with alt text and styling
- **Consider using `ObjRef` if the icon serves as a reference to an object instead for consistency**

## Agent Guidelines

### Always Use:

1. **`ObjRef.astro`** instead of separate `<Icon>` + `<a href>` patterns
2. **`LocalizedText.astro`** for any translatable UI text
3. **`StatEmbedLocalizedText.astro`** for stat displays
4. **`Page.astro`** and **`ParseObjectPage.astro`** for consistent layouts
5. Navigation components for consistent site navigation

### Consider Replacing:

- Manual icon + link combinations with `ObjRef`
- Hardcoded text with `LocalizedText`
- Custom table layouts with `Table.astro`

### Patterns to Follow:

- Use `ObjRef` for object references (icons + links + localization)
- Use `LocalizedText` for UI text localization
- Use `StatEmbedLocalizedText` for stat formatting
- Use navigation components for consistent site navigation
