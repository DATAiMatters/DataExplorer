# Sample Datasets Summary

## What Was Added

Two realistic SAP PM (Plant Maintenance) datasets have been added to the Data Explorer app to demonstrate the join functionality.

## Datasets

### 1. Fast Food Functional Locations
**File:** `public/samples/joins/fast-food-functional-locations.csv`

- **Records:** 30 functional locations
- **Structure:** Hierarchical (Corporate → Region → Store → Area)
- **Scenario:** "FastBite" fast food restaurant chain
- **Regions:** Northeast, Southeast, Midwest, West
- **Stores:** 10 locations (Manhattan, Brooklyn, Boston, Philadelphia, Miami Beach, Atlanta, Charlotte, Chicago, Detroit, Minneapolis, Los Angeles, San Francisco, Seattle)
- **Store Types:** Standard, Express, Premium

**Key Fields:**
- `FLOC_ID` - Unique identifier (e.g., FF-NE-001)
- `FLOC_NAME` - Location name
- `PARENT_FLOC` - Parent location for hierarchy
- `FLOC_TYPE` - Type: REGION, STORE, AREA
- `REGION` - Geographic region
- `STATUS` - Active/Inactive

### 2. Fast Food Equipment Assets
**File:** `public/samples/joins/fast-food-equipment-assets.csv`

- **Records:** 43 equipment items
- **Equipment Types:** Fryers, Griddles, Refrigeration, Ice Makers, Soft Serve Machines, POS Terminals, Beverage Dispensers
- **Manufacturers:** Pitco, Frymaster, Vulcan, Kolpak, Manitowoc, Scotsman, Taylor, NCR, Cornelius, True
- **Status Variety:** Operational (most), Down (2), Maintenance (1)

**Key Fields:**
- `EQUIPMENT_ID` - Unique identifier (e.g., EQ-001234)
- `EQUIPMENT_NAME` - Descriptive name
- `FUNCTIONAL_LOCATION` - **Join key** to FLOC_ID
- `EQUIPMENT_TYPE` - Category
- `MANUFACTURER` - Brand
- `STATUS` - Operational/Down/Maintenance
- `CRITICALITY` - Critical/High/Medium
- `ACQUISITION_COST` - Purchase price ($1,800 - $15,800)
- `LAST_MAINTENANCE` - Last service date
- `NEXT_MAINTENANCE_DUE` - Next service date

## Join Relationship

**Primary Join:**
```
Left: SAP Functional Locations (FLOC_ID)
Right: SAP Equipment Assets (FUNCTIONAL_LOCATION)
Join Type: Any (inner, left, right, full)
```

**Expected Results:**
- **Inner Join:** ~43 rows (all equipment with valid locations)
- **Left Join:** 30 rows (all FLOCs, equipment where available)
- **Right Join:** 43 rows (all equipment, location info where available)
- **Full Outer:** ~73 rows (all FLOCs + all equipment, matched where possible)

## How to Use

### Quick Load (Recommended)
1. Navigate to **Relationships → Data Joins** tab
2. Click **"Load Sample Data"** button
3. Two bundles are created automatically:
   - "SAP Functional Locations"
   - "SAP Equipment Assets"
4. Click **"New Join"** to create a join between them

### Manual Load
1. Navigate to **Data Bundles**
2. Upload each CSV file separately
3. Select "Tabular" schema
4. Map columns as needed

## Use Cases

### 1. Equipment Inventory by Location
**Join Type:** Left Join (FLOC left)
**Purpose:** See which locations have what equipment
**Insights:**
- Which stores lack certain equipment types?
- Equipment distribution across regions
- Total equipment value per location

### 2. Equipment Without Valid Locations
**Join Type:** Right Join or Full Outer
**Purpose:** Data quality check - find orphaned equipment
**Insights:**
- Equipment with invalid location references
- Records needing cleanup

### 3. Complete Asset Register
**Join Type:** Inner Join
**Purpose:** Full equipment inventory with location context
**Insights:**
- Equipment maintenance schedules by region
- Equipment criticality mapping
- Asset value distribution

### 4. Maintenance Planning
**Join Type:** Inner Join + Filtering
**Purpose:** Plan maintenance activities with location context
**Insights:**
- Equipment due for maintenance at specific stores
- Regional maintenance scheduling
- Critical equipment requiring attention

## Data Quality Features

