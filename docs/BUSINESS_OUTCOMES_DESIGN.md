# Business Outcomes & Data Quality Traceability

## Vision

Connect data quality to business value through a top-down traceability model:

```
Business Outcome → Process Area → KPI/Metric → Critical Data Element → Data Quality Rule
```

## Direction (B + C)

This feature ships in two modes that reinforce each other:

1. **Annotation Layer (B):** Business outcome metadata is attached to existing objects (bundles, columns, lineage nodes). Users can see business context without leaving current workflows.
2. **Outcome Model (C):** A dedicated workspace to author and visualize the end-to-end traceability chain and its health.

Both modes read/write the same underlying entities and links. The Outcome Model is the canonical source; annotations are "views" over it.

This enables:
- **Prioritization**: Know which data quality issues matter based on business impact
- **Justification**: Clear ROI linkage for data quality investment
- **Root Cause Analysis**: Trace KPI issues back to data quality problems
- **Semantic Richness**: Capture the "why" behind data quality rules

Guiding principles:
- **Outcome-first**: Users start from business outcomes and drill down.
- **Executable future**: Rule definitions are saved in an engine-ready shape.
- **Explainable traceability**: Every link has a rationale and impact type.
- **Minimal friction**: Annotation layer works even if the full model is not built yet.

## Core Entities

### 1. Business Outcome
The strategic goal or result the organization wants to achieve.

```typescript
interface BusinessOutcome {
  id: string;
  name: string;                    // e.g., "Minimize Unplanned Downtime"
  description: string;
  category: 'financial' | 'operational' | 'compliance' | 'customer' | 'safety';
  owner?: string;                  // Accountable person/role
  targetValue?: string;            // e.g., "< 2% unplanned downtime"
  status?: 'draft' | 'active' | 'deprecated';
  tags?: string[];
  processAreaIds: string[];        // Links to process areas
  createdAt: string;
  updatedAt: string;
}
```

### 2. Process Area
High-level business process groupings (e.g., SAP process areas).

```typescript
interface ProcessArea {
  id: string;
  code: string;                    // e.g., "ATR", "PTP", "OTC"
  name: string;                    // e.g., "Acquire to Retire", "Procure to Pay"
  description: string;
  owner?: string;
  subProcesses: SubProcess[];
}

interface SubProcess {
  id: string;
  code: string;
  name: string;
  description: string;
  owner?: string;
  kpiIds: string[];                // Links to KPIs
}
```

### 3. KPI / Metric
Measurable indicators tied to business outcomes.

```typescript
interface KPI {
  id: string;
  name: string;                    // e.g., "Mean Time Between Failures (MTBF)"
  description: string;
  formula?: string;                // e.g., "Operating Time / Number of Failures"
  unit: string;                    // e.g., "hours", "percentage", "count"
  direction: 'higher_is_better' | 'lower_is_better' | 'target_range';
  targetValue?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  frequency: 'real-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  owner?: string;
  status?: 'draft' | 'active' | 'deprecated';
  calculationWindow?: string;      // e.g., "last_30_days", "month_to_date"
  outcomeIds: string[];            // Links to business outcomes
  processAreaId?: string;          // Link to process area
  cdeIds: string[];                // Links to critical data elements
  createdAt: string;
  updatedAt: string;
}
```

### 4. Critical Data Element (CDE)
Data fields that directly impact KPI calculations or business decisions.

```typescript
interface CriticalDataElement {
  id: string;
  name: string;                    // e.g., "Last Maintenance Date"
  description: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  businessDefinition: string;      // What does this field mean to the business?
  sourceSystem?: string;           // e.g., "SAP PM", "Maximo"
  sourceTable?: string;
  sourceColumn?: string;
  owner?: string;
  status?: 'draft' | 'active' | 'deprecated';

  // Links to datasets in Data Explorer
  bundleId?: string;               // Link to a data bundle
  columnName?: string;             // Column in that bundle

  kpiIds: string[];                // Which KPIs depend on this element
  dqRuleIds: string[];             // Which DQ rules govern this element
  createdAt: string;
  updatedAt: string;
}
```

