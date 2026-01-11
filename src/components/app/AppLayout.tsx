import { useAppStore } from '@/store';
import { Sidebar } from './Sidebar';
import { BundleManager } from './BundleManager';
import { SchemaManager } from './SchemaManager';
import { Explorer } from './Explorer';

export function AppLayout() {
  const viewMode = useAppStore((s) => s.viewMode);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {viewMode === 'bundles' && <BundleManager />}
        {viewMode === 'schemas' && <SchemaManager />}
        {viewMode === 'explorer' && <Explorer />}
      </main>
    </div>
  );
}
