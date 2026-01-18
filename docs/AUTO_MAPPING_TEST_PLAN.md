# Auto-Mapping for Multi-Schema Derived Datasets - Test Plan

## Overview

This test plan covers the new auto-mapping feature that allows derived datasets (created via joins) to support multiple schema views with automatically generated column mappings.

## Feature Summary

**What's New:**
- Derived datasets can now be viewed through multiple schema lenses (e.g., hierarchy + tabular)
- Column mappings are automatically generated based on source bundle schemas
- SAP Functional Locations sample dataset now uses Hierarchy schema with Tabular fallback

**Key Components:**
1. `generateDerivedMappings()` - Auto-generates column mappings for derived datasets
2. Updated `materializeVirtualBundle()` - Uses auto-mapping when schemas provided
3. Updated `JoinBuilder` - Generates mappingsBySchema when creating joins
4. Updated SAP sample loader - FLOC dataset now uses hierarchy schema

## Test Scenarios

### Test 1: Load SAP Sample Data with Hierarchy Schema

**Goal:** Verify SAP Functional Locations loads with hierarchy schema and multi-view support

**Steps:**
1. Navigate to **Relationships → Data Joins**
2. Click **"Load Sample Data"** button
3. Confirm sample data loading dialog
4. Choose to auto-create the sample join (click OK)

**Expected Results:**
- ✓ Two datasets created:
  - "SAP Functional Locations" (30 locations)
  - "SAP Equipment Assets" (43 equipment items)
- ✓ FLOC dataset shows badge: "+1 view" (hierarchy + tabular)
- ✓ Join created: "Equipment by Location"
- ✓ Virtual bundle created: "Equipment by Location (Derived)"

**Verification Points:**
- Check BundleManager shows FLOC with "+1 view" badge
- Primary schema should be "Hierarchy"
- Additional schema should be "Tabular"

---

### Test 2: View FLOC Dataset as Hierarchy

**Goal:** Verify FLOC dataset can be viewed as a hierarchy tree

**Steps:**
1. Navigate to **Datasets**
2. Click on "SAP Functional Locations"
3. Verify default view is "Hierarchy"
4. Observe the hierarchy visualization

**Expected Results:**
- ✓ Tree structure displayed showing:
  - FF-CORP (root)
    - Regional nodes (Northeast, Southeast, Midwest, West)
      - Store locations under each region
        - Area nodes (Kitchen, Front of House, Storage, Walk-in Cooler)
- ✓ Nodes are labeled with FLOC_NAME
- ✓ Hierarchy is properly structured with parent-child relationships

**Verification Points:**
- `node_id` mapped to FLOC_ID
- `node_label` mapped to FLOC_NAME
- `parent_id` mapped to PARENT_FLOC

---

### Test 3: View FLOC Dataset as Tabular

**Goal:** Verify FLOC dataset can be switched to tabular view

**Steps:**
1. While viewing "SAP Functional Locations"
2. Look for schema selector dropdown (should show "View as: Hierarchy")
3. Change to "Tabular" view

**Expected Results:**
- ✓ Schema selector shows both "Hierarchy" and "Tabular" options
- ✓ Switching to Tabular shows data profiling view
- ✓ Columns displayed include:
  - FLOC_ID (row identifier)
  - FLOC_TYPE (category)
  - REGION (category)
  - STATUS (category)
  - FLOC_NAME (text)
  - PARENT_FLOC (text)
- ✓ Column profiles show statistics (null counts, unique counts, top values)

**Verification Points:**
- Mappings correctly reference tabular schema roles
- Data quality metrics are calculated
- Can switch back and forth between views seamlessly

---

### Test 4: Create Join Between Hierarchy and Tabular

**Goal:** Verify joining hierarchy (FLOC) with tabular (Equipment) works correctly

**Steps:**
1. Navigate to **Relationships → Data Joins**
2. Check that auto-created join exists: "Equipment by Location"
3. Verify join configuration:
   - Left: SAP Functional Locations
   - Right: SAP Equipment Assets
   - Type: Left Join
   - Condition: node_id = text (FLOC_ID = FUNCTIONAL_LOCATION)