### 5. Data Quality Rule
Rules that validate data quality for critical data elements.

```typescript
interface DataQualityRule {
  id: string;
  name: string;                    // e.g., "Maintenance Date Not Null"
  description: string;
  cdeId: string;                   // Link to CDE this rule validates

  // Rule definition
  ruleType: 'completeness' | 'validity' | 'consistency' | 'timeliness' | 'uniqueness' | 'accuracy';
  expression?: string;             // e.g., "value IS NOT NULL", "value > 0"
  expectedPattern?: string;        // Regex for format validation
  referenceDataset?: string;       // For referential integrity checks
  executionEngine?: 'none' | 'sql' | 'great_expectations' | 'custom';
  status?: 'draft' | 'active' | 'deprecated';

  // Severity and thresholds
  severity: 'critical' | 'major' | 'minor';
  passThreshold: number;           // % that must pass (e.g., 99.5)

  // Execution (future)
  isExecutable: boolean;           // Can be run against data
  lastRunDate?: string;
  lastRunResult?: {
    totalRecords: number;
    passedRecords: number;
    failedRecords: number;
    passRate: number;
  };

  createdAt: string;
  updatedAt: string;
}
```

## Traceability Links (Optional but Recommended)

Links encode the "why" behind relationships and allow weighted rollups.

```typescript
interface TraceLink {
  id: string;
  fromId: string;
  toId: string;
  linkType: 'outcome_kpi' | 'kpi_cde' | 'cde_rule' | 'outcome_process' | 'process_kpi';
  rationale?: string;              // e.g., "MTBF drives uptime target"
  impactType?: 'cost' | 'risk' | 'availability' | 'compliance' | 'experience';
  weight?: number;                 // 0-1 for rollup scoring
  confidence?: number;             // 0-1 confidence in linkage
  createdAt: string;
  updatedAt: string;
}
```

## Data Model Relationships

```
┌─────────────────────┐
│  Business Outcome   │
│  (Strategic Goal)   │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│    Process Area     │
│  (ATR, PTP, OTC)    │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│    Sub-Process      │
│ (Detailed Process)  │
└──────────┬──────────┘
           │ N:M
           ▼
┌─────────────────────┐
│    KPI / Metric     │◄────────────────┐
│   (MTBF, OEE, etc)  │                 │
└──────────┬──────────┘                 │
           │ N:M                        │
           ▼                            │
┌─────────────────────┐         ┌───────┴───────┐
│ Critical Data       │         │ Data Bundle   │
│ Element (CDE)       │────────►│ (Dataset)     │
└──────────┬──────────┘         └───────────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│  Data Quality Rule  │
│   (Validation)      │
└─────────────────────┘
```

## UI Design

### New Nav Item: "Business Outcomes" (Target icon)

#### View 1: Outcome Canvas (Network Graph)
- Visual graph showing Outcome → KPI → CDE → DQ Rule relationships
- Color-coded nodes by entity type
- Click to drill into details
- Filter by process area, outcome category, etc.
- Optional edge weights and "impact type" badges on links

#### View 2: Outcome List
- Card-based view of all business outcomes
- Quick stats: # KPIs, # CDEs, # DQ Rules, Overall DQ Score
- Search and filter capabilities

#### View 3: KPI Dashboard
- List of KPIs with current DQ posture
- Red/Yellow/Green indicators based on DQ rule pass rates
- Drill-down to see which CDEs/rules are failing
- Show KPI formula, target, and calculation window

#### View 4: CDE Registry
- Master list of Critical Data Elements
- Links to datasets (bundles) in Data Explorer
- DQ rule status for each CDE
- "Mark as CDE" shortcut from column profiling

#### View 5: Rule Library (Future)
- Manage reusable DQ rule templates
- Toggle execution engine and rule status

