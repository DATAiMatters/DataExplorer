import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';
import * as fs from 'fs';

// Helper to create a styled table
function createTable(headers, rows) {
  const headerCells = headers.map(
    (h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: '2d3748' },
      })
  );

  const tableRows = [
    new TableRow({ children: headerCells }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph(cell)],
              })
          ),
        })
    ),
  ];

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// Helper for code blocks
function codeBlock(code) {
  return new Paragraph({
    children: [
      new TextRun({
        text: code,
        font: 'Courier New',
        size: 18,
      }),
    ],
    spacing: { before: 100, after: 100 },
    shading: { fill: 'f0f0f0' },
  });
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: 'DataExplorer Technical Architecture',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: 'Technical Overview for Data Engineering Team',
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        // Tech Stack Overview
        new Paragraph({
          text: 'Tech Stack Overview',
          heading: HeadingLevel.HEADING_1,
        }),
        createTable(
          ['Layer', 'Technology', 'Purpose'],
          [
            ['Frontend', 'React 18 + TypeScript', 'UI components and state management'],
            ['Build Tool', 'Vite', 'Fast dev server with HMR, production bundling'],
            ['Styling', 'Tailwind CSS + shadcn/ui', 'Dark theme, consistent component library'],
            ['Visualization', 'D3.js', 'Force-directed graph, interactive canvas'],
            ['State', 'Zustand', 'Lightweight state management with localStorage persistence'],
            ['API Server', 'Hono (Node.js)', 'Lightweight, fast API framework (Express alternative)'],
            ['Graph Database', 'Neo4j', 'Stores traceability graph (nodes + relationships)'],
            ['External API', 'Syniti SKP', 'Source catalog for terms, datasets, rules, policies'],
          ]
        ),

        // Neo4j Integration
        new Paragraph({
          text: 'Neo4j Integration',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),

        new Paragraph({
          text: 'Connection Setup (server/lib/neo4j.ts)',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Uses a singleton driver pattern - one connection pool shared across all requests:', italics: true }),
          ],
        }),
        codeBlock(`const driver = neo4j.driver(
  process.env.NEO4J_URI,      // bolt://host:7687
  neo4j.auth.basic(user, password)
);`),

        new Paragraph({
          text: 'Data Model - Extended Traceability Chain',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Goal', bold: true }),
            new TextRun(' → '),
            new TextRun({ text: 'KPI', bold: true }),
            new TextRun(' → '),
            new TextRun({ text: 'Decision', bold: true }),
            new TextRun(' → '),
            new TextRun({ text: 'Signal', bold: true }),
            new TextRun(' → '),
            new TextRun({ text: 'Rule', bold: true }),
            new TextRun(' → '),
            new TextRun({ text: 'DataProduct', bold: true }),
            new TextRun(' → '),
            new TextRun({ text: 'Dataset', bold: true }),
          ],
          spacing: { before: 100, after: 200 },
        }),
        new Paragraph({
          text: 'Each node type has a Neo4j label (:Goal, :KPI, :Decision, etc.) and properties like id, name, source, imported_at.',
        }),

        // API Endpoints
        new Paragraph({
          text: 'Key API Endpoints',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        createTable(
          ['Endpoint', 'Method', 'Purpose'],
          [
            ['/api/graph', 'GET', 'Fetch nodes + relationships with filtering'],
            ['/api/outcome-graph-import', 'POST', 'Import JSON graph into Neo4j'],
            ['/api/skp-import', 'GET', 'Pull from Syniti SKP API → Neo4j'],
            ['/api/health', 'GET', 'Check Neo4j + SKP connectivity'],
          ]
        ),

        // Query Pattern
        new Paragraph({
          text: 'Query Pattern (server/routes/graph.ts)',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        codeBlock(`-- Fetch nodes with optional label/source filtering
MATCH (n:PTP_Demo) WHERE n.source = 'ptp-sample'
RETURN n LIMIT 500

-- Fetch relationships between matched nodes
MATCH (n)-[r]->(m) WHERE id(n) IN $nodeIds AND id(m) IN $nodeIds
RETURN n, r, m`),

        // Data Segregation
        new Paragraph({
          text: 'Data Segregation Strategy',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '• source property: ', bold: true }),
            new TextRun("Identifies import origin (e.g., 'ptp-sample', 'skp')"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '• Custom labels: ', bold: true }),
            new TextRun('Additional Neo4j label per import (e.g., :PTP_Demo, :SKP_Prod)'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '• Benefit: ', bold: true }),
            new TextRun('Allows filtering different datasets without separate databases'),
          ],
        }),

        // Import Flow
        new Paragraph({
          text: 'Import Flow',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),

        new Paragraph({
          text: 'PTP Sample Import',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '1. Frontend fetches /samples/ptp-business-outcome-graph.json' }),
        new Paragraph({ text: '2. POST to /api/outcome-graph-import with JSON body' }),
        new Paragraph({ text: '3. Server iterates assets (goals, kpis, decisions, signals, rules, dataProducts, datasets)' }),
        new Paragraph({ text: '4. MERGE each node into Neo4j (upsert pattern)' }),
        new Paragraph({ text: '5. Create relationships with dynamic types (ISMEASUREDBY, PROTECTS, DEGRADES, etc.)' }),
        new Paragraph({ text: '6. Return summary with success/failure counts' }),

        new Paragraph({
          text: 'SKP Import',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        new Paragraph({ text: '1. GET /api/skp-import triggers fetch from Syniti API' }),
        new Paragraph({ text: '2. Paginated fetch of terms, datasets, rules, policies, goals, systems' }),
        new Paragraph({ text: "3. MERGE each into Neo4j with source='skp' tag" }),
        new Paragraph({ text: '4. Create RELATES_TO relationships from term.relationships' }),

        // Frontend Visualization
        new Paragraph({
          text: 'Frontend Visualization',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),

        new Paragraph({
          text: 'D3 Force Graph (OutcomeCanvas.tsx)',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '• Force simulation with configurable link strength and charge' }),
        new Paragraph({ text: '• Node size based on connection degree' }),
        new Paragraph({ text: '• Color-coded by type (Goal=emerald, KPI=blue, Decision=orange, Signal=yellow, Rule=violet, DataProduct=cyan, Dataset=indigo)' }),
        new Paragraph({ text: '• Health indicator rings (green/amber/red based on DQ score or signal state)' }),
        new Paragraph({ text: '• Zoom/pan with d3-zoom' }),
        new Paragraph({ text: '• Click to trace path to root outcome' }),

        new Paragraph({
          text: 'Data Flow',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        }),
        codeBlock('Neo4j → /api/graph → React state → D3 simulation → SVG rendering'),

        // Development Workflow
        new Paragraph({
          text: 'Development Workflow',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),
        codeBlock(`# Terminal 1: Vite frontend (hot reload)
pnpm dev          # localhost:5173

# Terminal 2: Hono API server
pnpm api:dev      # localhost:3001

# Vite proxies /api/* → Hono server`),

        // Why These Choices
        new Paragraph({
          text: 'Why These Technology Choices?',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),
        createTable(
          ['Choice', 'Rationale'],
          [
            ['Neo4j', 'Native graph traversal for traceability queries; Cypher is expressive for relationship patterns'],
            ['Hono', 'Faster than Express, modern API design, easy to embed in Electron later'],
            ['D3.js', 'Full control over visualization; force-directed layout ideal for relationship graphs'],
            ['Zustand', 'Simpler than Redux, built-in persistence, no boilerplate'],
            ['Source/Label filtering', 'Allows multi-tenant or multi-environment data in single Neo4j instance'],
          ]
        ),

        // Node Types Table
        new Paragraph({
          text: 'Extended Schema - Node Types',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),
        createTable(
          ['Node Type', 'Description', 'Key Properties'],
          [
            ['Goal', 'Business outcomes to achieve', 'name, description, category, owner, targetValue'],
            ['KPI', 'Key Performance Indicators', 'name, formula, unit, direction, targetValue, thresholds'],
            ['Decision', 'Action points that protect goals', 'name, ownerRole, system, touchpoint, cadence, criticality'],
            ['Signal', 'Health indicators that can degrade decisions', 'name, state (HEALTHY/WARNING/CRITICAL), valueImpactBand, riskDrivers'],
            ['Rule', 'Data quality rules', 'name, ruleType, expression, severity, passThreshold, lastRunResult'],
            ['DataProduct', 'Logical data products combining datasets', 'name, grain, primaryKey, fields, objectFamily, contractStability'],
            ['Dataset', 'Physical source datasets', 'name, system, tableName, fieldCount'],
          ]
        ),

        // Relationship Types
        new Paragraph({
          text: 'Relationship Types',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),
        createTable(
          ['Relationship', 'From → To', 'Meaning'],
          [
            ['ISMEASUREDBY', 'Goal → KPI', 'Goal is measured by this KPI'],
            ['PROTECTS', 'Decision → Goal', 'Decision protects this goal'],
            ['DEGRADES', 'Signal → Decision', 'Signal can degrade this decision'],
            ['ISDERIVEDFROM', 'Signal → Rule', 'Signal state derived from rule results'],
            ['VALIDATES', 'Rule → DataProduct', 'Rule validates this data product'],
            ['USES', 'DataProduct → Dataset', 'Data product uses this source dataset'],
          ]
        ),

        // Footer
        new Paragraph({
          text: 'Generated for DataExplorer v0.5.0',
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
          children: [
            new TextRun({
              text: 'Generated for DataExplorer v0.5.0',
              italics: true,
              color: '666666',
            }),
          ],
        }),
      ],
    },
  ],
});

// Generate and save the document
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('docs/DataExplorer-Technical-Architecture.docx', buffer);
console.log('Document created: docs/DataExplorer-Technical-Architecture.docx');