**Expected Results:**
- ✓ Join listed in joins panel
- ✓ Shows both source bundles with row counts
- ✓ Join condition displayed correctly
- ✓ Derived dataset "Equipment by Location (Derived)" is listed

**Verification Points:**
- Left bundle shows hierarchy schema
- Right bundle shows tabular schema
- Join condition uses proper role IDs

---

### Test 5: View Derived Dataset as Tabular

**Goal:** Verify derived dataset can be viewed with auto-generated tabular mappings

**Steps:**
1. Navigate to **Datasets** or use Explorer
2. Select "Equipment by Location (Derived)"
3. Default view should be Tabular
4. Examine the data

**Expected Results:**
- ✓ Join result shows combined data with prefixed columns:
  - `left_FLOC_ID`, `left_FLOC_NAME`, `left_PARENT_FLOC`, etc.
  - `right_EQUIPMENT_ID`, `right_EQUIPMENT_NAME`, etc.
- ✓ All columns are mapped to appropriate tabular roles
- ✓ Display names show "Left: [field]" and "Right: [field]" prefixes
- ✓ Left join shows all 30 locations, with equipment where available
- ✓ Some locations show NULL values for equipment (no equipment assigned)

**Verification Points:**
- Auto-generated mappings exist in `mappingsBySchema`
- Both left and right columns are included
- Data profiling works on all columns
- Null handling is correct for left join

---

### Test 6: View Derived Dataset as Hierarchy (if supported)

**Goal:** Verify derived dataset can be viewed as hierarchy if selected

**Steps:**
1. While viewing "Equipment by Location (Derived)"
2. Check if schema selector shows hierarchy option
3. If available, switch to hierarchy view

**Expected Results (if hierarchy schema selected during join creation):**
- ✓ Schema selector shows "Hierarchy" option
- ✓ Switching to hierarchy shows tree structure based on left bundle
- ✓ Hierarchy uses `left_FLOC_ID`, `left_FLOC_NAME`, `left_PARENT_FLOC`
- ✓ Tree structure preserved from source FLOC hierarchy
- ✓ Equipment data attached as additional context (not affecting hierarchy structure)

**Note:** This requires selecting Hierarchy schema when creating the join in JoinBuilder.

**Verification Points:**
- Auto-generated hierarchy mappings use left-prefixed columns
- Tree structure matches original FLOC hierarchy
- Additional equipment columns available but don't break hierarchy

---

### Test 7: Manually Create Join with Multiple Schemas

**Goal:** Verify JoinBuilder supports selecting multiple schemas

**Steps:**
1. Navigate to **Relationships → Data Joins**
2. Click **"New Join"**
3. Select left bundle: "SAP Functional Locations"
4. Select right bundle: "SAP Equipment Assets"
5. Look for schema selection checkboxes
6. Select both "Hierarchy" and "Tabular" schemas
7. Configure join condition: node_id = text
8. Set join type to "Left"
9. Create join

**Expected Results:**
- ✓ Schema selection UI shows available schemas from both bundles
- ✓ Can select multiple schemas
- ✓ Primary schema is the first selected
- ✓ Additional schemas listed in virtual bundle
- ✓ Auto-generated mappings created for all selected schemas
- ✓ New virtual bundle has both hierarchy and tabular views available

**Verification Points:**
- `selectedSchemaIds` state managed correctly
- `generateDerivedMappings()` called with selected schemas
- Virtual bundle has `additionalSchemaIds` property
- `mappingsBySchema` contains entries for each schema

---

### Test 8: Test Join Preview (optional)

**Goal:** Verify join preview shows correct statistics

**Steps:**
1. In JoinBuilder, configure a join
2. Click **"Test Join"** button
3. Review preview statistics

**Expected Results:**
- ✓ Preview shows:
  - Left rows: 30 (all FLOC locations)
  - Right rows: 43 (all equipment)
  - Result rows: ~30-73 (depending on join type)
  - Matched left rows: number of locations with equipment
  - Matched right rows: number of equipment with valid locations
- ✓ Sample rows displayed with prefixed columns
- ✓ Can see actual data before creating join

**Verification Points:**
- Join execution works correctly
- Statistics are accurate
- Sample data shows prefix pattern (left_*, right_*)

