# Contributing to Data Explorer

Thank you for your interest in contributing! Here's how you can help.

**Maintainer:** Pedro Cardoso - The Data Ninja
📧 mrtechie@gmail.com | 💼 [LinkedIn](https://www.linkedin.com/in/thedataninja/) | 🔗 [Linktree](https://linktr.ee/thedataninja)

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Start dev server: `pnpm dev`
4. Make your changes
5. Run type checking: `pnpm build`
6. Submit a pull request

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use meaningful variable and function names
- Add comments for complex logic

## Component Guidelines

### App Components (`src/components/app/`)
- Business logic and application-specific UI
- Use Zustand store for state management
- Keep visualization logic in the `visualizations/` subfolder

### UI Components (`src/components/ui/`)
- Reusable, stateless components from shadcn/ui
- Don't modify these directly - they're managed by shadcn

## Adding New Features

### New Visualization Type
1. Add type to `src/types/index.ts`
2. Create schema in `src/data/schemas.ts`
3. Add transformation function in `src/lib/dataUtils.ts`
4. Create visualization component in `src/components/app/visualizations/`
5. Wire it up in `Explorer.tsx`

### New Semantic Role
1. Add to appropriate schema in `src/data/schemas.ts`
2. Update transformation functions if needed
3. Update documentation

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Ensure the build passes (`pnpm build`)
4. Update README if adding new features
5. Submit PR with description of changes

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include browser/Node version
- Attach sample data if relevant (anonymized)

## Questions?

Open a GitHub Discussion or reach out to the maintainers.
