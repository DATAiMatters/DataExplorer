# User Guide: Creating and Managing Joins

This guide explains how to use DataExplorer's join feature to combine data from multiple bundles.

## Overview

Joins allow you to combine data from two different bundles based on common fields, similar to SQL joins but with a visual interface and semantic role mapping.

## Quick Start: Load Sample Data

Want to try joins right away? Click the **"Load Sample Data"** button in the Data Joins tab to instantly load two SAP-oriented datasets:
- **SAP Functional Locations** - Restaurant chain hierarchy (30 locations)
- **SAP Equipment Assets** - Commercial kitchen equipment (43 items)

These datasets are pre-configured and ready to join on `FLOC_ID` = `FUNCTIONAL_LOCATION`. Perfect for learning how joins work!

## Accessing the Join Builder

1. Navigate to **Relationships** in the sidebar (GitBranch icon)
2. Click the **Data Joins** tab
3. Click **New Join** button

## Creating a Join

### Step 1: Name Your Join (Optional)

Give your join a descriptive name like "Customer Orders" or "Equipment Maintenance". If left blank, a name will be auto-generated.

### Step 2: Select Bundles

**Left Bundle:**
- Select the first bundle you want to join
- This will be the "left side" of your join

**Right Bundle:**
- Select the second bundle to join with
- This will be the "right side" of your join

### Step 3: Choose Join Type

Click the info icon (ℹ️) next to "Join Type" for detailed explanations. The types are:

**Inner Join**
- Returns only rows that match in both bundles
- Example: Only customers who have placed orders
- Use when: You only want matching records

**Left Join**
- Returns all rows from the left bundle, matched rows from the right
- Unmatched left rows will have nulls for right columns
- Example: All customers, with their orders if they exist
- Use when: You need all left records regardless of matches

**Right Join**
- Returns matched rows from the left, all rows from the right
- Unmatched right rows will have nulls for left columns
- Example: All orders, with customer info if it exists
- Use when: You need all right records regardless of matches

**Full Outer Join**
- Returns all rows from both bundles
- Unmatched rows will have nulls on the non-matching side
- Example: All customers and all orders, matched where possible
- Use when: You need all records from both sides

### Step 4: Define Join Conditions

Join conditions specify which fields should match between the bundles.

**Adding a Condition:**
1. Click **Add Condition**
2. Select a field from the left bundle
   - Shows both the semantic role name and actual column name
   - Example: "Customer ID (CUST_ID)"
3. Select an operator (usually `=` for equality)
4. Select a matching field from the right bundle

**Multiple Conditions:**
- Click **Add Condition** again to add more
- All conditions must be true (AND logic)
- Example: Match on both customer_id AND region

**Auto-Suggestions:**
- If bundles have matching semantic roles, a "Use Suggestions" button appears
- Click it to automatically add suggested conditions
- Based on semantic role IDs, not column names

**Viewing Column Details:**
- The source column name appears below each dropdown
- Dropdown shows: "Role Name (source_column)"
- All mapped fields are visible in the dropdown

### Step 5: Test the Join

**Before creating the join, test it first:**

1. Click **Test Join** button
2. The join executes and shows statistics:
   - **Input Rows**: How many rows from each bundle
   - **Result Rows**: How many rows after joining
   - **Matched**: How many rows from each side found matches
   - **Unmatched**: How many rows didn't match
   - **Dropped**: For inner joins, total rows excluded

**Example Test Results:**
```
Input Rows (Left): 1,234 customers
Input Rows (Right): 5,678 orders
Result Rows: 987
Matched (Left): 987 (80% matched)
Matched (Right): 987 (17% matched)
Unmatched (Left): 247 customers with no orders
Unmatched (Right): 4,691 orders with no customer
Dropped: 4,938 rows (no match)
```

**What to Look For:**
- ⚠️ High unmatched percentage might indicate wrong join conditions
- ⚠️ Zero results means no matches found - check your conditions
- ✅ Match percentages that make sense for your data

### Step 6: Create the Join

Once you're satisfied with the test results:
1. Click **Create Join**
2. The join definition is saved
3. A virtual bundle is automatically created
4. You're redirected to the Relationships view

