import { useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { parseFile } from '@/lib/dataUtils';
import { HierarchyExplorer } from './visualizations/HierarchyExplorer';
import { TabularExplorer } from './visualizations/TabularExplorer';
import { NetworkExplorer } from './visualizations/NetworkExplorer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Compass, RefreshCw, Upload } from 'lucide-react';

export function Explorer() {
  const bundles = useAppStore((s) => s.bundles);
  const schemas = useAppStore((s) => s.schemas);
  const selectedBundleId = useAppStore((s) => s.explorerState.selectedBundleId);
  const setSelectedBundle = useAppStore((s) => s.setSelectedBundle);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const updateBundle = useAppStore((s) => s.updateBundle);

  const [isReloading, setIsReloading] = useState(false);

  const selectedBundle = bundles.find((b) => b.id === selectedBundleId);
  const selectedSchema = selectedBundle
    ? schemas.find((s) => s.id === selectedBundle.schemaId)
    : null;

  const handleReloadFile = useCallback((file: File) => {
    if (!selectedBundle) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawData = ev.target?.result as string;
      try {
        const { data, columns } = parseFile(file.name, rawData);
        
        // Update the bundle with new data, keeping existing mappings that still apply
        const validMappings = selectedBundle.mappings.filter(m => columns.includes(m.sourceColumn));
        
        updateBundle(selectedBundle.id, {
          source: {
            type: file.name.endsWith('.json') ? 'json' : 'csv',
            fileName: file.name,
            rawData,
            parsedData: data,
            columns,
          },
          mappings: validMappings,
        });
        
        setIsReloading(false);
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    };
    reader.readAsText(file);
  }, [selectedBundle, updateBundle]);

  // No bundle selected - show selection prompt
  if (!selectedBundle) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
          <Compass className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">Select a Data Bundle</h2>
        <p className="text-zinc-500 text-center max-w-md mb-6">
          Choose a bundle to explore, or go back to create one if you haven't yet.
        </p>

        {bundles.length > 0 ? (
          <div className="w-full max-w-sm space-y-4">
            <Select onValueChange={setSelectedBundle}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Select a bundle..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {bundles.map((bundle) => {
                  const schema = schemas.find((s) => s.id === bundle.schemaId);
                  return (
                    <SelectItem key={bundle.id} value={bundle.id}>
                      <span>{bundle.name}</span>
                      <span className="text-zinc-500 ml-2 text-xs">({schema?.dataType})</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Button
            onClick={() => setViewMode('bundles')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Create Your First Bundle
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedBundle(null)}
          className="text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1">
          <h1 className="text-lg font-semibold">{selectedBundle.name}</h1>
          <p className="text-xs text-zinc-500">
            {selectedSchema?.name} • {selectedBundle.source.parsedData.length} records • {selectedBundle.source.fileName}
          </p>
        </div>

        <Dialog open={isReloading} onOpenChange={setIsReloading}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 hover:bg-zinc-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Data
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Reload Bundle Data</DialogTitle>
              <DialogDescription>
                Upload a new file to replace the data. Column mappings will be preserved where possible.
              </DialogDescription>
            </DialogHeader>
            <ExplorerReloadUploader 
              onFileSelect={handleReloadFile}
              currentFileName={selectedBundle.source.fileName}
            />
          </DialogContent>
        </Dialog>

        <Select value={selectedBundleId!} onValueChange={setSelectedBundle}>
          <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {bundles.map((bundle) => (
              <SelectItem key={bundle.id} value={bundle.id}>
                {bundle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Visualization Area */}
      <div className="flex-1 overflow-hidden">
        {selectedSchema?.dataType === 'hierarchy' && (
          <HierarchyExplorer bundle={selectedBundle} schema={selectedSchema} />
        )}
        {selectedSchema?.dataType === 'tabular' && (
          <TabularExplorer bundle={selectedBundle} schema={selectedSchema} />
        )}
        {selectedSchema?.dataType === 'network' && (
          <NetworkExplorer bundle={selectedBundle} schema={selectedSchema} />
        )}
      </div>
    </div>
  );
}

// Simple reload uploader for the Explorer
function ExplorerReloadUploader({ onFileSelect, currentFileName }: { onFileSelect: (file: File) => void; currentFileName: string }) {
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.json'))) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-400">
        Current file: <span className="text-zinc-200 font-mono">{currentFileName}</span>
      </div>
      
      <label
        className={`block w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver 
            ? 'border-emerald-500 bg-emerald-500/10' 
            : 'border-zinc-700 hover:border-zinc-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
        <p className="text-zinc-400 mb-1">Drop a new file or click to upload</p>
        <p className="text-zinc-600 text-sm">CSV or JSON files supported</p>
        <input
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
      
      <p className="text-xs text-zinc-500">
        Existing column mappings will be preserved for columns that exist in the new file.
      </p>
    </div>
  );
}
