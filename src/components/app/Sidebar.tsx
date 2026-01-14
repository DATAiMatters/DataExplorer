import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { Database, Layers, Compass, Download, Upload, GitBranch, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VERSION, BUILD_DATE } from '@/version';
import type { ViewMode } from '@/types';

const navItems: { mode: ViewMode; icon: typeof Database; label: string }[] = [
  { mode: 'bundles', icon: Database, label: 'Data Bundles' },
  { mode: 'schemas', icon: Layers, label: 'Semantic Schemas' },
  { mode: 'relationships', icon: GitBranch, label: 'Relationships' },
  { mode: 'explorer', icon: Compass, label: 'Explorer' },
  { mode: 'journal', icon: BookOpen, label: 'Journal' },
  { mode: 'ai-settings', icon: Sparkles, label: 'AI Integration' },
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
        // Warn about large files (75MB threshold)
        if (file.size > 75 * 1024 * 1024) {
          const sizeMB = (file.size / 1024 / 1024).toFixed(1);
          if (!confirm(`Large file detected: ${sizeMB}MB. This may slow down your browser. Continue?`)) {
            return;
          }
        }

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
        {/* Logo - Data Visualization Icon */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mb-4 relative overflow-hidden">
          {/* Tree/hierarchy visualization icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
            {/* Root node */}
            <circle cx="12" cy="4" r="2" fill="white" opacity="0.9" />
            {/* Connecting lines */}
            <path d="M12 6 L12 10" stroke="white" strokeWidth="1.5" opacity="0.6" />
            <path d="M12 10 L7 14" stroke="white" strokeWidth="1.5" opacity="0.6" />
            <path d="M12 10 L17 14" stroke="white" strokeWidth="1.5" opacity="0.6" />
            {/* Child nodes */}
            <circle cx="7" cy="15" r="1.5" fill="white" opacity="0.8" />
            <circle cx="17" cy="15" r="1.5" fill="white" opacity="0.8" />
            {/* Grandchild nodes */}
            <path d="M7 16.5 L5 19" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <path d="M7 16.5 L9 19" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <circle cx="5" cy="20" r="1.2" fill="white" opacity="0.7" />
            <circle cx="9" cy="20" r="1.2" fill="white" opacity="0.7" />
          </svg>
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
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

        {/* Version Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mt-2 px-2 py-1 text-xs text-zinc-600 hover:text-zinc-400 cursor-default transition-colors">
              v{VERSION}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <div className="text-xs space-y-1">
              <div className="font-semibold">Data Explorer v{VERSION}</div>
              <div className="text-zinc-400">
                Built: {new Date(BUILD_DATE).toUTCString()}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}