## Managing Joins

### Viewing Joins

In **Relationships → Data Joins**, you'll see all your joins displayed as cards showing:

- Join name and type badge
- Visual flow: Left Bundle → Right Bundle
- Join conditions
- Dependent virtual bundles
- Row counts for each bundle

### Viewing Join Results

Click the **View** button (eye icon) on a virtual bundle to:
- See the joined data in the Explorer
- Browse the combined dataset
- Analyze the results

### Deleting Joins

Click the **Trash** icon on a join card:
- **Warning:** Deleting a join also deletes dependent virtual bundles
- You'll see a confirmation dialog listing what will be deleted
- This action cannot be undone

## Understanding Virtual Bundles

Virtual bundles are like SQL views - they don't store data, just reference the join definition.

**Key Points:**
- Created automatically when you create a join
- Appear in your bundles list
- Compute data on-demand when viewed
- Always fresh (reflect current source data)
- Don't take up extra storage space

**Viewing Virtual Bundle Data:**
1. Select the virtual bundle from your bundles list
2. Data is computed in real-time by executing the join
3. Results include prefixed columns:
   - `left_column_name` from the left bundle
   - `right_column_name` from the right bundle

## Best Practices

### Choosing Join Conditions

✅ **DO:**
- Use unique identifier fields (IDs) when possible
- Match fields with the same semantic meaning
- Test joins before creating them
- Use multiple conditions for complex relationships

❌ **DON'T:**
- Join on fields with many duplicates (creates cartesian products)
- Mix data types (string with number)
- Forget to test - always verify results first

### Join Type Selection

**Use Inner Join when:**
- You only care about matching records
- Missing data on either side is not relevant
- You want to filter out unmatched records

**Use Left Join when:**
- You need all records from one primary dataset
- Missing related data should show as nulls
- Example: All customers, with orders if available

**Use Right Join when:**
- Less common, usually can be expressed as left join
- You need all records from the second dataset

**Use Full Outer Join when:**
- You need to see all records from both sides
- You're analyzing data completeness
- You want to find orphaned records

### Performance Tips

- Keep datasets under 50k rows for best performance
- Joins with equality (=) are fastest
- Multiple join conditions slow down execution
- Test with "Test Join" to estimate performance

### Semantic Roles

**Why semantic roles matter:**
- Column names can differ but semantic meaning is the same
- Example: `CUST_ID` in one file, `CustomerID` in another
- Both map to `customer_id` semantic role
- Join uses semantic roles, not raw column names
- If you rename a column, joins don't break

## Troubleshooting

### No Results After Join

**Problem:** Test Join shows 0 result rows

**Solutions:**
1. Check join conditions - are the fields actually matching?
2. Verify data types are compatible
3. Look at sample data from both bundles
4. Try removing conditions one by one to isolate the issue

### Too Many Results

**Problem:** Test Join shows millions of rows

**Solutions:**
1. You might have a cartesian product (every row matches every row)
2. Check that join conditions are specific enough
3. Ensure you're using unique identifiers
4. Add more conditions to be more selective

### Low Match Rate

**Problem:** Test Join shows < 50% matched

**Solutions:**
1. Verify you're joining on the correct fields
2. Check for data quality issues (nulls, inconsistent values)
3. Ensure data is actually related
4. Consider if this is expected (left join for optional relationships)

### Wrong Data Types

**Problem:** Error message about incompatible types

**Solutions:**
1. Check that both fields are the same type (both numbers, both text)
2. Update your schema mappings if needed
3. Use string fields for text-to-text comparisons

## Example Scenarios

### Scenario 1: Customer Orders

**Goal:** See all customers with their orders

**Setup:**
- Left Bundle: Customers (1,000 rows)
- Right Bundle: Orders (5,000 rows)
- Join Type: Left Join
- Condition: customer_id = customer_id

**Result:**
- 1,000 rows (one per customer)
- Customers with orders show order details
- Customers without orders show nulls for order columns

### Scenario 2: Equipment Maintenance

**Goal:** Only equipment that has maintenance records

**Setup:**
- Left Bundle: Equipment (500 rows)
- Right Bundle: Maintenance (2,000 rows)
- Join Type: Inner Join
- Condition: equipment_id = equipment_id