---

### Test 9: Data Quality and Edge Cases

**Goal:** Verify edge cases and data quality

**Test Cases:**

**9a. Empty Join Results**
- Create join with impossible condition
- Verify empty result handled gracefully
- Check UI shows appropriate message

**9b. All NULL Right Side (Left Join)**
- Examine locations with no equipment
- Verify right-side columns are NULL
- Verify data profiling handles NULLs correctly

**9c. Schema Switching Performance**
- Switch between schemas multiple times rapidly
- Verify no lag or errors
- Check data remains consistent

**9d. Large Result Sets (if available)**
- Test with larger datasets if available
- Monitor performance
- Check visualization rendering time

---

### Test 10: Persistence and Reload

**Goal:** Verify state persists across page reloads

**Steps:**
1. Complete tests 1-7
2. Refresh the browser page
3. Re-examine all datasets and joins

**Expected Results:**
- ✓ All datasets persist (FLOC, Equipment, Derived)
- ✓ Multi-schema configurations persist
- ✓ Joins persist with correct configurations
- ✓ Virtual bundles persist with mappingsBySchema
- ✓ Can still switch between schema views
- ✓ Data remains accurate after reload

**Verification Points:**
- localStorage contains complete state
- Schemas properly restored
- Mappings properly restored
- No data loss or corruption

---

## Known Limitations

1. **Multi-join virtual bundles not supported yet** - Only single-join derived datasets currently work
2. **Hierarchy auto-mapping assumes left bundle is hierarchical** - Right bundle hierarchy not currently supported
3. **No manual editing of auto-generated mappings** - Mappings are read-only once generated

## Success Criteria

For this feature to be considered complete and working:

- ✅ All 10 test scenarios pass without errors
- ✅ Auto-mapping generates correct mappings for both hierarchy and tabular schemas
- ✅ SAP sample data loads with hierarchy schema
- ✅ Derived datasets can be viewed through multiple schema lenses
- ✅ Join execution produces correct results
- ✅ UI responds correctly to schema switching
- ✅ Data persists across reloads
- ✅ No TypeScript compilation errors
- ✅ No console errors during testing

## Regression Tests

Ensure existing functionality still works:

- ✓ Creating regular (non-derived) datasets with single schema
- ✓ Tabular-only joins still work
- ✓ Network, Timeline, and other schema types unaffected
- ✓ Data profiling works as before
- ✓ Export functionality (if implemented)

## Testing Checklist

- [ ] Test 1: Load SAP sample data
- [ ] Test 2: View FLOC as hierarchy
- [ ] Test 3: View FLOC as tabular
- [ ] Test 4: Verify join configuration
- [ ] Test 5: View derived dataset as tabular
- [ ] Test 6: View derived dataset as hierarchy
- [ ] Test 7: Manual join with multiple schemas
- [ ] Test 8: Join preview
- [ ] Test 9: Edge cases and data quality
- [ ] Test 10: Persistence and reload
- [ ] Regression: Existing features work
- [ ] No console errors
- [ ] Performance acceptable

---

## Troubleshooting

**If FLOC dataset doesn't show "+1 view" badge:**
- Check that `additionalSchemaIds` is set in bundle
- Verify `mappingsBySchema` contains both hierarchy and tabular entries
- Check BundleManager.tsx renders the badge correctly

**If hierarchy view doesn't work:**
- Verify mappings include `node_id`, `node_label`, `parent_id`
- Check that PARENT_FLOC contains valid references or NULL for root
- Ensure HierarchyExplorer handles the data correctly

**If auto-mapping doesn't generate:**
- Check that schemas parameter is passed to `materializeVirtualBundle`
- Verify `generateDerivedMappings` is called in JoinBuilder
- Check console for any errors during mapping generation

**If join condition fails:**
- Verify role IDs are correct (node_id vs row_id vs text)
- Check that FUNCTIONAL_LOCATION column exists in Equipment dataset
- Ensure getMappedColumn finds the correct source columns

---

*Generated: 2026-01-18*
*Feature: Auto-mapping for multi-schema derived datasets*
*Version: 0.5.0*
