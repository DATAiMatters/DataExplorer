import { LineageGraphExplorer } from './visualizations/LineageGraphExplorer';

export function Lineage() {
  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-100">Data Lineage Graph</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Visualize relationships between datasets, schemas, and derived data
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <LineageGraphExplorer />
      </div>
    </div>
  );
}
