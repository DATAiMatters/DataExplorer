# Join Execution - How It Works Without SQL

This document explains how DataExplorer executes joins in-memory using JavaScript, without any SQL database.

## Overview

Unlike traditional databases that use SQL to join tables, DataExplorer performs joins **client-side in the browser** using pure JavaScript algorithms. This approach:

- ✅ Works entirely offline (no server needed)
- ✅ Respects semantic role mappings
- ✅ Supports all standard join types (inner, left, right, full outer)
- ✅ Provides live preview during join creation
- ⚠️ Limited by browser memory (best for datasets <50k rows)

## Architecture

### 1. Join Definitions (Metadata)

When you create a join in the UI, we store a **join definition** - this is just metadata describing how to join two bundles:

```typescript
interface JoinDefinition {
  id: string;
  name: string;
  leftBundleId: string;    // Which bundle is on the left
  rightBundleId: string;   // Which bundle is on the right
  joinType: 'inner' | 'left' | 'right' | 'full';
  conditions: [
    {
      leftRoleId: 'customer_id',   // Semantic role from left schema
      rightRoleId: 'customer_id',  // Semantic role from right schema
      operator: '='                 // How to compare values
    }
  ]
}
```

**Key insight:** We use **semantic role IDs** instead of raw column names. This means:
- If column "CUST_ID" maps to role "customer_id", we join on the semantic meaning
- Column renames don't break joins
- Joins are schema-aware and maintainable

### 2. Virtual Bundles (View-like)

A virtual bundle is like a SQL view - it doesn't store data, just references the join:

```typescript
interface VirtualBundle {
  id: string;
  name: string;
  type: 'join';
  sourceJoinIds: ['join-123'],  // References to join definitions
  schemaId: string;             // Resulting schema after join
}
```

**When you "view" a virtual bundle, the join executes on-demand.**

### 3. Join Execution (On-Demand)

When you click "View" on a virtual bundle:

```typescript
// Store method
executeVirtualBundle(virtualBundleId) {
  // 1. Find the virtual bundle
  const vBundle = virtualBundles.find(vb => vb.id === virtualBundleId);

  // 2. Find the join definition
  const join = joins.find(j => j.id === vBundle.sourceJoinIds[0]);

  // 3. Find the source bundles
  const leftBundle = bundles.find(b => b.id === join.leftBundleId);
  const rightBundle = bundles.find(b => b.id === join.rightBundleId);

  // 4. Execute the join in JavaScript
  return executeJoin(leftBundle, rightBundle, join);
}
```

## Join Algorithms

All joins are implemented in [src/lib/joinUtils.ts](../src/lib/joinUtils.ts).

### Inner Join (Only Matches)

```typescript
function executeInnerJoin(leftData, rightData, conditions) {
  const result = [];

  for (const leftRow of leftData) {
    for (const rightRow of rightData) {
      if (evaluateJoinConditions(leftRow, rightRow, conditions)) {
        result.push(mergeRows(leftRow, rightRow));
      }
    }
  }

  return result;
}
```

**Example:**
```
Left:                Right:
id | name           id | order
---+------          ---+-------
1  | Alice          1  | Book
2  | Bob            1  | Pen
                    3  | Cup

Inner Join on id:
left_id | left_name | right_id | right_order
--------+-----------+----------+-------------
1       | Alice     | 1        | Book
1       | Alice     | 1        | Pen
```

### Left Join (All Left + Matches)

```typescript
function executeLeftJoin(leftData, rightData, conditions, rightColumns) {
  const result = [];

  for (const leftRow of leftData) {
    let matched = false;

    for (const rightRow of rightData) {
      if (evaluateJoinConditions(leftRow, rightRow, conditions)) {
        result.push(mergeRows(leftRow, rightRow));
        matched = true;
      }
    }

    // Add left row with nulls if no match
    if (!matched) {
      result.push(mergeRows(leftRow, createNullRow(rightColumns)));
    }
  }

  return result;
}
```

