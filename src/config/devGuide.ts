/**
 * Developer & Technical Guide
 *
 * Written by Pedro Cardoso (@dataninja on LinkedIn)
 * A technical deep-dive for developers who want to understand how this app works
 */

export interface DevSection {
  title: string;
  content: string;
  code?: string;
}

export const devGuide: DevSection[] = [
  {
    title: '🎯 Philosophy: Semantic Schemas Over Hard-Coding',
    content: `Hey Data Ninja's! 👋

I'm Pedro, and I built Data Explorer to reimagine what data analysis without friction might look like, with a journey through a visually semantic, ontology minded, graph inspired set of lenses.

This may also form the basis of my Vibing Data Visualization journey series...once I am convinced I have something worth talking through.

For my colleagues at Syniti, I've got some SKP API and graphing POC's that I will soon layer in to get the popcorn popping.  In addition to my own accelerated learning in the first 45 days of 2026, I hope to bring others up along the way, whether Data Engineers, Data Migration Consultants, or anyone interested. I also expect feedback, and to do some silly things, maybe even some dumb ones. I hope I make lots of mistakes because that's how I learn best - hitting the walls at the speed of AI boosted innovation!

This started as a functional location visualization challenge and opportunity at one of our customers, and it led me to think about the concept of Data Products as Data Bundles of content. So on last week I quickly prototyped a utility that runs 100% in a client's browser, that could load up a hierarchy file (any file) and allow the user to dynamically map the schema and start analyzing a complex structure. I'm coding purposely within the limits of a browser now, for more than data security, but to think BIG and DO it KISS simple - that restriction is opening my mind and pushing me into some exciting areas, but I need more inputs from others, and know that I won't gatekeep my knowledge. If I am doing something wrong, great, let's learn to do it better or less wrong!

~16 hours in of time spent, I have more than 10 schema's available, able to be user extended, including adding relationships, with basic data profiling support, stubs of data quality checks, able to summarize and chop up data bundles into smaller data bites for analysis, and after listening to a podcast and reading some medium posts, on Monday night, in the last hour, I added an interoperability layer for local and remote LLM integration.

Some ideas from Thursday - pasted from my notes, needs to be revised:

Instead of hard-coding "name" or "id" columns, I am thinking about **semantic roles**. 
This means the same visualization code works for equipment hierarchies, org charts, file systems, or any tree structure.

Why should you care? Well...glad you asked:  
- Users map their column names to semantic roles (node_id, parent_id, etc.) - whatever they are
- Visualizations work with roles, not specific column names - data types with PURPOSE
- Same code handles FLOC data, SAP tables, or custom datasets - means the user's imagination is the limit!
- No code changes needed for different domains - not quite there yet, but it is stabalizing

Think of it as Dependency Inversion for Data Visualization. Kind of like the Inverted Roof-Water Wicking System, also called the main outdoor Patio on my condo. Except that Inversion failed, and I had 500L of water to deal with, but only 50+L of it got in....yeah..it did.`,
  },

  {
    title: '🏗️ Architecture: React + Zustand + D3',
    content: `The stack is deliberately simple:

**React 18** - Component-based UI, hooks everywhere
**TypeScript** - Type safety for data transformations
**Zustand** - Lightweight state management with localStorage persistence
**D3.js** - Direct DOM manipulation for visualizations (no wrappers!)
**Vite** - Fast dev server and builds
**Tailwind + shadcn/ui** - Dark theme, no custom CSS hell

**Why D3 directly?** Because wrapper libraries are limiting. I want full control over force layouts, transitions, and interactions. React handles the UI shell, D3 owns the SVG.

**Why Zustand?** Redux is overkill. Context API gets messy. Zustand is just right - simple, performant, persistent.`,
  },

  {
    title: '📦 Data Flow: Source → Transform → Visualize',
    content: `Here's how data flows through the app:

**1. Upload (CSV/JSON)**
   - Parse with Papaparse → raw data array
   - Store in DataBundle with source metadata

**2. Column Mapping**
   - User maps CSV columns to semantic roles
   - Stored as ColumnMapping[] in the bundle

**3. Transformation**
   - \`transformToHierarchy()\`, \`transformToNetwork()\`, etc.
   - Input: raw data + mappings
   - Output: visualization-ready structure

**4. Visualization**
   - D3 binds to transformed data
   - Force layouts, scales, interactions
   - React handles controls, legends, overlays

**Key Insight:** Transformations are pure functions. Given the same source + mappings, you get the same output. This makes everything testable and predictable.`,
    code: `// Example transformation signature
function transformToNetwork(
  source: DataSource,
  mappings: ColumnMapping[]
): NetworkData {
  // Extract role mappings
  const sourceMapping = mappings.find(m => m.roleId === 'source_node');
  const targetMapping = mappings.find(m => m.roleId === 'target_node');

  // Build nodes and edges
  const nodes: NetworkNode[] = [...];
  const edges: NetworkEdge[] = [...];

  return { nodes, edges };
}`,
  },

  {
    title: '🎨 The Relationship Types System',
    content: `This is where things get interesting. Network visualizations needed more than just "edges".

**The Problem:** Users wanted semantic meaning on relationships - "this table sources from that table" vs "this table validates that table". Different meanings need different colors, styles, categories.

**The Solution:**
- 172 predefined relationship types (Data Lineage, Quality, Governance, etc.)
- Organized into 15 categories
- Each type has: name, inverse name, description, color, line style
- Stored in \`relationshipTypeConfig\` (Zustand state)
- Persisted to localStorage
- Editable via RelationshipManager UI

**Implementation:**
- \`src/config/relationshipTypes.ts\` - default configuration
- \`transformToNetwork()\` extracts \`relationship_type\` from CSV
- \`NetworkExplorer\` looks up type → applies color/style to edges
- \`getRelationshipType()\` helper for lookup

**Result:** Users can customize colors, add types, and changes apply instantly to visualizations. No rebuild needed.`,
    code: `// Edge styling in NetworkExplorer
.attr('stroke', (d) => {
  if (d.relationshipType) {
    const relType = getRelationshipType(config, d.relationshipType);
    return relType?.color || '#404040';
  }
  return '#404040';
})
.attr('stroke-dasharray', (d) => {
  if (d.relationshipType) {
    const relType = getRelationshipType(config, d.relationshipType);
    if (relType?.lineStyle === 'dashed') return '5,5';
    if (relType?.lineStyle === 'dotted') return '2,3';
  }
  return 'none';
});`,
  },

  {
    title: '🗄️ State Management: Zustand Store',
    content: `The entire app state lives in \`src/store/index.ts\`. It's a single Zustand store with persistence.

**What's in State:**
- \`schemas\` - Available semantic schemas (Hierarchy, Network, Tabular)
- \`bundles\` - Uploaded datasets with mappings
- \`viewMode\` - Current view (bundles, schemas, relationships, explorer)
- \`explorerState\` - Selected bundle, zoom level, focused node, breadcrumb
- \`relationshipTypeConfig\` - Relationship types with visual rules

**Persistence Strategy:**
- Save to localStorage on every state change
- Exclude large raw data (>100KB) and parsed data (>1000 rows)
- Users re-upload large files, mappings are preserved

**Why This Works:**
- Small datasets persist fully (great for demos)
- Large datasets preserve config, not data (prevents localStorage bloat)
- Export/import lets users save complete configs as JSON`,
    code: `// Store usage in components
const bundles = useAppStore((s) => s.bundles);
const addBundle = useAppStore((s) => s.addBundle);

// Update bundle
addBundle({
  id: generateId(),
  name: 'My Dataset',
  schemaId: 'network-default',
  source: { ... },
  mappings: [ ... ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});`,
  },

  {
    title: '📊 Visualization Deep Dive: D3 + React',
    content: `Each visualization is a React component with a D3-controlled SVG.

**Pattern:**
1. \`useRef\` for SVG element
2. \`useMemo\` for data transformation
3. \`useEffect\` for D3 binding with cleanup
4. React state for hovers, selections, UI controls

**Why This Pattern?**
- React owns the component lifecycle
- D3 owns the SVG rendering and interactions
- Clear separation of concerns
- Cleanup prevents memory leaks

**Network Visualization Specifics:**
- Force simulation with collision detection
- Drag behavior on nodes (fixes position on drag)
- Zoom with transform (SVG group)
- Link/node/label groups updated on tick
- Edge colors/styles from relationship types
- Legends for node groups and relationship categories`,
    code: `// D3 in React pattern
useEffect(() => {
  if (!svgRef.current || !data.nodes.length) return;

  const svg = d3.select(svgRef.current);
  svg.selectAll('*').remove(); // Clean slate

  // D3 code here: simulation, forces, bindings
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(width/2, height/2));

  // Cleanup
  return () => {
    simulation.stop();
  };
}, [data, config]); // Re-run when data or config changes`,
  },

  {
    title: '🎯 Schema System: Roles, Not Columns',
    content: `Schemas are defined in \`src/data/schemas.ts\` as arrays of roles.

**Schema Structure:**
- \`id\` - Unique identifier (e.g., 'network-default')
- \`dataType\` - Type of data (hierarchy, tabular, network)
- \`name\` & \`description\` - User-facing labels
- \`roles\` - Array of semantic roles

**Role Properties:**
- \`id\` - Role identifier (e.g., 'source_node')
- \`name\` - Display name ('Source Node')
- \`description\` - Help text
- \`required\` - Whether mapping is mandatory
- \`multiple\` - Can map multiple columns (e.g., metrics)
- \`dataType\` - Expected type (string, number, date, boolean)

**Extensibility:**
Custom schemas can be added via the SchemaManager. The system is designed to support domain-specific schemas (IoT sensors, financial transactions, etc.).`,
    code: `// Example schema definition
{
  id: 'network-default',
  dataType: 'network',
  name: 'Network',
  roles: [
    {
      id: 'source_node',
      name: 'Source Node',
      description: 'Starting node of an edge',
      required: true,
      dataType: 'string',
    },
    {
      id: 'relationship_type',
      name: 'Relationship Type',
      description: 'Semantic type of relationship',
      required: false,
      dataType: 'string',
    },
  ],
}`,
  },

  {
    title: '🔧 Development Setup & Scripts',
    content: `**Prerequisites:**
- Node.js 18+ (or use the shipped HTML directly!)
- pnpm (faster than npm)

**Scripts:**
\`pnpm install\` - Install dependencies
\`pnpm dev\` - Start dev server at localhost:5173
\`pnpm build\` - Production build (TypeScript check + Vite build)
\`pnpm bundle\` - Create single-file artifact (not implemented yet)

**Project Structure:**
\`src/components/app/\` - Application components (BundleManager, Explorer, etc.)
\`src/components/app/visualizations/\` - D3 visualization components
\`src/components/ui/\` - shadcn/ui components (DON'T modify directly)
\`src/config/\` - Configuration (schemas, relationship types, help content)
\`src/lib/\` - Utilities and data transformations
\`src/store/\` - Zustand state management
\`src/types/\` - TypeScript type definitions

**Key Files:**
\`src/data/schemas.ts\` - Default schemas
\`src/config/relationshipTypes.ts\` - Default relationship types
\`src/lib/dataUtils.ts\` - All transformation functions
\`src/store/index.ts\` - Complete app state`,
  },

  {
    title: '🚀 Deployment & Distribution',
    content: `**Single-File Deployment:**
The goal is to ship a single HTML file (with embedded CSS/JS) that users can:
- Save to desktop
- Email around
- Open directly in browser
- No server needed, no npm install

**Current State:**
- \`pnpm build\` creates \`dist/\` folder with separate HTML/CSS/JS
- Sample files in \`dist/samples/\` for offline use
- localStorage persistence means data survives page reloads

**Next Steps:**
- Inline all CSS/JS into single HTML (Vite plugin or post-build script)
- Base64-encode sample files into HTML
- Users can still upload their own CSVs

**Why This Matters:**
Many enterprise environments block npm, require offline tools, or have strict security. A single HTML file bypasses all that. Just open and use.`,
  },

  {
    title: '🎨 Styling Philosophy: No AI Slop',
    content: `I'm allergic to "AI slop" aesthetics - you know, the centered gradients, the excessive blur, the corporate tech bro vibes.

**Data Explorer's Design:**
- Dark theme (zinc-950 background)
- Emerald accents (#10b981) for primary actions
- Left-aligned layouts (no centered content for no reason)
- Dense information (this is for data people, not marketing)
- Functional not decorative
- No gratuitous animations

**Color Palette:**
- Background: zinc-950 (#09090b)
- Cards: zinc-900 (#18181b)
- Borders: zinc-800 (#27272a)
- Text: zinc-100 (light), zinc-400 (muted)
- Primary: emerald-400/500/600
- Secondary: cyan, violet (sparingly)

**Components:**
Using shadcn/ui for consistency, but customized for dark theme. All components in \`src/components/ui/\` are from shadcn - don't edit directly, use Tailwind classes in your components.`,
  },

  {
    title: '🤝 Contributing & Extending',
    content: `Want to add features? Here's how:

**Adding a New Visualization:**
1. Create component in \`src/components/app/visualizations/\`
2. Follow the D3 + React pattern (useRef, useEffect, cleanup)
3. Use \`useMemo\` for data transformation
4. Add toggle to Explorer component

**Adding a New Schema:**
1. Define in \`src/data/schemas.ts\`
2. Create transformation function in \`src/lib/dataUtils.ts\`
3. Add visualization component
4. Update Explorer to handle new dataType

**Adding Relationship Types:**
1. Edit \`src/config/relationshipTypes.ts\`
2. Add to \`defaultRelationshipTypes\` array
3. Assign to a category
4. Define color and lineStyle

**Best Practices:**
- Keep transformations pure (no side effects)
- Use TypeScript strictly (no \`any\` types)
- Follow existing patterns for consistency
- Test with sample datasets
- Update help content in \`src/config/helpContent.ts\`

**Questions?**
Find me on LinkedIn: @pedrocardoso (The Data Ninja)
Or check the repo: github.com/DATAiMatters/DataExplorer`,
  },

  {
    title: '💡 Design Decisions & Trade-offs',
    content: `Every system has trade-offs. Here are the ones I made consciously:

**Client-Side Only:**
✅ No server setup, no deployment headaches
✅ Works offline, portable
❌ Limited to browser memory (~2GB)
❌ No server-side processing for huge datasets

**localStorage Persistence:**
✅ Data survives page reloads
✅ No database needed
❌ 5-10MB limit (hence the >100KB exclusion)

**D3 Direct (No Wrappers):**
✅ Full control over visualizations
✅ Better performance
✅ Easier to debug
❌ Steeper learning curve
❌ More verbose code

**Bundled TypeScript Config (Not External JSON):**
✅ Type-safe, auto-complete in IDE
✅ Tree-shaking (unused types get removed)
❌ Requires rebuild to change help text
❌ Less accessible for non-developers

**Semantic Schemas Over Templates:**
✅ Flexible, reusable across domains
✅ User-controlled mapping
❌ Requires user to understand their data
❌ More complex onboarding

These trade-offs optimize for **flexibility, portability, and control** over convenience.`,
  },
];

export default devGuide;