**Result:**
- 300 equipment items (only those with maintenance)
- 200 equipment items excluded (no maintenance records)
- Each equipment row matched with its maintenance records

### Scenario 3: Data Quality Check

**Goal:** Find all records from both datasets, identify orphans

**Setup:**
- Left Bundle: Products (800 rows)
- Right Bundle: Inventory (750 rows)
- Join Type: Full Outer Join
- Condition: product_id = product_id

**Result:**
- Shows which products have inventory
- Shows which inventory records have no product (orphaned)
- Shows which products have no inventory
- Useful for data cleanup

## Advanced Features

### Multiple Join Conditions

Combine multiple fields for more precise matching:

```
Condition 1: customer_id = customer_id
Condition 2: region = region
```

Only rows where BOTH conditions match will be joined.

### Chained Joins (Future)

Currently, joins work with two bundles. Future versions will support:
- Joining the result of a join with another bundle
- Multi-way joins (3+ bundles)
- Recursive joins for hierarchical data

### Join Statistics Export (Future)

Save test results for documentation:
- Export join statistics to CSV
- Include in data lineage reports
- Track data quality over time

## Getting Help

- **In-app tooltips:** Hover over the info icon (ℹ️) for quick explanations
- **Test Join feature:** Use it liberally - it's safe and helps understand your data
- **GitHub:** [View the repo](https://github.com/DATAiMatters/DataExplorer)
- **Issues:** Report bugs or request features on GitHub Issues

## Sample Datasets

### SAP PM Sample Data

The app includes two pre-built SAP PM (Plant Maintenance) datasets perfect for learning joins:

**1. SAP Functional Locations**
- 30 functional locations for "FastBite" fast food restaurant chain
- Hierarchical structure: Corporate → Region → Store → Area
- Locations across Northeast, Southeast, Midwest, West regions
- Fields: FLOC_ID, FLOC_NAME, PARENT_FLOC, FLOC_TYPE, REGION, STATUS

**2. SAP Equipment Assets**
- 43 commercial equipment items (fryers, griddles, coolers, POS, etc.)
- Realistic manufacturers: Pitco, Frymaster, Vulcan, Kolpak, NCR
- Equipment status: Operational, Down, Maintenance
- Fields: EQUIPMENT_ID, EQUIPMENT_NAME, FUNCTIONAL_LOCATION, EQUIPMENT_TYPE, STATUS, CRITICALITY

**Loading Sample Data:**
1. Go to **Relationships → Data Joins** tab
2. Click **"Load Sample Data"** button
3. Two bundles are created automatically
4. Ready to create joins!

**Example Join:**
- Left: SAP Functional Locations
- Right: SAP Equipment Assets
- Condition: FLOC_ID = FUNCTIONAL_LOCATION
- Result: Equipment inventory with location context

See [/public/samples/joins/README.md](../public/samples/joins/README.md) for detailed dataset documentation.

---

## Visualizing Data Lineage

After creating joins, you can visualize the relationships between your bundles:

1. Go to **Relationships → Lineage Graph** tab
2. See an interactive graph showing:
   - Your data bundles (green nodes)
   - Virtual bundles from joins (violet nodes)
   - Schemas used (amber nodes)
   - Connections between them

**Features:**
- **Interactive:** Drag nodes, zoom, pan
- **Hover Details:** See metadata for each node
- **Physics Controls:** Adjust spacing and clustering
- **Legend:** Understand node and edge types

For more details, see the [Lineage Graph Feature Guide](./LINEAGE_GRAPH_FEATURE.md).

## Related Documentation

- [JOIN_EXECUTION.md](./JOIN_EXECUTION.md) - Technical details on how joins work
- [LINEAGE_API.md](./LINEAGE_API.md) - API reference for developers
- [LINEAGE_FEATURE.md](./LINEAGE_FEATURE.md) - Feature overview and roadmap
- [LINEAGE_GRAPH_FEATURE.md](./LINEAGE_GRAPH_FEATURE.md) - Lineage graph visualization guide
- [Sample Datasets README](../public/samples/joins/README.md) - Detailed SAP sample data documentation
