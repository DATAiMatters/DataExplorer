import type {
  DataBundle,
  JoinDefinition,
  ColumnMapping,
} from '@/types';

/**
 * Join Execution Utilities
 *
 * Executes joins in-memory using JavaScript (no SQL).
 * Supports inner, left, right, and full outer joins.
 */

type ParsedRow = Record<string, unknown>;

interface JoinResult {
  data: ParsedRow[];
  leftColumns: string[];
  rightColumns: string[];
  stats: {
    leftRows: number;
    rightRows: number;
    resultRows: number;
    matchedLeftRows: number;
    matchedRightRows: number;
  };
}

/**
 * Execute a join between two bundles based on a join definition
 */
export function executeJoin(
  leftBundle: DataBundle,
  rightBundle: DataBundle,
  join: JoinDefinition
): JoinResult {
  const leftData = leftBundle.source.parsedData;
  const rightData = rightBundle.source.parsedData;
  const leftColumns = leftBundle.source.columns;
  const rightColumns = rightBundle.source.columns;

  // Get column mappings for join conditions
  const conditionMappings = join.conditions.map((condition) => ({
    leftColumn: getMappedColumn(leftBundle.mappings, condition.leftRoleId),
    rightColumn: getMappedColumn(rightBundle.mappings, condition.rightRoleId),
    operator: condition.operator,
  }));

  // Validate all columns exist
  const missingColumns = conditionMappings.filter(
    (mapping) => !mapping.leftColumn || !mapping.rightColumn
  );
  if (missingColumns.length > 0) {
    throw new Error('Join condition references missing columns');
  }

  // Execute join based on type
  let result: ParsedRow[];
  let matchedLeftRows = 0;
  let matchedRightRows = 0;

  switch (join.joinType) {
    case 'inner':
      result = executeInnerJoin(leftData, rightData, conditionMappings);
      matchedLeftRows = countUniqueMatchedRows(result, leftColumns);
      matchedRightRows = countUniqueMatchedRows(result, rightColumns);
      break;

    case 'left':
      result = executeLeftJoin(leftData, rightData, conditionMappings, rightColumns);
      // Only count left rows that actually matched with right rows
      matchedLeftRows = countUniqueMatchedRows(
        result.filter((row) => !isNullRow(row, rightColumns)),
        leftColumns
      );
      matchedRightRows = countUniqueMatchedRows(
        result.filter((row) => !isNullRow(row, rightColumns)),
        rightColumns
      );
      break;

    case 'right':
      result = executeRightJoin(leftData, rightData, conditionMappings, leftColumns);
      matchedLeftRows = countUniqueMatchedRows(
        result.filter((row) => !isNullRow(row, leftColumns)),
        leftColumns
      );
      // Only count right rows that actually matched with left rows
      matchedRightRows = countUniqueMatchedRows(
        result.filter((row) => !isNullRow(row, leftColumns)),
        rightColumns
      );
      break;

    case 'full':
      result = executeFullOuterJoin(leftData, rightData, conditionMappings, leftColumns, rightColumns);
      matchedLeftRows = countUniqueMatchedRows(
        result.filter((row) => !isNullRow(row, leftColumns)),
        leftColumns
      );
      matchedRightRows = countUniqueMatchedRows(
        result.filter((row) => !isNullRow(row, rightColumns)),
        rightColumns
      );
      break;

    default:
      throw new Error(`Unsupported join type: ${join.joinType}`);
  }

  return {
    data: result,
    leftColumns,
    rightColumns,
    stats: {
      leftRows: leftData.length,
      rightRows: rightData.length,
      resultRows: result.length,
      matchedLeftRows,
      matchedRightRows,
    },
  };
}

/**
 * Inner join: only matching rows from both sides
 */
function executeInnerJoin(
  leftData: ParsedRow[],
  rightData: ParsedRow[],
  conditions: Array<{ leftColumn: string; rightColumn: string; operator: string }>
): ParsedRow[] {
  const result: ParsedRow[] = [];

  for (const leftRow of leftData) {
    for (const rightRow of rightData) {
      if (evaluateJoinConditions(leftRow, rightRow, conditions)) {
        result.push(mergeRows(leftRow, rightRow));
      }
    }
  }

  return result;
}

/**
 * Left join: all rows from left, matched rows from right (nulls if no match)
 */
function executeLeftJoin(
  leftData: ParsedRow[],
  rightData: ParsedRow[],
  conditions: Array<{ leftColumn: string; rightColumn: string; operator: string }>,
  rightColumns: string[]
): ParsedRow[] {
  const result: ParsedRow[] = [];

  for (const leftRow of leftData) {
    let matched = false;

    for (const rightRow of rightData) {
      if (evaluateJoinConditions(leftRow, rightRow, conditions)) {
        result.push(mergeRows(leftRow, rightRow));
        matched = true;
      }
    }

    // If no match, add left row with null right values
    if (!matched) {
      result.push(mergeRows(leftRow, createNullRow(rightColumns)));
    }
  }

  return result;
}

/**
 * Right join: matched rows from left (nulls if no match), all rows from right
 */
function executeRightJoin(
  leftData: ParsedRow[],
  rightData: ParsedRow[],
  conditions: Array<{ leftColumn: string; rightColumn: string; operator: string }>,
  leftColumns: string[]
): ParsedRow[] {
  const result: ParsedRow[] = [];

  for (const rightRow of rightData) {
    let matched = false;

    for (const leftRow of leftData) {
      if (evaluateJoinConditions(leftRow, rightRow, conditions)) {
        result.push(mergeRows(leftRow, rightRow));
        matched = true;
      }
    }

    // If no match, add right row with null left values
    if (!matched) {
      result.push(mergeRows(createNullRow(leftColumns), rightRow));
    }
  }

  return result;
}

