# CLAUDE.md - Instructions for Claude Code

> ⚠️ **START OF SESSION:** Read `docs/PROJECT_CONTEXT.md` before making significant changes.
> 
> **END OF SESSION:** Update `docs/PROJECT_CONTEXT.md` if you made architectural decisions, added features, or changed the roadmap.

This file provides context for Claude Code when working on this project.

## Quick Start

```bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server at localhost:5173
pnpm build      # Production build (also runs typecheck)
pnpm bundle     # Create single-file HTML artifact
```

## Important: Read the Project Context

**Before making significant changes, read `/docs/PROJECT_CONTEXT.md`** - it contains:
- The purpose and target users
- Key design decisions and WHY they were made
- Trade-offs we accepted
- Roadmap and future plans

This prevents re-litigating decisions or introducing inconsistencies.

## Project Overview

Data Explorer is a React + TypeScript application for visualizing hierarchical, tabular, and network data. Users upload CSV/JSON files, map columns to semantic roles, and explore data through interactive visualizations.

**Primary use case:** Exploring FLOC (Functional Location) hierarchies and related data from ERP systems like SAP PM.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** + **shadcn/ui** for styling
- **D3.js** for visualizations (direct use, not wrapped libraries)
- **Zustand** for state management
- **Papaparse** for CSV parsing

## Key Directories

```
src/
├── components/app/          # Application components
│   └── visualizations/      # D3-based visualizations
├── components/ui/           # shadcn/ui components (don't modify directly)
├── data/                    # Default schemas
├── lib/                     # Utilities and data transformation
├── store/                   # Zustand store
└── types/                   # TypeScript types
```

## Architecture Principles

1. **Semantic Schema System** - Data columns map to roles, not hardcoded field names
2. **Data Bundles** - Self-contained packages of data + mappings + metadata
3. **Pluggable Visualizations** - Each data type has independent viz components
4. **Client-side Only** - No server, localStorage for persistence

## Common Tasks

### Adding a new visualization option
1. Create component in `src/components/app/visualizations/`
2. Add to the toggle in the relevant Explorer component
3. Implement the D3 visualization logic

### Adding a new semantic role
1. Update schema in `src/data/schemas.ts`
2. Update transformation in `src/lib/dataUtils.ts` if needed

### Modifying state
- All state is in `src/store/index.ts`
- Uses Zustand with localStorage persistence
- Access pattern: `const foo = useAppStore((s) => s.foo)`

## Code Patterns

### State access in components
```typescript
const bundles = useAppStore((s) => s.bundles);
const addBundle = useAppStore((s) => s.addBundle);
```

### Data transformation
```typescript
const hierarchyData = useMemo(() => {
  return transformToHierarchy(bundle.source, bundle.mappings);
}, [bundle]);
```

### D3 in React
- Use `useRef` for SVG elements
- `useEffect` for D3 bindings with cleanup
- `useMemo` for data transformations
- Let React handle the DOM where possible, D3 for bindings

## Testing

Currently manual testing. To test:
1. Upload each sample file from `/public/samples/`
2. Verify all visualizations render correctly
3. Test reload functionality
4. Check localStorage persistence (refresh page)
5. Test edge cases (empty data, missing columns)

## Known Limitations

- Large datasets (>50k rows) may be slow
- localStorage has size limits (~5-10MB)
- Network viz CPU-intensive with many nodes

## Style Guide

- Dark theme (zinc-950 background, emerald accents)
- Avoid "AI slop" aesthetics (no gratuitous gradients, centered everything)
- Use existing shadcn components where possible
- Keep visualizations interactive (hover states, drill-down)

## When in Doubt

1. Check `/docs/PROJECT_CONTEXT.md` for decision history
2. Check `/docs/ARCHITECTURE.md` for technical patterns
3. Look at existing similar code in the codebase
4. Prefer consistency with existing patterns over "better" new approaches
