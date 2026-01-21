/**
 * Data Quality Rule Execution Engine
 *
 * Executes DQ rules against linked dataset columns and returns results.
 */

import type { DataQualityRule, CriticalDataElement, DataBundle } from '@/types';

export interface DQExecutionResult {
  ruleId: string;
  cdeId: string;
  totalRecords: number;
  passedRecords: number;
  failedRecords: number;
  passRate: number;
  executedAt: string;
  failedSamples?: unknown[];
}

interface ExecutionContext {
  bundle: DataBundle;
  cde: CriticalDataElement;
  rule: DataQualityRule;
}

/**
 * Execute a single DQ rule against a dataset column
 */
export function executeRule(context: ExecutionContext): DQExecutionResult {
  const { bundle, cde, rule } = context;
  const columnName = cde.columnName;

  if (!columnName) {
    return {
      ruleId: rule.id,
      cdeId: cde.id,
      totalRecords: 0,
      passedRecords: 0,
      failedRecords: 0,
      passRate: 0,
      executedAt: new Date().toISOString(),
    };
  }

  const data = bundle.source.parsedData;
  const totalRecords = data.length;

  if (totalRecords === 0) {
    return {
      ruleId: rule.id,
      cdeId: cde.id,
      totalRecords: 0,
      passedRecords: 0,
      failedRecords: 0,
      passRate: 100,
      executedAt: new Date().toISOString(),
    };
  }

  const values = data.map((row) => row[columnName]);
  const { passed, failed, failedSamples } = evaluateRuleType(rule, values);

  const passRate = totalRecords > 0 ? (passed / totalRecords) * 100 : 100;

  return {
    ruleId: rule.id,
    cdeId: cde.id,
    totalRecords,
    passedRecords: passed,
    failedRecords: failed,
    passRate,
    executedAt: new Date().toISOString(),
    failedSamples: failedSamples.slice(0, 10), // Keep first 10 samples
  };
}

/**
 * Evaluate a rule type against an array of values
 */
function evaluateRuleType(
  rule: DataQualityRule,
  values: unknown[]
): { passed: number; failed: number; failedSamples: unknown[] } {
  switch (rule.ruleType) {
    case 'completeness':
      return evaluateCompleteness(values);
    case 'uniqueness':
      return evaluateUniqueness(values);
    case 'validity':
      return evaluateValidity(values, rule);
    case 'consistency':
      return evaluateConsistency(values, rule);
    case 'timeliness':
      return evaluateTimeliness(values, rule);
    case 'accuracy':
      return evaluateAccuracy(values, rule);
    default:
      return { passed: values.length, failed: 0, failedSamples: [] };
  }
}

/**
 * Completeness: Check for null/empty values
 */
function evaluateCompleteness(values: unknown[]): { passed: number; failed: number; failedSamples: unknown[] } {
  const failedSamples: unknown[] = [];
  let passed = 0;
  let failed = 0;

  for (const value of values) {
    if (isNullOrEmpty(value)) {
      failed++;
      if (failedSamples.length < 10) {
        failedSamples.push(value);
      }
    } else {
      passed++;
    }
  }

  return { passed, failed, failedSamples };
}

/**
 * Uniqueness: Check for duplicate values
 */
