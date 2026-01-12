import type { SemanticSchema } from '@/types';

/**
 * Generate a prompt to suggest column mappings
 */
export function suggestMappingsPrompt(
  columns: string[],
  sampleData: Record<string, unknown>[],
  schema: SemanticSchema
): string {
  const sampleStr = JSON.stringify(sampleData.slice(0, 5), null, 2);
  const rolesStr = schema.roles
    .map((r) => `- ${r.id}: ${r.description}${r.required ? ' (REQUIRED)' : ''}`)
    .join('\n');

  return `You are a data mapping assistant. Given the following columns and sample data, suggest which columns should map to which semantic roles.

## Available Columns
${columns.join(', ')}

## Sample Data (first 5 rows)
${sampleStr}

## Semantic Roles to Map
${rolesStr}

## Instructions
- Return a JSON object mapping role IDs to column names
- Only include mappings you're confident about
- Required roles should be prioritized
- Example format: {"node_id": "FLOC_CODE", "parent_id": "PARENT_FLOC"}

## Your Response (JSON only, no explanation)`;
}

/**
 * Generate a prompt to describe a dataset
 */
export function describeDataPrompt(
  columns: string[],
  sampleData: Record<string, unknown>[],
  rowCount: number
): string {
  const sampleStr = JSON.stringify(sampleData.slice(0, 10), null, 2);

  return `You are a data analyst. Describe this dataset in 2-3 sentences for a business user.

## Dataset Info
- Columns: ${columns.join(', ')}
- Total rows: ${rowCount}

## Sample Data (first 10 rows)
${sampleStr}

## Instructions
- Describe what this data appears to represent
- Mention any obvious patterns or data types
- Keep it concise and non-technical
- Do not use markdown formatting

## Your Response`;
}

/**
 * Generate a prompt to explain a column
 */
export function explainColumnPrompt(
  columnName: string,
  sampleValues: unknown[],
  nullCount: number,
  uniqueCount: number,
  totalCount: number
): string {
  const samplesStr = sampleValues.slice(0, 20).join(', ');

  return `You are a data analyst. Explain what this column likely represents.

## Column: ${columnName}

## Statistics
- Total values: ${totalCount}
- Unique values: ${uniqueCount}
- Null/empty: ${nullCount}

## Sample Values
${samplesStr}

## Instructions
- Explain what this column likely represents in 1-2 sentences
- Mention the apparent data type (ID, name, date, number, category, etc.)
- Note any patterns in the values
- Do not use markdown formatting

## Your Response`;
}

/**
 * Generate a prompt to suggest a better display name
 */
export function suggestDisplayNamePrompt(
  columnName: string,
  sampleValues: unknown[]
): string {
  const samplesStr = sampleValues.slice(0, 10).join(', ');

  return `Given this technical column name and sample values, suggest a user-friendly display name.

Column: ${columnName}
Samples: ${samplesStr}

Respond with ONLY the suggested display name, nothing else. Use title case.`;
}

/**
 * Generate a prompt to explain an anomaly or outlier
 */
export function explainAnomalyPrompt(
  columnName: string,
  anomalyValue: unknown,
  normalValues: unknown[],
  context: string
): string {
  return `You are a data quality analyst. Explain why this value might be anomalous.

## Column: ${columnName}

## Anomaly Value
${anomalyValue}

## Typical Values
${normalValues.slice(0, 10).join(', ')}

## Context
${context}

## Instructions
- Explain in 1-2 sentences why this value stands out
- Suggest possible reasons (data entry error, edge case, etc.)
- Do not use markdown formatting

## Your Response`;
}