/**
 * Full outer join: all rows from both sides (nulls where no match)
 */
function executeFullOuterJoin(
  leftData: ParsedRow[],
  rightData: ParsedRow[],
  conditions: Array<{ leftColumn: string; rightColumn: string; operator: string }>,
  leftColumns: string[],
  rightColumns: string[]
): ParsedRow[] {
  const result: ParsedRow[] = [];
  const matchedRightIndices = new Set<number>();

  // First pass: add all left rows with matches
  for (const leftRow of leftData) {
    let matched = false;

    for (let rightIndex = 0; rightIndex < rightData.length; rightIndex++) {
      const rightRow = rightData[rightIndex];
      if (evaluateJoinConditions(leftRow, rightRow, conditions)) {
        result.push(mergeRows(leftRow, rightRow));
        matchedRightIndices.add(rightIndex);
        matched = true;
      }
    }

    // If no match, add left row with null right values
    if (!matched) {
      result.push(mergeRows(leftRow, createNullRow(rightColumns)));
    }
  }

  // Second pass: add unmatched right rows with null left values
  for (let rightIndex = 0; rightIndex < rightData.length; rightIndex++) {
    if (!matchedRightIndices.has(rightIndex)) {
      result.push(mergeRows(createNullRow(leftColumns), rightData[rightIndex]));
    }
  }

  return result;
}

/**
 * Evaluate all join conditions for two rows
 */
function evaluateJoinConditions(
  leftRow: ParsedRow,
  rightRow: ParsedRow,
  conditions: Array<{ leftColumn: string; rightColumn: string; operator: string }>
): boolean {
  return conditions.every((condition) => {
    const leftValue = leftRow[condition.leftColumn];
    const rightValue = rightRow[condition.rightColumn];

    switch (condition.operator) {
      case '=':
        return leftValue === rightValue;
      case '!=':
        return leftValue !== rightValue;
      case '>':
        return Number(leftValue) > Number(rightValue);
      case '<':
        return Number(leftValue) < Number(rightValue);
      case '>=':
        return Number(leftValue) >= Number(rightValue);
      case '<=':
        return Number(leftValue) <= Number(rightValue);
      case 'like':
        return String(leftValue).includes(String(rightValue));
      default:
        return false;
    }
  });
}

/**
 * Merge two rows into a single row
 * Prefixes column names to avoid conflicts: left_* and right_*
 */
function mergeRows(leftRow: ParsedRow, rightRow: ParsedRow): ParsedRow {
  const merged: ParsedRow = {};

  // Add left columns with prefix
  for (const [key, value] of Object.entries(leftRow)) {
    merged[`left_${key}`] = value;
  }

  // Add right columns with prefix
  for (const [key, value] of Object.entries(rightRow)) {
    merged[`right_${key}`] = value;
  }

  return merged;
}

/**
 * Create a row with null values for all columns
 */
function createNullRow(columns: string[]): ParsedRow {
  const nullRow: ParsedRow = {};
  for (const column of columns) {
    nullRow[column] = null;
  }
  return nullRow;
}

/**
 * Check if a row has all null values for the given columns
 */
function isNullRow(row: ParsedRow, columns: string[]): boolean {
  return columns.every((col) => row[`left_${col}`] === null || row[`right_${col}`] === null);
}

/**
 * Count unique rows that have non-null values
 */
function countUniqueMatchedRows(rows: ParsedRow[], columns: string[]): number {
  const uniqueRows = new Set<string>();

  for (const row of rows) {
    // Use nullish coalescing to preserve 0, "", false as legitimate values
    const rowKey = columns.map((col) => row[`left_${col}`] ?? row[`right_${col}`]).join('|');
    uniqueRows.add(rowKey);
  }

  return uniqueRows.size;
}

/**
 * Get the source column name for a given semantic role
 */
function getMappedColumn(mappings: ColumnMapping[], roleId: string): string {
  const mapping = mappings.find((m) => m.roleId === roleId);
  return mapping?.sourceColumn || '';
}

/**
 * Validate a join definition against two bundles
 */
export function validateJoin(
  leftBundle: DataBundle,
  rightBundle: DataBundle,
  join: JoinDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check bundles exist
  if (!leftBundle) {
    errors.push('Left bundle not found');
  }
  if (!rightBundle) {
    errors.push('Right bundle not found');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check conditions
  if (join.conditions.length === 0) {
    errors.push('At least one join condition is required');
  }

  // Check all mapped columns exist
  for (const condition of join.conditions) {
    const leftColumn = getMappedColumn(leftBundle.mappings, condition.leftRoleId);
    const rightColumn = getMappedColumn(rightBundle.mappings, condition.rightRoleId);

    if (!leftColumn) {
      errors.push(`Left role "${condition.leftRoleId}" is not mapped`);
    }
    if (!rightColumn) {
      errors.push(`Right role "${condition.rightRoleId}" is not mapped`);
    }

    if (leftColumn && !leftBundle.source.columns.includes(leftColumn)) {
      errors.push(`Left column "${leftColumn}" does not exist`);
    }
    if (rightColumn && !rightBundle.source.columns.includes(rightColumn)) {
      errors.push(`Right column "${rightColumn}" does not exist`);
    }
  }

  return { valid: errors.length === 0, errors };
}