function evaluateUniqueness(values: unknown[]): { passed: number; failed: number; failedSamples: unknown[] } {
  const seen = new Map<string, number>();
  const failedSamples: unknown[] = [];

  // Count occurrences
  for (const value of values) {
    const key = String(value);
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  // Find duplicates
  let passed = 0;
  let failed = 0;

  for (const value of values) {
    const key = String(value);
    const count = seen.get(key) || 0;
    if (count > 1) {
      failed++;
      if (failedSamples.length < 10 && !failedSamples.includes(value)) {
        failedSamples.push(value);
      }
    } else {
      passed++;
    }
  }

  return { passed, failed, failedSamples };
}

/**
 * Validity: Check against pattern or expression
 */
function evaluateValidity(
  values: unknown[],
  rule: DataQualityRule
): { passed: number; failed: number; failedSamples: unknown[] } {
  const failedSamples: unknown[] = [];
  let passed = 0;
  let failed = 0;

  // If we have a pattern, use regex
  if (rule.expectedPattern) {
    try {
      const regex = new RegExp(rule.expectedPattern);
      for (const value of values) {
        if (value == null || value === '') {
          // Null/empty may be handled by completeness, pass here
          passed++;
        } else if (regex.test(String(value))) {
          passed++;
        } else {
          failed++;
          if (failedSamples.length < 10) {
            failedSamples.push(value);
          }
        }
      }
    } catch {
      // Invalid regex, pass all
      passed = values.length;
    }
  } else if (rule.expression) {
    // Simple expression evaluation (e.g., "value > 0", "value IS NOT NULL")
    for (const value of values) {
      if (evaluateExpression(rule.expression, value)) {
        passed++;
      } else {
        failed++;
        if (failedSamples.length < 10) {
          failedSamples.push(value);
        }
      }
    }
  } else {
    // No pattern or expression, just check non-null
    return evaluateCompleteness(values);
  }

  return { passed, failed, failedSamples };
}

/**
 * Consistency: Check value format consistency
 */
function evaluateConsistency(
  values: unknown[],
  _rule: DataQualityRule
): { passed: number; failed: number; failedSamples: unknown[] } {
  const failedSamples: unknown[] = [];
  let passed = 0;
  let failed = 0;

  // Detect dominant format pattern
  const formats = new Map<string, number>();
  for (const value of values) {
    if (value == null || value === '') continue;
    const format = detectFormat(String(value));
    formats.set(format, (formats.get(format) || 0) + 1);
  }

  // Find the dominant format
  let dominantFormat = '';
  let dominantCount = 0;
  for (const [format, count] of formats) {
    if (count > dominantCount) {
      dominantFormat = format;
      dominantCount = count;
    }
  }

  // Check each value against dominant format
  for (const value of values) {
    if (value == null || value === '') {
      passed++;
      continue;
    }
    const format = detectFormat(String(value));
    if (format === dominantFormat) {
      passed++;
    } else {
      failed++;
      if (failedSamples.length < 10) {
        failedSamples.push(value);
      }
    }
  }

  return { passed, failed, failedSamples };
}

/**
 * Timeliness: Check date values are within acceptable range
 */
function evaluateTimeliness(
  values: unknown[],
  _rule: DataQualityRule
): { passed: number; failed: number; failedSamples: unknown[] } {
  const failedSamples: unknown[] = [];
  let passed = 0;
  let failed = 0;

  const now = new Date();
  const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year default

  for (const value of values) {
    if (value == null || value === '') {
      passed++;
      continue;
    }

    const date = new Date(String(value));
    if (isNaN(date.getTime())) {
      // Not a valid date, fail
      failed++;
      if (failedSamples.length < 10) {
        failedSamples.push(value);
      }
    } else {
      const age = now.getTime() - date.getTime();
      if (age < 0 || age > maxAge) {
        // Future date or too old
        failed++;
        if (failedSamples.length < 10) {
          failedSamples.push(value);
        }
      } else {
        passed++;
      }
    }
  }

  return { passed, failed, failedSamples };
}

/**
 * Accuracy: Check values against reference (placeholder for now)
 */
function evaluateAccuracy(
  values: unknown[],
  _rule: DataQualityRule
): { passed: number; failed: number; failedSamples: unknown[] } {
  // Without a reference dataset, we can't validate accuracy
  // For now, just pass all non-null values
  return evaluateCompleteness(values);
}

/**
 * Evaluate a simple expression against a value
 */
function evaluateExpression(expression: string, value: unknown): boolean {
  const expr = expression.toLowerCase().trim();

  // Handle IS NOT NULL
  if (expr === 'is not null' || expr === 'value is not null') {
    return !isNullOrEmpty(value);
  }

  // Handle IS NULL
  if (expr === 'is null' || expr === 'value is null') {
    return isNullOrEmpty(value);
  }

  // Handle numeric comparisons
  const numValue = Number(value);
  if (!isNaN(numValue)) {
    // value > N
    const gtMatch = expr.match(/^(?:value\s*)?>\s*(-?\d+(?:\.\d+)?)$/);
    if (gtMatch) {
      return numValue > Number(gtMatch[1]);
    }

    // value >= N
    const gteMatch = expr.match(/^(?:value\s*)?>=\s*(-?\d+(?:\.\d+)?)$/);
    if (gteMatch) {
      return numValue >= Number(gteMatch[1]);
    }

    // value < N
    const ltMatch = expr.match(/^(?:value\s*)?<\s*(-?\d+(?:\.\d+)?)$/);
    if (ltMatch) {
      return numValue < Number(ltMatch[1]);
    }

    // value <= N
    const lteMatch = expr.match(/^(?:value\s*)?<=\s*(-?\d+(?:\.\d+)?)$/);
    if (lteMatch) {
      return numValue <= Number(lteMatch[1]);
    }

    // value = N
    const eqMatch = expr.match(/^(?:value\s*)?=\s*(-?\d+(?:\.\d+)?)$/);
    if (eqMatch) {
      return numValue === Number(eqMatch[1]);
    }

    // value != N
    const neqMatch = expr.match(/^(?:value\s*)?(?:!=|<>)\s*(-?\d+(?:\.\d+)?)$/);
    if (neqMatch) {
      return numValue !== Number(neqMatch[1]);
    }

    // value BETWEEN A AND B
    const betweenMatch = expr.match(/^(?:value\s+)?between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)$/);
    if (betweenMatch) {
      return numValue >= Number(betweenMatch[1]) && numValue <= Number(betweenMatch[2]);
    }
  }

  // Default: pass if value is non-null
  return !isNullOrEmpty(value);
}

