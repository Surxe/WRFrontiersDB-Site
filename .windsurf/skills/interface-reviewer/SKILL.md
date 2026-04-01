---
name: interface-reviewer
description: Guided review process for comparing TypeScript interfaces against WRFrontiersDB-Data structure using AI analysis
---

# Interface-Data Reviewer for WRFrontiersDB-Site

This skill provides a guided review process for comparing TypeScript interfaces against WRFrontiersDB-Data structure using language model analysis rather than automated testing.

## Prerequisites
- Node.js and npm installed
- WRFrontiersDB-Data repository available
- TypeScript interfaces defined in src/types/

## Related Skills

### interface-data-validator
For precise, data-driven validation of missing attributes, use the **interface-data-validator** skill. It provides:
- Exact missing attribute counts and percentages
- Support for nested attribute paths (e.g., `"module_scalars.primary_stat_ref"`)
- File line number references for missing objects
- Command-line tool for quick validation

**When to use interface-data-validator:**
- Need exact counts of missing attributes
- Checking specific nested attribute paths
- Want file references with line numbers
- Quick validation of specific fields

**When to use interface-reviewer:**
- Comprehensive design discussion
- Understanding field purpose and relationships
- Reviewing overall interface architecture
- Deciding on optional vs required patterns

## Review Process

### 1. Load Interface and Data
```bash
# Load interface definitions and data samples from current directory
# Reads interfaces from src/types/ and data from WRFrontiersDB-Data/current/Objects/
```

### Interface to Data File Mappings

**Important:** Each interface in `src/types/` maps to a specific data file in `WRFrontiersDB-Data/current/Objects/`:

| Interface | Data File | Example |
|-----------|-----------|---------|
| `PilotTalentType` | `PilotTalentType.json` | `src/types/pilot.ts` → `Objects/PilotTalentType.json` |
| `PilotPersonality` | `PilotPersonality.json` | `src/types/pilot.ts` → `Objects/PilotPersonality.json` |
| `PilotClass` | `PilotClass.json` | `src/types/pilot.ts` → `Objects/PilotClass.json` |
| `PilotTalent` | `PilotTalent.json` | `src/types/pilot.ts` → `Objects/PilotTalent.json` |
| `Pilot` | `Pilot.json` | `src/types/pilot.ts` → `Objects/Pilot.json` |
| `PilotType` | `PilotType.json` | `src/types/pilot.ts` → `Objects/PilotType.json` |
| `Module` | `Module.json` | `src/types/module.ts` → `Objects/Module.json` |
| `ModuleStat` | `ModuleStat.json` | `src/types/module.ts` → `Objects/ModuleStat.json` |
| `ModuleCategory` | `ModuleCategory.json` | `src/types/module.ts` → `Objects/ModuleCategory.json` |
| `ModuleType` | `ModuleType.json` | `src/types/module.ts` → `Objects/ModuleType.json` |
| `ModuleRarity` | `ModuleRarity.json` | `src/types/module.ts` → `Objects/ModuleRarity.json` |
| `Rarity` | `Rarity.json` | `src/types/rarity.ts` → `Objects/Rarity.json` |

**Key Point:** The `PilotTalentType` interface maps to `PilotTalentType.json`, NOT `Pilot.json`. Each interface typically maps to a data file with the same name as the interface.

### 2. AI-Powered Analysis
```bash
# Analyze patterns and identify discrepancies using language model reasoning
# Compare interface fields against actual data structure from WRFrontiersDB-Data/current/
```

### 3. Guided Review Discussion
```bash
# Present findings as discussion points and questions
# Include file links when referencing missing attributes or data samples
```

## TODO Field Handling

**Fields marked with `// TODO` comments are completely skipped during analysis:**
- Never analyzed or questioned
- Respected as work-in-progress
- Only fully implemented fields are reviewed
- **Not mentioned in output** to reduce noise

## Correct Field Handling

**Fields that are correctly implemented are not mentioned in output:**
- Optional fields that are truly optional in data
- Required fields that are present in all data objects
- Fields with correct type definitions
- Well-aligned interface patterns
- **Focus only on problematic or suspicious fields**

## Review Focus Areas

### Interface Completeness
- **Fields in data but not interface**: Should these be added?
- **Fields in interface but not data**: Planned for future use?
- **Optional vs required patterns**: Consistent with actual usage?

### Design Considerations
- **Field purpose**: What does each field represent in the domain?
- **Data consistency**: How do fields behave across different objects?
- **Usage patterns**: Are fields truly optional or always present?
- **Future planning**: What fields might be needed as the project grows?

