# Export/Import System - Technical Documentation

> **Last Updated:** 2026-01-12

## Overview

Data Explorer supports full-fidelity export and import of all application state, including schemas, bundles with complete data, relationships, and AI settings. The system uses two different storage mechanisms with different constraints.

## Storage Mechanisms

### 1. localStorage Auto-Persist (Browser Constraint)

**What it is:**
- Automatic background saving to browser's localStorage
- Triggered on every state change
- Uses Zustand's persist middleware

**Browser Limitations:**
- **Hard limit:** 5-10MB per domain (browser enforced, cannot be changed)
- **Our truncation:** 5MB rawData, 10,000 rows parsedData
- **Purpose:** Keep app responsive with automatic persistence

**When it activates:**
- Every time you add/edit a bundle
- Every time you modify a schema
- Every time you change AI settings
- On page refresh (restores state)

**Implementation:**
- File: `src/store/index.ts`
- Function: `partialize()`
- Key: `data-explorer-storage`

### 2. Manual Export/Import (No Limits)

**What it is:**
- User-initiated JSON file download/upload
- Full-fidelity data preservation
- No truncation, no browser storage limits

**File Size:**
- **Export:** No limit (full data always)
- **Import:** 75MB soft warning (user can continue)
- **Purpose:** Complete backup/restore and data portability

**When to use:**
- Backing up your work
- Moving data between browsers
- Sharing configurations
- Archiving projects

**Implementation:**
- File: `src/store/index.ts`
- Functions: `exportConfig()`, `importConfig()`
- UI: `src/components/app/Sidebar.tsx`

## Export/Import Specification

### Export Format (v1.0)

```typescript
{
  "version": "1.0",
  "schemas": SemanticSchema[],
  "bundles": DataBundle[],        // FULL data included
  "relationshipTypeConfig": RelationshipTypeConfig,
  "aiSettings": AISettings        // API key stripped for security
}
```

### Full Export Contents

**Schemas:**
- All custom semantic schemas
- Roles and their configurations
- Validation rules
- Default schemas included

**Bundles:**
- Bundle metadata (id, name, created/updated timestamps)
- **Full source data:**
  - `rawData` - Complete original file contents (no truncation)
  - `parsedData` - All parsed rows (no truncation)
  - `columns` - Column names
  - `fileName` - Original file name
  - `type` - CSV or JSON
- Column mappings (role ID → source column)
- Schema references

**Relationships:**
- All relationship type definitions
- Colors, labels, descriptions
- Directionality settings

**AI Settings:**
- Provider configuration
- Endpoint URLs
- Model names
- Max token settings
- **API key:** Stripped on export for security

### Import Process

1. **File Selection:** User clicks Import button in Sidebar
2. **Size Warning:** If file > 75MB, show confirmation dialog
3. **Parse JSON:** Validate structure
4. **Set Import Flag:** `_importInProgress = true` to prevent truncation
5. **Restore Data:**
   - Schemas → `set({ schemas })`
   - Bundles → `set({ bundles })` (full data)
   - Relationships → `set({ relationshipTypeConfig })`
   - AI Settings → `set({ aiSettings })` (preserve current API key if not in import)
6. **Clear Flag:** After 100ms, `_importInProgress = false`
7. **Auto-Save:** localStorage persists the full imported data (within constraints)

## Security Features

### API Key Protection

**On Export:**
```typescript
aiSettings: {
  ...state.aiSettings,
  apiKey: '', // Always stripped
}
```

**On Import:**
```typescript
const currentKey = get().aiSettings.apiKey;
set({
  aiSettings: {
    ...config.aiSettings,
    apiKey: config.aiSettings.apiKey || currentKey, // Preserve current if not in import
  },
});
```

**Rationale:**
- Prevents accidental API key leakage in shared files
- Users must re-enter API keys after import
- Existing API key preserved if importing from file without key

### Large File Warning

Files over 75MB trigger a confirmation dialog:

```
Large file detected: 87.3MB. This may slow down your browser. Continue?
```