### Integration with Existing Features

1. **Column Annotations**: In tabular profiling view, allow marking a column as a CDE
2. **Lineage Graph**: Overlay outcome/KPI badges on lineage nodes
3. **Data Quality**: Existing DQ scoring now has business context
4. **Journal**: Link journal entries to outcomes/KPIs
5. **Joins**: When a join creates a derived dataset, inherit CDE links by column

## Implementation Phases

### Phase 1: Foundation (Manual Entry)
- [ ] Define TypeScript interfaces for all entities
- [ ] Add entities to Zustand store with CRUD operations
- [ ] Create Business Outcomes nav item and basic list view
- [ ] Create forms to manually add Outcomes, KPIs, CDEs, DQ Rules
- [ ] Simple card-based visualization of the hierarchy
- [ ] Seed sample outcomes/KPIs to demonstrate flow

### Phase 2: Linking
- [ ] Link CDEs to existing bundle columns
- [ ] Show CDE context in tabular profiling view
- [ ] Basic Outcome → DQ Rule traceability graph

### Phase 3: DQ Integration
- [ ] Execute simple DQ rules against linked datasets
- [ ] Display DQ results in KPI context
- [ ] Aggregate DQ scores by KPI and Outcome
- [ ] Weighted rollups via TraceLinks (impact-aware scoring)

### Phase 4: Import/Export
- [ ] Import KPI definitions from CSV/JSON
- [ ] Import process area templates (SAP, etc.)
- [ ] Export outcome model for documentation

### Phase 5: Advanced Visualization
- [ ] Full interactive network graph of outcome model
- [ ] Impact analysis: "If this CDE has issues, which outcomes are affected?"
- [ ] Time-series DQ trending by outcome
- [ ] Rule execution history with trend overlays

## Outcome Scoring (Concept)

1. **Rule pass rate** drives a CDE score (weighted by rule severity).
2. **CDE score** rolls into KPI score (weighted by CDE importance).
3. **KPI score** rolls into Outcome score (weighted by KPI impact).

This keeps the signal explainable and lets the business tune weights instead of relying on opaque algorithms.

## Data Import Templates (Future)

- **KPIs**: CSV with columns `id,name,description,unit,direction,formula,frequency,targetValue,processAreaId,outcomeIds`
- **CDEs**: CSV with columns `id,name,description,dataType,businessDefinition,sourceSystem,sourceTable,sourceColumn`
- **DQ Rules**: CSV with columns `id,name,description,cdeId,ruleType,expression,severity,passThreshold,isExecutable`

## Sample Process Areas (Seed Data)

