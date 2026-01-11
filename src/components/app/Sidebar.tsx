import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { Database, Layers, Compass, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ViewMode } from '@/types';

const navItems: { mode: ViewMode; icon: typeof Database; label: string }[] = [
  { mode: 'bundles', icon: Database, label: 'Data Bundles' },
  { mode: 'schemas', icon: Layers, label: 'Semantic Schemas' },
  { mode: 'explorer', icon: Compass, label: 'Explorer' },
];

export function Sidebar() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);

  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-explorer-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          importConfig(text);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-2">
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mb-4">
          <span className="text-lg font-bold text-white">DE</span>
        </div>

        <Separator className="w-8 bg-zinc-800" />

        {/* Navigation */}
        <nav className="flex flex-col gap-1 mt-2">
          {navItems.map(({ mode, icon: Icon, label }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'w-10 h-10 rounded-lg transition-all',
                    viewMode === mode
                      ? 'bg-zinc-800 text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                  )}
                  onClick={() => setViewMode(mode)}
                >
                  <Icon className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

        <div className="flex-1" />

        <Separator className="w-8 bg-zinc-800" />

        {/* Import/Export */}
        <div className="flex flex-col gap-1 mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
                onClick={handleImport}
              >
                <Upload className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Import Config
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
                onClick={handleExport}
              >
                <Download className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Export Config
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
