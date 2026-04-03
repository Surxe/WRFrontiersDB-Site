---
name: interface-data-validator
description: Validates TypeScript interfaces against WRFrontiersDB-Data structure to find missing attributes and answer data completeness questions
---

# Interface-Data Validator for WRFrontiersDB-Site

This skill validates TypeScript interfaces against WRFrontiersDB-Data structure to identify missing attributes and answer data completeness questions with nested attribute support.

## Prerequisites

- Node.js and npm installed
- WRFrontiersDB-Data repository available
- TypeScript interfaces defined in src/types/

## Available Commands

### 1. Check Missing Attributes

```bash
# Given interface attribute A, is there any object in the Data that is missing it?
# Supports nested attributes using dot notation (e.g., "module_scalars.primary_stat_ref")
```

### 2. Attribute Presence Analysis

```bash
# Analyze presence frequency of any attribute across all objects
# Returns: count, percentage, and list of objects missing the attribute
```

### 3. Nested Attribute Validation

```bash
# Validate nested object structures and array element attributes
# Supports deep nesting like "module_scalars.levels.variables.0.upgrade_cost_ref"
```

### 4. Interface Completeness Report

```bash
# Generate comprehensive report comparing interface fields to actual data
# Identifies missing fields, extra fields, and optional vs required mismatches
```

## Analysis Process

### Step 1: Load Interface and Data

- Reads interface definitions from `src/types/`
- Loads actual data from `WRFrontiersDB-Data/current/Objects/`
- Parses nested structure definitions

### Step 2: Attribute Path Resolution

- Converts attribute paths (e.g., "module_scalars.primary_stat_ref") to traversal logic
- Handles array indices and object property access
- Supports optional chaining for nested structures

### Step 3: Data Scanning

- Iterates through all objects of specified type
- Checks for presence of specified attribute path
- Tracks missing objects and calculates statistics

### Step 4: Report Generation

- Provides detailed analysis with specific object references
- Includes file links and line numbers from data files
- Shows percentage breakdown and missing object IDs

## Query Examples

### Simple Attribute Check

> **Query**: "Check if any Module objects are missing the 'faction_ref' attribute"
> **Response**: "Found 3 out of 150 Module objects missing 'faction_ref': [IDs: 'module_1', 'module_2', 'module_3']. See `WRFrontiersDB-Data/current/Objects/Module.json` lines 45, 67, 89"

### Nested Attribute Check

> **Query**: "Are any Module objects missing 'module_scalars.primary_stat_ref'?"
> **Response**: "12 Module objects (8%) are missing 'module_scalars.primary_stat_ref'. This is expected behavior as not all modules have primary stats. Missing objects: [list of IDs]"

### Array Element Attribute Check

> **Query**: "Check for missing 'mount' attribute in character_module_mounts array elements"
> **Response**: "All character_module_mounts array elements have 'mount' attribute across all Module objects"

### Complex Nested Path

> **Query**: "Any objects missing 'module_scalars.levels.variables.0.upgrade_cost_ref'?"
> **Response**: "25 Module objects are missing this nested path because they don't have variables array in their levels structure"

## Output Format

### Missing Attribute Report

```
🔍 ATTRIBUTE ANALYSIS: module_scalars.primary_stat_ref

**Presence**: 138/150 objects (92%)
**Missing Objects**: 12 objects
**Missing Percentage**: 8%

**Missing Object IDs**:
- DA_Module_Ability_AmmoGenerator.1
- DA_Module_Passive_ShieldBoost.2
- [...]

**File References**:
WRFrontiersDB-Data/current/Objects/Module.json
Lines: 45, 67, 89, 123, 156

**Analysis**: This attribute is optional as expected. Missing objects are primarily ability modules that don't use primary stats.
```

### Complete Interface Report

```
📋 INTERFACE COMPLETENESS: Module

**Fields in Interface Only**: 2 fields
- abilities_scalars (TODO - work in progress)
- module_socket_type_refs (rarely used)

**Fields in Data Only**: 0 fields
- No extra fields detected

**Optional vs Required Analysis**:
- 3 fields marked optional but appear in >95% of objects (consider making required)
- 2 fields marked required but missing from some objects (consider making optional)

**Recommendations**:
1. Consider making 'module_tags_refs' required (98% presence)
2. Keep 'production_status' optional (45% presence)
```

## Technical Implementation

### Attribute Path Parsing

- Supports dot notation for nested access
- Handles array indices with numeric notation
- Optional chaining for safe traversal

### Data Loading Strategy

- Efficient streaming for large JSON files
- Caching for repeated queries
- Memory-conscious processing

### Error Handling

- Graceful handling of malformed paths
- Clear error messages for invalid attributes
- Fallback for missing data files

## Usage Guidelines

### When to Use

- After interface changes to validate data compatibility
- Before releases to ensure data completeness
- During development to understand data patterns
- When investigating specific attribute issues

### Query Tips

- Use exact attribute names from TypeScript interfaces
- Include full path for nested attributes
- Specify object type (Module, Pilot, etc.) in queries
- Use array indices when checking specific array elements

## Success Criteria

- ✅ Accurate missing attribute detection
- ✅ Comprehensive nested attribute support
- ✅ Clear, actionable reports with file references
- ✅ Efficient processing of large datasets
- ✅ Support for complex attribute path queries
