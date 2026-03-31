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

## Review Process

### 1. Load Interface and Data
```bash
# Load interface definitions and data samples from current directory
# Reads interfaces from src/types/ and data from WRFrontiersDB-Data/current/Objects/
```

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
- Clear note of which fields were excluded

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
> "I notice field 'faction_ref' appears in 85% of module objects but isn't in the Module interface. See data samples in `WRFrontiersDB-Data/current/Objects/Module.json` [line 45, 67, 89]. Should this be added as an optional field, or is this intentional?"

### Optional Field Patterns
> "Field 'module_tags_refs' is marked optional but appears in 95% of modules. Consider making it required, or keep it optional for edge cases? Data examples: `WRFrontiersDB-Data/current/Objects/Module.json` [lines 23-34, 56-78]"

### Extra Fields
> "Interface has field 'abilities_scalars' marked as TODO, but I see this field in some data objects. Is this planned for future implementation? Data examples: `WRFrontiersDB-Data/current/Objects/Module.json` [lines 102-145]"

### Type Considerations
> "Field 'character_module_mounts' is defined as an array of objects with specific structure. Does this match how the data is actually used? Data examples: `WRFrontiersDB-Data/current/Objects/Module.json` [lines 40-44]"

## Analysis Summary Format

### Fields in Interface Only
- **List**: Fields present in interface but not seen in data samples
- **Context**: Are these planned features or legacy fields?
- **Questions**: Should these be kept, modified, or removed?

### Fields in Data Only
- **List**: Fields present in data but not in interface
- **Frequency**: How often do these fields appear?
- **Questions**: Should these be added to interface, or are they internal data?
- **File references**: Include direct links to `WRFrontiersDB-Data/current/Objects/{Type}.json` with line numbers

### Optional vs Required Analysis
- **Patterns**: Fields marked optional vs actual presence
- **Recommendations**: Consider making fields required based on usage
- **Questions**: Are optional fields truly optional or just rarely used?

### TODO Fields Excluded
- **Clear list**: All fields skipped due to TODO markers
- **Respect**: No analysis attempted on work-in-progress fields
- **Focus**: Review concentrates on implemented fields only

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
- ✅ Useful guidance for interface maintenance
- ✅ Thoughtful questions about design decisions
- ✅ Clear analysis without automated assertions
- ✅ Respect for TODO fields and incremental development
- ✅ Actionable insights for interface improvements

## Usage Notes

### When to Use
- After adding new fields to interfaces
- When data structure changes are detected
- During interface refactoring
- Before major releases to ensure completeness

### How to Interpret
- **Questions are prompts**: Not requirements, but discussion points
- **Context matters**: Consider the domain and usage patterns
- **TODO fields are sacred**: Never modify TODO-marked fields
- **Human judgment**: AI provides analysis, you make decisions

### Follow-up Actions
- **Review questions**: Consider each question carefully
- **Update interfaces**: Make informed decisions about changes
- **Document decisions**: Note why certain fields are included/excluded
- **Iterate**: Re-run review after making changes