### Contextual Analysis
- **Semantic understanding**: What do field names suggest about their purpose?
- **Relationship patterns**: How do related fields work together?
- **Type consistency**: Are field types appropriate for the data?
- **Business logic**: Do interfaces reflect the domain model correctly?

## Review Questions (Not Assertions)

The skill will ask questions like:

### Missing Fields
> "I notice field 'has_extended_bio' appears in PilotType objects but isn't in the PilotType interface. See data samples in `WRFrontiersDB-Data/current/Objects/PilotType.json` [line 23]. Should this be added as an optional field, or is this intentional?"

### Optional Field Patterns
> "Field 'module_tags_refs' in Module interface is marked optional but appears in 95% of modules. Based on the 100% presence rule, this should be required since nearly all modules have this field. Data examples: `WRFrontiersDB-Data/current/Objects/Module.json` [lines 13-15, 573-576]"

### Interface-Only Fields
> "PilotType interface has field 'sort_order' but this field is not found in any PilotType.json data samples. Is this planned for future use or should be removed? Data file: `WRFrontiersDB-Data/current/Objects/PilotType.json`"

### Type Considerations
> "Field 'character_module_mounts' in Module interface is defined as an array of objects with specific structure. Does this match how the data is actually used? Data examples: `WRFrontiersDB-Data/current/Objects/Module.json` [lines 7-12]"

## Analysis Summary Format

### Focus on Problematic Fields Only
**Only report fields that are incorrect or suspicious:**
- **Missing from interface**: Fields present in data but completely absent from interface
- **Incorrect optional/required**: Fields marked optional but appear in 100% of data, or vice versa
- **Interface-only unused fields**: Fields in interface but never found in data samples
- **Type mismatches**: Fields with incorrect type definitions

### Suspicious Patterns
- **High-frequency optional fields**: Fields marked optional but appear in >95% of data objects
- **Never-used interface fields**: Fields defined but never found in any data samples
- **Inconsistent patterns**: Fields that behave differently than expected across data objects

## Expected Outcomes

### Better Interface Design
- **Thoughtful decisions**: Based on actual data patterns
- **Contextual understanding**: Considering domain and usage
- **Future planning**: Anticipating data structure evolution

### Development Process Support
- **Incremental friendly**: Respects TODO fields and partial implementation
- **Human-in-the-loop**: AI assists, human decides
- **Design-focused**: Encourages thoughtful interface architecture

### Quality Improvement
- **Data-aligned**: Interfaces reflect actual data structure
- **Consistent patterns**: Optional/required fields match usage
- **Complete coverage**: All relevant data fields considered

## Success Criteria
- ✅ **Focused output**: Only incorrect or suspicious fields reported
- ✅ **No TODO noise**: Work-in-progress fields completely ignored
- ✅ **No correct field noise**: Well-implemented fields not mentioned
- ✅ **Actionable insights**: Clear guidance for problematic areas
- ✅ **Efficient review**: Minimal output for maximum impact

## Usage Notes

### When to Use
- After adding new fields to interfaces
- When data structure changes are detected
- During interface refactoring
- Before major releases to ensure completeness

### Combined Workflow Example

**Step 1: Quick Validation with interface-data-validator**
```bash
# Check for missing required fields
node .windsurf/skills/interface-data-validator/validate.cjs Module faction_ref

# Check nested attribute presence
node .windsurf/skills/interface-data-validator/validate.cjs Module "module_scalars.primary_stat_ref"
```

**Step 2: Comprehensive Review with interface-reviewer**
- Use the quantitative data from interface-data-validator to inform the qualitative review
- Discuss design implications of missing/present field patterns
- Make decisions about optional vs required field status

**Step 3: Iterative Improvement**
- Update interfaces based on findings
- Re-run interface-data-validator to verify changes
- Use interface-reviewer for final design validation

### How to Interpret
- **Questions focus on problems**: Only incorrect or suspicious patterns are highlighted
- **TODO fields are invisible**: Never mentioned or analyzed
- **Correct fields are invisible**: Well-implemented patterns not mentioned
- **Human judgment**: AI provides targeted analysis, you make decisions

### Follow-up Actions
- **Address reported issues**: Focus only on the problematic fields identified
- **Update interfaces**: Make informed decisions about incorrect fields
- **Document decisions**: Note why certain changes were made
- **Iterate**: Re-run review to verify fixes