**Example:**
```
Left Join on id:
left_id | left_name | right_id | right_order
--------+-----------+----------+-------------
1       | Alice     | 1        | Book
1       | Alice     | 1        | Pen
2       | Bob       | null     | null        ← Bob has no orders
```

### Right Join (Matches + All Right)

Same as left join but reversed - keeps all right rows, nulls for unmatched left rows.

### Full Outer Join (All from Both)

```typescript
function executeFullOuterJoin(leftData, rightData, conditions, leftColumns, rightColumns) {
  const result = [];
  const matchedRightIndices = new Set();

  // First pass: all left rows with matches
  for (const leftRow of leftData) {
    let matched = false;

    for (let i = 0; i < rightData.length; i++) {
      if (evaluateJoinConditions(leftRow, rightData[i], conditions)) {
        result.push(mergeRows(leftRow, rightData[i]));
        matchedRightIndices.add(i);
        matched = true;
      }
    }

    if (!matched) {
      result.push(mergeRows(leftRow, createNullRow(rightColumns)));
    }
  }

  // Second pass: unmatched right rows
  for (let i = 0; i < rightData.length; i++) {
    if (!matchedRightIndices.has(i)) {
      result.push(mergeRows(createNullRow(leftColumns), rightData[i]));
    }
  }

  return result;
}
```

**Example:**
```
Full Outer Join on id:
left_id | left_name | right_id | right_order
--------+-----------+----------+-------------
1       | Alice     | 1        | Book
1       | Alice     | 1        | Pen
2       | Bob       | null     | null        ← Bob has no orders
null    | null      | 3        | Cup         ← Cup has no customer
```

## Join Conditions

### Evaluating Conditions

```typescript
function evaluateJoinConditions(leftRow, rightRow, conditions) {
  return conditions.every((condition) => {
    const leftValue = leftRow[condition.leftColumn];
    const rightValue = rightRow[condition.rightColumn];

    switch (condition.operator) {
      case '=':  return leftValue === rightValue;
      case '!=': return leftValue !== rightValue;
      case '>':  return Number(leftValue) > Number(rightValue);
      case '<':  return Number(leftValue) < Number(rightValue);
      case '>=': return Number(leftValue) >= Number(rightValue);
      case '<=': return Number(leftValue) <= Number(rightValue);
      case 'like': return String(leftValue).includes(String(rightValue));
    }
  });
}
```

**Multiple conditions are AND-ed together:**
```typescript
conditions: [
  { leftRoleId: 'customer_id', rightRoleId: 'customer_id', operator: '=' },
  { leftRoleId: 'region', rightRoleId: 'region', operator: '=' }
]
// Matches only if BOTH customer_id AND region match
```

### Semantic Role Resolution

Before joining, we resolve semantic roles to actual column names:

```typescript
function getMappedColumn(mappings, roleId) {
  const mapping = mappings.find(m => m.roleId === roleId);
  return mapping?.sourceColumn;
}

// Example:
// Left bundle mappings: { roleId: 'customer_id', sourceColumn: 'CUST_ID' }
// Right bundle mappings: { roleId: 'customer_id', sourceColumn: 'CustomerID' }
//
// Join condition: { leftRoleId: 'customer_id', rightRoleId: 'customer_id' }
// Actual join: leftRow['CUST_ID'] === rightRow['CustomerID']
```

## Column Naming

To avoid column name conflicts, we prefix all columns in the result:

```typescript
function mergeRows(leftRow, rightRow) {
  const merged = {};

  // Prefix left columns
  for (const [key, value] of Object.entries(leftRow)) {
    merged[`left_${key}`] = value;
  }

  // Prefix right columns
  for (const [key, value] of Object.entries(rightRow)) {
    merged[`right_${key}`] = value;
  }

  return merged;
}
```

**Example result:**
```javascript
{
  left_id: 1,
  left_name: 'Alice',
  left_email: 'alice@example.com',
  right_id: 1,
  right_product: 'Book',
  right_quantity: 5
}
```