User can choose to:
- Continue (loads the file)
- Cancel (abort import)

## Technical Implementation

### Files Modified

1. **`src/store/index.ts`**
   - Added `_importInProgress` flag to interface
   - Rewrote `exportConfig()` for full-fidelity export
   - Rewrote `importConfig()` for complete restoration
   - Updated `partialize()` to respect import flag

2. **`src/components/app/Sidebar.tsx`**
   - Added 75MB file size warning
   - Import confirmation dialog

### Key Code Patterns

**Prevent Truncation During Import:**
```typescript
partialize: (state) => {
  // Don't truncate during import - preserve full data
  if (state._importInProgress) {
    return {
      schemas: state.schemas,
      bundles: state.bundles, // Full data
      relationshipTypeConfig: state.relationshipTypeConfig,
      aiSettings: state.aiSettings,
    };
  }

  // Normal auto-save truncation for localStorage
  return {
    // ... truncated data
  };
}
```

**Temporary Flag Pattern:**
```typescript
// Set flag before import
set({ _importInProgress: true });

// Import all data
set({ schemas, bundles, relationshipTypeConfig, aiSettings });

// Clear flag after persistence completes
setTimeout(() => set({ _importInProgress: false }), 100);
```

## Use Cases

### Backing Up Large Datasets

**Scenario:** User has 50MB of parsed hierarchy data

**Old behavior:**
- Export: Only schemas exported, bundles stripped
- Import: Had to re-upload all data files manually

**New behavior:**
- Export: Full 50MB+ JSON file with all data
- Import: Complete restoration, no re-upload needed

### Moving Between Browsers

**Scenario:** User works on Chrome at work, Firefox at home

**Process:**
1. Export config on Chrome (e.g., 25MB file)
2. Copy file to home computer
3. Import on Firefox
4. Everything restored (except API key for security)

### Sharing Configurations

**Scenario:** Team member wants to use the same schemas/relationships

**Process:**
1. Export config
2. Share JSON file (API keys already stripped)
3. Teammate imports
4. Schemas and relationships applied
5. Teammate enters their own API key

## Storage Limits Summary

| Storage Type | Raw Data | Parsed Rows | Import Size | Export Size |
|--------------|----------|-------------|-------------|-------------|
| **localStorage Auto-Save** | 5MB | 10,000 | N/A | N/A |
| **Manual Export** | N/A | N/A | N/A | Unlimited |
| **Manual Import** | Unlimited* | Unlimited* | 75MB warning | N/A |

\* Limited only by browser memory (hundreds of MB possible)

## Known Limitations

1. **localStorage quota:** If you exceed browser's localStorage limit (~5-10MB), auto-save will fail
2. **Browser memory:** Very large imports (>200MB) may cause browser slowdown
3. **No streaming:** Large files are loaded entirely into memory at once
4. **No compression:** JSON files are uncompressed (could use gzip in future)

## Troubleshooting

### "localStorage quota exceeded" error

**Cause:** Automatic persistence exceeded browser's 5-10MB limit

**Solutions:**
1. Delete old bundles you don't need
2. Use manual export to back up, then delete from app
3. Split data into multiple smaller bundles

### Import seems slow or browser freezes

**Cause:** Very large file (>100MB) being parsed

**Solutions:**
1. Wait for parsing to complete (may take 10-30 seconds)
2. Consider splitting data into smaller files
3. Close other browser tabs to free memory

### Data missing after import

**Cause:** Import may have failed silently

**Check:**
1. Open browser console (F12) for errors
2. Verify JSON file is valid (use JSONLint)
3. Check file wasn't truncated during transfer
4. Re-export and re-import to test

### API keys not preserved

**This is intentional:** API keys are stripped on export for security

**Solution:** Re-enter your API key after importing

## Version History

- **v1.0** (2026-01-12)
  - Full-fidelity export/import implemented
  - API key stripping for security
  - Import flag to prevent truncation
  - 75MB soft warning added
  - localStorage auto-persist optimized (5MB/10K rows)

---

**Status:** ✅ Complete - Full export/import system ready for production use.