/**
 * Detect the format pattern of a string value
 */
function detectFormat(value: string): string {
  // Date patterns
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'YYYY-MM-DD';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return 'MM/DD/YYYY';
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return 'DD-MM-YYYY';

  // Number patterns
  if (/^-?\d+$/.test(value)) return 'integer';
  if (/^-?\d+\.\d+$/.test(value)) return 'decimal';
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(value)) return 'formatted_number';

  // Code patterns
  if (/^[A-Z]{2,5}-\d+$/.test(value)) return 'code_dash_number';
  if (/^[A-Z]+\d+$/.test(value)) return 'code_number';

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';

  // Length-based
  return `string_${value.length}`;
}

/**
 * Check if a value is null or empty
 */
function isNullOrEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

/**
 * Execute all rules for a CDE and return results
 */
export function executeRulesForCDE(
  cde: CriticalDataElement,
  rules: DataQualityRule[],
  bundle: DataBundle
): DQExecutionResult[] {
  const cdeRules = rules.filter((r) => r.cdeId === cde.id);
  return cdeRules.map((rule) => executeRule({ bundle, cde, rule }));
}

/**
 * Calculate aggregate DQ score for a CDE based on rule results
 */
export function calculateCDEScore(results: DQExecutionResult[], rules: DataQualityRule[]): number {
  if (results.length === 0) return 100;

  // Weight by rule severity
  const severityWeights: Record<string, number> = {
    critical: 3,
    major: 2,
    minor: 1,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const result of results) {
    const rule = rules.find((r) => r.id === result.ruleId);
    if (!rule) continue;

    const weight = severityWeights[rule.severity] || 1;
    totalWeight += weight;
    weightedSum += result.passRate * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 100;
}

/**
 * Calculate aggregate DQ score for a KPI based on its CDEs
 */
export function calculateKPIScore(
  kpiId: string,
  cdes: CriticalDataElement[],
  rules: DataQualityRule[]
): number {
  const kpiCdes = cdes.filter((cde) => cde.kpiIds.includes(kpiId));
  if (kpiCdes.length === 0) return 100;

  const cdeScores: number[] = [];

  for (const cde of kpiCdes) {
    const cdeRules = rules.filter((r) => r.cdeId === cde.id);
    const rulesWithResults = cdeRules.filter((r) => r.lastRunResult);

    if (rulesWithResults.length > 0) {
      const results: DQExecutionResult[] = rulesWithResults.map((r) => ({
        ruleId: r.id,
        cdeId: cde.id,
        totalRecords: r.lastRunResult!.totalRecords,
        passedRecords: r.lastRunResult!.passedRecords,
        failedRecords: r.lastRunResult!.failedRecords,
        passRate: r.lastRunResult!.passRate,
        executedAt: r.lastRunDate || '',
      }));
      cdeScores.push(calculateCDEScore(results, cdeRules));
    }
  }

  return cdeScores.length > 0
    ? cdeScores.reduce((a, b) => a + b, 0) / cdeScores.length
    : 100;
}

/**
 * Calculate aggregate DQ score for an Outcome based on its KPIs
 */
export function calculateOutcomeScore(
  outcomeId: string,
  kpis: import('@/types').KPI[],
  cdes: CriticalDataElement[],
  rules: DataQualityRule[]
): number {
  const outcomeKpis = kpis.filter((kpi) => kpi.outcomeIds.includes(outcomeId));
  if (outcomeKpis.length === 0) return 100;

  const kpiScores = outcomeKpis.map((kpi) => calculateKPIScore(kpi.id, cdes, rules));

  return kpiScores.reduce((a, b) => a + b, 0) / kpiScores.length;
}