```typescript
const sampleProcessAreas: ProcessArea[] = [
  {
    id: 'atr',
    code: 'ATR',
    name: 'Acquire to Retire',
    description: 'Asset lifecycle management from acquisition through disposal',
    subProcesses: [
      { id: 'atr-1', code: 'ATR-1', name: 'Asset Acquisition', description: 'Purchasing and capitalizing new assets', kpiIds: [] },
      { id: 'atr-2', code: 'ATR-2', name: 'Asset Maintenance', description: 'Preventive and corrective maintenance', kpiIds: [] },
      { id: 'atr-3', code: 'ATR-3', name: 'Asset Retirement', description: 'Disposal and write-off of assets', kpiIds: [] },
    ],
  },
  {
    id: 'ptp',
    code: 'PTP',
    name: 'Procure to Pay',
    description: 'End-to-end procurement and payment process',
    subProcesses: [
      { id: 'ptp-1', code: 'PTP-1', name: 'Requisition', description: 'Creating and approving purchase requests', kpiIds: [] },
      { id: 'ptp-2', code: 'PTP-2', name: 'Purchase Order', description: 'Creating and managing POs', kpiIds: [] },
      { id: 'ptp-3', code: 'PTP-3', name: 'Goods Receipt', description: 'Receiving and inspecting goods', kpiIds: [] },
      { id: 'ptp-4', code: 'PTP-4', name: 'Invoice Processing', description: 'Matching and processing invoices', kpiIds: [] },
      { id: 'ptp-5', code: 'PTP-5', name: 'Payment', description: 'Executing payments to vendors', kpiIds: [] },
    ],
  },
  {
    id: 'otc',
    code: 'OTC',
    name: 'Order to Cash',
    description: 'Sales order processing through cash collection',
    subProcesses: [
      { id: 'otc-1', code: 'OTC-1', name: 'Order Management', description: 'Sales order entry and fulfillment', kpiIds: [] },
      { id: 'otc-2', code: 'OTC-2', name: 'Shipping', description: 'Picking, packing, and delivery', kpiIds: [] },
      { id: 'otc-3', code: 'OTC-3', name: 'Invoicing', description: 'Customer billing', kpiIds: [] },
      { id: 'otc-4', code: 'OTC-4', name: 'Collections', description: 'Accounts receivable and cash application', kpiIds: [] },
    ],
  },
  {
    id: 'rtc',
    code: 'RTC',
    name: 'Record to Close',
    description: 'Financial accounting and period close',
    subProcesses: [
      { id: 'rtc-1', code: 'RTC-1', name: 'Journal Entries', description: 'Recording financial transactions', kpiIds: [] },
      { id: 'rtc-2', code: 'RTC-2', name: 'Reconciliations', description: 'Account reconciliation', kpiIds: [] },
      { id: 'rtc-3', code: 'RTC-3', name: 'Period Close', description: 'Month/quarter/year end close', kpiIds: [] },
      { id: 'rtc-4', code: 'RTC-4', name: 'Reporting', description: 'Financial and management reporting', kpiIds: [] },
    ],
  },
];
```

## Sample KPIs (Seed Data)

```typescript
const sampleKPIs: KPI[] = [
  {
    id: 'mtbf',
    name: 'Mean Time Between Failures (MTBF)',
    description: 'Average operating time between equipment failures',
    formula: 'Total Operating Time / Number of Failures',
    unit: 'hours',
    direction: 'higher_is_better',
    frequency: 'monthly',
    outcomeIds: [],
    processAreaId: 'atr',
    cdeIds: [],
  },
  {
    id: 'mttr',
    name: 'Mean Time To Repair (MTTR)',
    description: 'Average time to restore equipment to operational status',
    formula: 'Total Repair Time / Number of Repairs',
    unit: 'hours',
    direction: 'lower_is_better',
    frequency: 'monthly',
    outcomeIds: [],
    processAreaId: 'atr',
    cdeIds: [],
  },
  {
    id: 'pm-compliance',
    name: 'PM Compliance Rate',
    description: 'Percentage of preventive maintenance completed on schedule',
    formula: '(PM Work Orders Completed On Time / Total PM Work Orders) × 100',
    unit: 'percentage',
    direction: 'higher_is_better',
    targetValue: 95,
    warningThreshold: 90,
    criticalThreshold: 85,
    frequency: 'weekly',
    outcomeIds: [],
    processAreaId: 'atr',
    cdeIds: [],
  },
  {
    id: 'invoice-accuracy',
    name: 'Invoice Accuracy Rate',
    description: 'Percentage of invoices processed without errors',
    formula: '(Invoices Without Errors / Total Invoices) × 100',
    unit: 'percentage',
    direction: 'higher_is_better',
    targetValue: 99,
    frequency: 'monthly',
    outcomeIds: [],
    processAreaId: 'ptp',
    cdeIds: [],
  },
];
```

## Success Metrics

1. **User can define** a business outcome and trace it to specific data columns
2. **DQ issues are prioritized** based on business impact (linked to outcomes)
3. **Stakeholders understand** why data quality matters (business context)
4. **Root cause analysis** is possible when KPIs are off-target
5. **Outcome model stays current** with minimal overhead (annotation + import)

---

*Design created: January 19, 2026*
*Status: Proposed - Pending implementation*
