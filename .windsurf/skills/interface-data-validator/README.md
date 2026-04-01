# Interface Data Validator

A tool for validating TypeScript interfaces against WRFrontiersDB-Data structure to identify missing attributes and answer data completeness questions.

## Quick Start

```bash
# Check if any Module objects are missing the 'faction_ref' attribute
node validate.ts Module faction_ref

# Check nested attributes
node validate.ts Module "module_scalars.primary_stat_ref"

# Check array element attributes
node validate.ts Module "character_module_mounts.0.mount"

# Generate comprehensive report
node validate.ts Module report
```

## Available Commands

### 1. Missing Attribute Check
Check if any objects are missing a specific attribute:

```bash
node validate.ts <objectType> <attributePath>
```

**Examples:**
```bash
# Simple attribute
node validate.ts Module faction_ref

# Nested attribute
node validate.ts Module "module_scalars.primary_stat_ref"

# Array element attribute
node validate.ts Module "character_module_mounts.0.mount"

# Deep nested path
node validate.ts Module "module_scalars.levels.variables.0.upgrade_cost_ref"
```

### 2. Interface Completeness Report
Generate a comprehensive report comparing interface fields to actual data:

```bash
node validate.ts <objectType> report
```

**Example:**
```bash
node validate.ts Module report
```

## Output Examples

### Missing Attribute Report
```
🔍 ATTRIBUTE ANALYSIS: module_scalars.primary_stat_ref

**Presence**: 138/150 objects (92.0%)
**Missing Objects**: 12 objects
**Missing Percentage**: 8.0%

**Missing Object IDs**:
- DA_Module_Ability_AmmoGenerator.1
- DA_Module_Passive_ShieldBoost.2
- ...

**File References**:
WRFrontiersDB-Data/current/Objects/Module.json
Lines: 45, 67, 89, 123, 156

**Analysis**: This attribute appears in nearly all objects. Consider making it required in the interface.
```

### Interface Completeness Report
```
📋 INTERFACE COMPLETENESS REPORT: Module

**Total Objects**: 150
**Interface Fields**: 15

✅ **id** (required): Present in all objects
✅ **inventory_icon_path** (required): Present in all objects
🔹 **production_status** (optional): 68/150 objects (45.3%)
🔹 **module_tags_refs** (optional): 147/150 objects (98.0%)
   Missing from: module_1, module_2, module_3, module_4, module_5...

⚠️  **Extra Fields in Data**: internal_field, deprecated_property
```

## Supported Object Types

- `Module` - Module objects and their properties
- `Pilot` - Pilot objects and their properties  
- `PilotClass` - Pilot class definitions
- `PilotPersonality` - Pilot personality traits
- And more from `src/types/`

## Attribute Path Syntax

### Simple Attributes
```
faction_ref
name
description
```

### Nested Object Attributes
```
module_scalars.primary_stat_ref
module_scalars.levels.constants
```

### Array Element Attributes
```
character_module_mounts.0.mount
character_module_mounts.0.character_module_ref
module_scalars.levels.variables.0.upgrade_cost_ref
```

### Complex Nested Paths
```
module_scalars.levels.variables.0.scrap_rewards_refs.0
```

## Use Cases

### Before Interface Changes
```bash
# Check if new field exists in data before adding to interface
node validate.ts Module new_field_name
```

### After Data Updates
```bash
# Verify data completeness after adding new objects
node validate.ts Module report
```

### Debugging Missing Data
```bash
# Find objects missing required fields
node validate.ts Module required_field_name
```

### Interface Maintenance
```bash
# Review optional vs required field usage
node validate.ts Module report
```

## File Locations

The tool expects:
- **TypeScript interfaces**: `src/types/<ObjectType>.ts`
- **Data files**: `WRFrontiersDB-Data/current/Objects/<ObjectType>.json`

## Error Handling

- Graceful handling of missing files
- Clear error messages for invalid attribute paths
- Safe traversal of nested structures
- Detailed reporting of parsing errors

## Performance

- Efficient streaming for large JSON files
- Memory-conscious processing
- Fast attribute path resolution
- Caching for repeated operations

## Integration with Tests

This tool complements the existing test suite in `tests/ts_types/` by providing:
- Interactive validation capabilities
- Detailed missing object identification
- File line number references
- Comprehensive reporting

## Tips

1. **Use quotes for nested paths**: `"module_scalars.primary_stat_ref"`
2. **Check array indices**: Use `0` for first element, `1` for second, etc.
3. **Generate reports first**: Use `report` command to see all fields
4. **Verify data structure**: Check simple attributes before nested ones
5. **Review analysis**: The tool provides recommendations based on usage patterns