The datasets include realistic scenarios:
- **Equipment concentration:** Premium stores have more equipment
- **Status variety:** Most operational, some down or in maintenance
- **Maintenance schedules:** Realistic quarterly intervals
- **Cost range:** $1,800 (beverage dispensers) to $15,800 (large coolers)
- **Criticality levels:** Walk-in coolers marked Critical, fryers/POS as High

## SAP PM Context

These datasets simulate standard SAP PM module structure:
- **FLOC** = Functional Location (tables: IFLOT, IFLOTX)
- **Equipment** = Equipment Master (tables: EQUI, EQKT)
- **Relationship** = TPLNR field linking equipment to FLOC

This structure is used in:
- Manufacturing plants
- Facility management
- Retail chains
- Food service operations
- Distributed asset management

## Documentation Files

1. **Sample Data README** - `/public/samples/joins/README.md`
   - Comprehensive dataset documentation
   - Field descriptions
   - Use cases and examples
   - Tips for exploration

2. **User Guide** - `/docs/USER_GUIDE_JOINS.md`
   - Quick start section with sample data
   - Step-by-step join creation
   - Join types explained
   - Troubleshooting

3. **Feature Documentation** - `/docs/LINEAGE_FEATURE.md`
   - Technical overview
   - Sample datasets section added
   - Feature roadmap

## Implementation Details

### Load Sample Data Button
**Location:** `src/components/app/JoinsManager.tsx`

**Functionality:**
- Fetches CSV files from `/samples/joins/` directory
- Parses CSV data using Papaparse
- Creates DataBundle objects with proper mappings
- Adds bundles to Zustand store
- Checks for duplicates (prevents re-loading)
- Shows success/error alerts

**Mappings:**
- FLOC bundle maps to tabular schema (row_id, category, text roles)
- Equipment bundle maps to tabular schema (row_id, category, text, measure roles)
- Pre-configured for immediate use

## Testing the Feature

1. **Load the data:**
   ```
   Click "Load Sample Data" in Data Joins tab
   ```

2. **Create an inner join:**
   ```
   Left: SAP Functional Locations
   Right: SAP Equipment Assets
   Condition: FLOC_ID = FUNCTIONAL_LOCATION
   Type: Inner Join
   ```

3. **Test the join:**
   ```
   Click "Test Join" to see statistics
   Expected: 43 result rows, high match rate
   ```

4. **Create and explore:**
   ```
   Click "Create Join"
   Virtual bundle is created automatically
   Click "View" to see joined data
   ```

5. **Try different join types:**
   ```
   Left Join: See which FLOCs have no equipment
   Right Join: See orphaned equipment (none expected)
   Full Outer: Complete view of all records
   ```

## Future Enhancements

These datasets can be extended with:
- Maintenance order history
- Equipment downtime tracking
- Parts inventory
- Labor hours and costs
- Performance metrics (OEE, MTBF, MTTR)
- Preventive maintenance plans
- Equipment Bills of Materials

## Commits

**Commit 1 (cc7ebd9):** Add SAP sample datasets for join feature with load button
- Created two CSV files with realistic data
- Implemented "Load Sample Data" button
- Added comprehensive README

**Commit 2 (f435716):** Update documentation with sample dataset information
- Updated USER_GUIDE_JOINS.md with Quick Start section
- Updated LINEAGE_FEATURE.md with Sample Datasets section
- Added links to sample data documentation

## Files Changed

```
New Files:
- public/samples/joins/fast-food-functional-locations.csv
- public/samples/joins/fast-food-equipment-assets.csv
- public/samples/joins/README.md
- docs/SAMPLE_DATASETS_SUMMARY.md (this file)

Modified Files:
- src/components/app/JoinsManager.tsx (added load sample data functionality)
- docs/USER_GUIDE_JOINS.md (added Quick Start section)
- docs/LINEAGE_FEATURE.md (added Sample Datasets section)
```

## Summary

The sample datasets provide a complete, realistic example of SAP PM data that demonstrates:
- Hierarchical functional locations
- Equipment assets with location references
- Join relationships
- Data quality scenarios
- Real-world use cases

Users can now:
1. Click one button to load sample data
2. Immediately create joins
3. Explore join results
4. Understand join types through realistic examples
5. Learn the join feature without preparing their own data

This significantly lowers the barrier to entry for trying the join functionality and provides a concrete example of SAP PM data integration patterns.