## Join Preview (Before Creation)

The JoinBuilder provides a live preview by sampling the data:

```typescript
const preview = useMemo(() => {
  // Get first join condition
  const condition = conditions[0];

  // Extract values from join columns
  const leftValues = new Set(
    leftBundle.source.parsedData.map(row => row[leftMapping.sourceColumn])
  );
  const rightValues = new Set(
    rightBundle.source.parsedData.map(row => row[rightMapping.sourceColumn])
  );

  // Calculate intersection (matching values)
  const intersection = new Set(
    Array.from(leftValues).filter(v => rightValues.has(v))
  );

  // Estimate result size
  const matchRate = intersection.size / Math.max(leftValues.size, rightValues.size);

  const estimatedRows =
    joinType === 'inner' ? intersection.size :
    joinType === 'left'  ? leftValues.size :
    joinType === 'right' ? rightValues.size :
    leftValues.size + rightValues.size;

  return { rowCount: estimatedRows, matchRate };
}, [leftBundle, rightBundle, conditions, joinType]);
```

**This is a simplified estimate** - the actual join may produce more/fewer rows depending on:
- Multiple matches (1:N or N:M relationships)
- Multiple join conditions
- Null values

## Performance Characteristics

### Time Complexity

| Join Type | Best Case | Worst Case | Notes |
|-----------|-----------|------------|-------|
| Inner     | O(n)      | O(n × m)   | Nested loop |
| Left      | O(n)      | O(n × m)   | Nested loop |
| Right     | O(m)      | O(n × m)   | Nested loop |
| Full      | O(n + m)  | O(n × m)   | Two passes |

Where:
- `n` = rows in left bundle
- `m` = rows in right bundle

### Space Complexity

Result size depends on join type and data:

- **Inner:** 0 to n × m rows (only matches)
- **Left:** n to n × m rows (all left + matches)
- **Right:** m to n × m rows (matches + all right)
- **Full:** max(n, m) to n + n × m rows

**Practical limits (client-side):**
- ✅ Up to 10k × 10k = 100M comparisons (fast)
- ⚠️ Up to 50k × 50k = 2.5B comparisons (slow but doable)
- ❌ Beyond 100k rows: use server-side processing

## Future Optimizations

### 1. Hash Joins (O(n + m) instead of O(n × m))

For equality joins, we could use hash tables:

```typescript
function executeHashJoin(leftData, rightData, joinColumn) {
  // Build hash table on smaller dataset
  const hashTable = new Map();
  for (const row of rightData) {
    const key = row[joinColumn];
    if (!hashTable.has(key)) hashTable.set(key, []);
    hashTable.get(key).push(row);
  }

  // Probe with larger dataset
  const result = [];
  for (const leftRow of leftData) {
    const matches = hashTable.get(leftRow[joinColumn]) || [];
    for (const rightRow of matches) {
      result.push(mergeRows(leftRow, rightRow));
    }
  }

  return result;
}
```

**Benefits:**
- O(n + m) instead of O(n × m)
- 100x faster for large datasets
- Already used in most SQL databases

### 2. Indexed Joins

Pre-index bundles by join columns:

```typescript
// When bundle is created, build indexes
bundle.indexes = {
  'customer_id': new Map([
    ['C001', [row1, row2]],
    ['C002', [row3]],
  ])
};

// Join lookup becomes O(1)
const matches = bundle.indexes['customer_id'].get(key);
```

### 3. Lazy Loading

Only compute rows that are visible:

```typescript
// Instead of computing all rows upfront
const allRows = executeJoin(left, right, join); // Slow

// Compute on-demand
function* lazyJoin(left, right, join) {
  for (const leftRow of left) {
    for (const rightRow of right) {
      if (matches(leftRow, rightRow)) {
        yield mergeRows(leftRow, rightRow);
      }
    }
  }
}

// UI only renders 50 rows at a time
const visibleRows = lazyJoin.slice(0, 50);
```

### 4. Web Workers

Move join computation off main thread:

```typescript
// In web worker
self.onmessage = (e) => {
  const { leftData, rightData, join } = e.data;
  const result = executeJoin(leftData, rightData, join);
  self.postMessage(result);
};

// In main thread (non-blocking)
const worker = new Worker('joinWorker.js');
worker.postMessage({ leftData, rightData, join });
worker.onmessage = (e) => {
  setJoinResult(e.data);
};
```

## Usage Example

### Creating and Executing a Join

```typescript
import { useAppStore } from '@/store';
import { generateId } from '@/lib/utils';

// 1. Create join definition
const join = {
  id: generateId(),
  name: 'Customer Orders',
  leftBundleId: 'customers-123',
  rightBundleId: 'orders-456',
  joinType: 'left',
  conditions: [
    {
      leftRoleId: 'customer_id',
      rightRoleId: 'customer_id',
      operator: '='
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

useAppStore.getState().addJoin(join);

// 2. Create virtual bundle
const vBundle = {
  id: generateId(),
  name: 'Customer Orders View',
  type: 'join',
  sourceJoinIds: [join.id],
  schemaId: 'customer-orders-schema',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

useAppStore.getState().addVirtualBundle(vBundle);

// 3. Execute the join
const result = useAppStore.getState().executeVirtualBundle(vBundle.id);

console.log('Join Results:');
console.log('- Input rows:', result.stats.leftRows, 'customers');
console.log('- Input rows:', result.stats.rightRows, 'orders');
console.log('- Output rows:', result.stats.resultRows);
console.log('- Match rate:', (result.stats.matchedRightRows / result.stats.rightRows * 100).toFixed(1) + '%');
console.log('- Sample data:', result.data.slice(0, 5));
```

## Validation

Before executing a join, we validate:

```typescript
function validateJoin(leftBundle, rightBundle, join) {
  const errors = [];

  // Check bundles exist
  if (!leftBundle) errors.push('Left bundle not found');
  if (!rightBundle) errors.push('Right bundle not found');

  // Check conditions
  if (join.conditions.length === 0) {
    errors.push('At least one join condition required');
  }

  // Check all roles are mapped
  for (const condition of join.conditions) {
    const leftColumn = getMappedColumn(leftBundle.mappings, condition.leftRoleId);
    const rightColumn = getMappedColumn(rightBundle.mappings, condition.rightRoleId);

    if (!leftColumn) errors.push(`Left role "${condition.leftRoleId}" not mapped`);
    if (!rightColumn) errors.push(`Right role "${condition.rightRoleId}" not mapped`);

    if (leftColumn && !leftBundle.source.columns.includes(leftColumn)) {
      errors.push(`Column "${leftColumn}" not found in left bundle`);
    }
    if (rightColumn && !rightBundle.source.columns.includes(rightColumn)) {
      errors.push(`Column "${rightColumn}" not found in right bundle`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

## Summary

**How joins work without SQL:**

1. **Store join metadata** - Define what to join, not how
2. **Use semantic roles** - Join on meaning, not column names
3. **Execute on-demand** - Compute results when viewed
4. **Nested loop algorithm** - Simple but effective for client-side
5. **Return prefixed columns** - Avoid naming conflicts

**Trade-offs:**

| Aspect | Client-Side Joins | SQL Joins |
|--------|------------------|-----------|
| Setup | None | Database required |
| Performance | O(n × m) | O(n + m) with indexes |
| Data size | <50k rows | Millions of rows |
| Offline | Yes | No |
| Caching | Manual | Automatic |
| Optimization | Limited | Advanced |

**When to use:**
- ✅ Small to medium datasets (<50k rows)
- ✅ Exploratory data analysis
- ✅ Offline/privacy-sensitive data
- ✅ Quick prototyping

**When to use SQL instead:**
- Large datasets (>100k rows)
- Production workloads
- Complex multi-table joins
- Need for persistent materialized views

This architecture keeps DataExplorer **simple, portable, and privacy-focused** while still providing powerful join capabilities for exploratory analysis.
