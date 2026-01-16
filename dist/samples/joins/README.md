# SAP Sample Datasets for Join Testing

This directory contains two realistic SAP PM (Plant Maintenance) datasets designed for testing the join functionality in Data Explorer.

## Datasets

### 1. Fast Food Functional Locations (`fast-food-functional-locations.csv`)

**Description:** Hierarchical functional location (FLOC) structure for a fictional fast food restaurant chain called "FastBite".

**Structure:**
- **Corporate level:** FF-CORP (headquarters)
- **Regional level:** Northeast, Southeast, Midwest, West
- **Store level:** 10 individual restaurant locations across major US cities
- **Area level:** Kitchen, Front of House, Storage, Walk-in Cooler areas within stores

**Key Fields:**
- `FLOC_ID`: Unique functional location identifier (e.g., FF-NE-001)
- `FLOC_NAME`: Human-readable name
- `PARENT_FLOC`: Parent functional location for hierarchy
- `FLOC_TYPE`: Type (REGION, STORE, AREA)
- `REGION`: Geographic region
- `ADDRESS`, `CITY`, `STATE`, `ZIP_CODE`: Store location details
- `STORE_FORMAT`: Standard, Express, or Premium format
- `OPENING_DATE`: When the location opened
- `STATUS`: Active/Inactive status

**Total Records:** 30 functional locations

**Use Case:** Represents the "where" in asset management - the hierarchical structure of physical locations where equipment is installed.

---

### 2. Fast Food Equipment Assets (`fast-food-equipment-assets.csv`)

**Description:** Commercial kitchen and restaurant equipment installed at various FastBite locations, with references to functional locations.

**Equipment Types Included:**
- Commercial Fryers (Pitco, Frymaster)
- Commercial Griddles (Vulcan)
- Walk-in Coolers (Kolpak)
- Ice Machines (Manitowoc, Scotsman)
- Soft Serve Machines (Taylor)
- POS Terminals (NCR)
- Beverage Dispensers (Cornelius)
- Prep Table Refrigerators (True)

**Key Fields:**
- `EQUIPMENT_ID`: Unique equipment identifier (e.g., EQ-001234)
- `EQUIPMENT_NAME`: Descriptive name
- `FUNCTIONAL_LOCATION`: Reference to FLOC where installed (JOIN KEY)
- `EQUIPMENT_TYPE`: Category of equipment
- `MANUFACTURER`: Equipment manufacturer
- `MODEL_NUMBER`: Model identifier
- `SERIAL_NUMBER`: Serial number
- `INSTALL_DATE`: Installation date
- `WARRANTY_EXPIRY`: Warranty end date
- `STATUS`: Operational, Down, or Maintenance
- `ACQUISITION_COST`: Purchase price
- `CRITICALITY`: High, Medium, or Critical
- `LAST_MAINTENANCE`: Last maintenance date
- `NEXT_MAINTENANCE_DUE`: Next scheduled maintenance

**Total Records:** 43 equipment assets

**Use Case:** Represents the "what" in asset management - individual pieces of equipment with their attributes, status, and maintenance history.

---

## Join Relationship

The datasets are designed to be joined on:

**Left Table:** SAP Functional Locations
**Right Table:** SAP Equipment Assets
**Join Condition:** `FLOC_ID` = `FUNCTIONAL_LOCATION`

### Join Types and Expected Results:

1. **Inner Join:**
   - Returns only equipment that is assigned to a known functional location
   - Result: ~43 rows (all equipment with valid locations)

2. **Left Join (FLOC as left):**
   - Returns all functional locations, with equipment data where available
   - Shows which locations have equipment and which don't
   - Useful for identifying empty or under-equipped locations

3. **Right Join (Equipment as right):**
   - Returns all equipment, with location data where available
   - Shows orphaned equipment (equipment without valid location references)

4. **Full Outer Join:**
   - Returns all functional locations AND all equipment
   - Comprehensive view showing matched pairs and orphans on both sides

---

## Realistic Data Characteristics

This dataset includes real-world scenarios:

1. **Equipment Concentration:** Premium stores (Chicago, LA) have more equipment than Express stores
2. **Equipment Status Variety:**
   - Most equipment is "Operational"
   - Some equipment is "Down" (e.g., soft serve machine at Manhattan location, griddle at LA location)
   - Some equipment is in "Maintenance"
3. **Maintenance Schedules:** Equipment has realistic maintenance intervals (quarterly)
4. **Cost Distribution:** Equipment costs range from $1,800 (beverage dispensers) to $15,800 (large walk-in coolers)
5. **Criticality Levels:** Walk-in coolers marked as "Critical", fryers as "High", POS as "High"
6. **Hierarchical Locations:** Equipment is assigned to specific functional areas (Kitchen, FOH, Storage)

---

## Loading the Sample Data

### Option 1: Via UI (Recommended)
1. Navigate to **Relationships → Data Joins** tab
2. Click **"Load Sample Data"** button
3. Two bundles will be created automatically:
   - "SAP Functional Locations"
   - "SAP Equipment Assets"

### Option 2: Manual Upload
1. Download both CSV files
2. Navigate to **Data Bundles**
3. Click **"New Bundle"** for each file
4. Select "Tabular" schema
5. Map columns appropriately

---

## Example Join Use Cases

### 1. Equipment Inventory by Location
**Join Type:** Left Join (FLOC left, Equipment right)
**Purpose:** See which locations have what equipment, identify gaps

**Analysis:**
- Which stores lack certain equipment types?
- Equipment distribution across regions
- Total equipment cost per location

### 2. Equipment Without Valid Locations
**Join Type:** Right Join (FLOC left, Equipment right) or Full Outer
**Purpose:** Find orphaned equipment records (data quality check)

**Analysis:**
- Equipment with invalid FUNCTIONAL_LOCATION values
- Data integrity issues
- Equipment that needs location reassignment

### 3. Complete Asset Register
**Join Type:** Inner Join
**Purpose:** Full equipment inventory with location context

**Analysis:**
- Equipment maintenance schedules by region
- Equipment criticality mapping
- Asset value by location hierarchy

### 4. Maintenance Planning
**Join Type:** Inner Join
**Purpose:** Plan maintenance activities with location context

**Analysis:**
- Equipment due for maintenance at specific stores
- Regional maintenance scheduling
- Critical equipment requiring immediate attention

---

## Data Quality Insights

When you join these datasets, look for:

1. **Match Rates:**
   - High match rate expected (~95%+)
   - Unmatched equipment may indicate data entry errors

2. **Orphaned Records:**
   - FLOCs with no equipment (new locations, storage areas)
   - Equipment with invalid FLOC references (data quality issues)

3. **Equipment Concentration:**
   - Premium stores should have more equipment
   - Kitchen areas should have most equipment

4. **Status Patterns:**
   - Most equipment operational
   - Some "Down" equipment requiring attention
   - Equipment in "Maintenance" status

---

## SAP PM Context

These datasets simulate SAP PM (Plant Maintenance) module data:

- **FLOC** = Functional Location (SAP table: IFLOT, IFLOTX)
- **Equipment** = Equipment Master (SAP table: EQUI, EQKT)
- **Join Relationship** = TPLNR field linking equipment to FLOC

This structure is commonly used in:
- Manufacturing plants
- Facility management
- Retail chains
- Food service operations
- Any organization with distributed assets across multiple locations

---

## Tips for Exploration

1. **Start with Inner Join:** See basic equipment-to-location relationships
2. **Use Test Join:** Check match statistics before creating the join
3. **Try Different Join Types:** Compare results to understand each type
4. **Filter Results:** Use the explorer to filter by region, equipment type, status
5. **Analyze Patterns:** Look at equipment distribution, costs, maintenance schedules

---

## Future Enhancements

These datasets can be extended with:
- Maintenance order history (work orders, notifications)
- Equipment downtime tracking
- Parts inventory and consumption
- Labor hours and costs
- Equipment performance metrics (OEE, MTBF, MTTR)
- Preventive maintenance plans
- Bill of Materials (BOMs) for equipment

---

*Generated for Data Explorer - A semantic data exploration tool*
