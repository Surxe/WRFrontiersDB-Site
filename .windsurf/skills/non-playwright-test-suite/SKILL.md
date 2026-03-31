---
name: non-playwright-test-suite
description: Run comprehensive test suite without browser automation, fixing simple issues and reporting complex ones
---

# Non-Browser Test Suite for WRFrontiersDB-Site

This skill runs a comprehensive test suite without browser automation, fixing simple issues automatically and reporting complex ones.

## Prerequisites
- Node.js and npm installed
- All dependencies available

## Testing Workflow

### 1. Quick Dev Server Check
```bash
# Start dev server briefly to check for immediate errors
timeout 5 npm run dev || true
```

### 2. Linting Check
```bash
npm run lint
```
**If lint errors occur**: Fix simple formatting issues automatically. For complex refactoring needs, report to user and end skill.

### 3. Code Formatting
```bash
npm run format:fix
```
**If formatting errors occur**: Auto-fix should handle most issues. Report any remaining manual formatting needs.

### 4. Test Suite Execution
```bash
npm run vitest
```
**If test failures occur**: Fix simple issues (missing imports, typos, assertion errors) automatically. For complex issues, report to user immediately.

### 6. Build Verification
```bash
npm run build
```
**If build errors/warnings occur**: Fix simple issues (missing dependencies, path issues) automatically. For complex issues, report to user immediately.

## Error Handling Strategy

**For all error conditions below: If its a simple fix, fix automatically. If complex, report to user and end skill early.**

### Automatic Fixes (Handle Without User Input):
- Missing semicolons, import statement issues, simple syntax errors
- Code formatting (spacing, quotes), missing dependencies
- Simple test assertion fixes

### Immediate User Reporting (End Skill Early):
- Multiple file refactoring needed, architecture changes or decisions required
- Complex build failures, test suite design issues
- Performance optimization needs

## Expected Results
- Dev server starts without immediate errors
- No linting warnings
- Code properly formatted
- All tests pass
- Build completes successfully

## Reporting Format for Complex Issues

When encountering complex issues requiring user input:

```
🚨 COMPLEX ISSUE DETECTED

**Issue Type**: [Brief description]
**Affected Files**: [List of files]
**Error Summary**: [What's happening]
**Recommended Solutions**:
1. [Option 1 - description]
2. [Option 2 - description]

**Impact**: [How this affects the site]
**Estimated Effort**: [Low/Medium/High]

Skill terminated early to await your decision.
```

## Success Criteria
- ✅ Dev server starts cleanly
- ✅ No linting errors
- ✅ Code properly formatted  
- ✅ All tests pass
- ✅ Build completes without errors

If any step fails with simple issues, this skill will attempt to fix them automatically. If complex issues are detected, it will report them immediately and terminate.
