import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import { parseFile, generateId } from '@/lib/dataUtils';
import { callLLM } from '@/lib/aiService';
import { suggestMappingsPrompt } from '@/lib/aiPrompts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Upload, Trash2, Play, FileText, Network, GitBranch, RefreshCw, Edit, Calendar, LayoutGrid, Grid3x3, MapPin, TrendingUp, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { DataBundle, ColumnMapping, DataSource, SemanticSchema } from '@/types';

const dataTypeIcons = {
  hierarchy: GitBranch,
  tabular: FileText,
  network: Network,
  timeline: Calendar,
  treemap: LayoutGrid,
  heatmap: Grid3x3,
  geographic: MapPin,
  flow: TrendingUp,
};

export function BundleManager() {
  const bundles = useAppStore((s) => s.bundles);
  const schemas = useAppStore((s) => s.schemas);
  const addBundle = useAppStore((s) => s.addBundle);
  const updateBundle = useAppStore((s) => s.updateBundle);
  const deleteBundle = useAppStore((s) => s.deleteBundle);
  const setSelectedBundle = useAppStore((s) => s.setSelectedBundle);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const preselectedSchemaId = useAppStore((s) => s.preselectedSchemaId);
  const setPreselectedSchemaId = useAppStore((s) => s.setPreselectedSchemaId);

  const [isCreating, setIsCreating] = useState(false);
  const [reloadingBundleId, setReloadingBundleId] = useState<string | null>(null);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);

  // Auto-open dialog when coming from schema manager
  useEffect(() => {
    if (preselectedSchemaId) {
      setIsCreating(true);
    }
  }, [preselectedSchemaId]);

  const handleExplore = (bundleId: string) => {
    setSelectedBundle(bundleId);
    setViewMode('explorer');
  };

  const handleReloadFile = useCallback((bundleId: string, file: File) => {
    const bundle = bundles.find(b => b.id === bundleId);
    if (!bundle) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawData = ev.target?.result as string;
      try {
        const { data, columns } = parseFile(file.name, rawData);

        // Check which mappings are now invalid
        const validMappings = bundle.mappings.filter(m => columns.includes(m.sourceColumn));
        const invalidMappings = bundle.mappings.filter(m => !columns.includes(m.sourceColumn));
        const hasBrokenMappings = invalidMappings.length > 0;

        // Get schema to check if required roles are now missing
        const schema = schemas.find(s => s.id === bundle.schemaId);
        const requiredRoles = schema?.roles.filter(r => r.required) || [];
        const missingRequiredRoles = requiredRoles.filter(
          role => !validMappings.some(m => m.roleId === role.id)
        );

        // Update the bundle with new data
        updateBundle(bundleId, {
          source: {
            type: file.name.endsWith('.json') ? 'json' : 'csv',
            fileName: file.name,
            rawData,
            parsedData: data,
            columns,
          },
          mappings: validMappings,
        });

        setReloadingBundleId(null);

        // If mappings are broken or required roles are missing, open the editor immediately
        if (hasBrokenMappings || missingRequiredRoles.length > 0) {
          // Small delay to allow the dialog to close first
          setTimeout(() => {
            setEditingBundleId(bundleId);
          }, 100);
        }
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    };
    reader.readAsText(file);
  }, [bundles, schemas, updateBundle]);

  return (
    <div className="h-full flex flex-col p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Upload datasets and map columns to semantic roles
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              New Dataset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Create Dataset</DialogTitle>
              <DialogDescription>
                Upload a file and map its columns to a semantic schema
              </DialogDescription>
            </DialogHeader>
            <BundleCreator
              schemas={schemas}
              initialSchemaId={preselectedSchemaId || undefined}
              onComplete={(bundle) => {
                addBundle(bundle);
                setIsCreating(false);
                setPreselectedSchemaId(null);
              }}
              onCancel={() => {
                setIsCreating(false);
                setPreselectedSchemaId(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </header>

      <ScrollArea className="flex-1">
        {bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300">No datasets yet</h3>
            <p className="text-zinc-500 text-sm mt-1 max-w-sm">
              Create your first dataset by uploading a CSV or JSON file
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {bundles.map((bundle) => {
              const schema = schemas.find((s) => s.id === bundle.schemaId);
              const Icon = schema ? dataTypeIcons[schema.dataType] : FileText;
              const isSampleBundle = bundle.name === 'SAP Functional Locations' || bundle.name === 'SAP Equipment Assets';

              return (
                <Card key={bundle.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{bundle.name}</CardTitle>
                            {isSampleBundle && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                                SAMPLE
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            {schema?.name || 'Unknown schema'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-xs">
                        {bundle.source.parsedData.length} rows
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-zinc-500 mb-3">
                      {bundle.mappings.length} mapped columns • {bundle.source.fileName}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleExplore(bundle.id)}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Explore
                      </Button>
                      <Dialog open={editingBundleId === bundle.id} onOpenChange={(open) => setEditingBundleId(open ? bundle.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 hover:bg-zinc-800"
                            title="Edit column mappings"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-900 border-zinc-800">
                          <DialogHeader>
                            <DialogTitle>Edit Column Mappings</DialogTitle>
                            <DialogDescription>
                              Update how columns are mapped to semantic roles for "{bundle.name}"
                            </DialogDescription>
                          </DialogHeader>
                          <BundleEditor
                            bundle={bundle}
                            schema={schema}
                            onComplete={(updatedMappings) => {
                              updateBundle(bundle.id, { mappings: updatedMappings });
                              setEditingBundleId(null);
                            }}
                            onCancel={() => setEditingBundleId(null)}
                          />
                        </DialogContent>
                      </Dialog>
                      <Dialog open={reloadingBundleId === bundle.id} onOpenChange={(open) => setReloadingBundleId(open ? bundle.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 hover:bg-zinc-800"
                            title="Reload with new file"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-800">
                          <DialogHeader>
                            <DialogTitle>Reload Dataset Data</DialogTitle>
                            <DialogDescription>
                              Upload a new file to replace the data in "{bundle.name}". Column mappings will be preserved where possible.
                            </DialogDescription>
                          </DialogHeader>
                          <ReloadFileUploader
                            bundleId={bundle.id}
                            onFileSelect={handleReloadFile}
                            currentFileName={bundle.source.fileName}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-700 hover:bg-zinc-800"
                        onClick={() => deleteBundle(bundle.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================
// BUNDLE CREATOR COMPONENT
// ============================================

interface BundleCreatorProps {
  schemas: SemanticSchema[];
  initialSchemaId?: string;
  onComplete: (bundle: DataBundle) => void;
  onCancel: () => void;
}

function BundleCreator({ schemas, initialSchemaId, onComplete, onCancel }: BundleCreatorProps) {
  const aiSettings = useAppStore((s) => s.aiSettings);
  const [step, setStep] = useState<'upload' | 'configure' | 'map'>('upload');
  const [name, setName] = useState('');
  const [schemaId, setSchemaId] = useState(initialSchemaId || '');
  const [source, setSource] = useState<DataSource | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiResult, setAiResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedSchema = schemas.find((s) => s.id === schemaId);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawData = ev.target?.result as string;
      try {
        const { data, columns } = parseFile(file.name, rawData);
        const newSource: DataSource = {
          type: file.name.endsWith('.json') ? 'json' : 'csv',
          fileName: file.name,
          rawData,
          parsedData: data,
          columns,
        };
        setSource(newSource);
        setName(file.name.replace(/\.(csv|json)$/i, ''));

        // If we already have a schema selected, auto-map immediately
        if (schemaId) {
          const schema = schemas.find((s) => s.id === schemaId);
          if (schema) {
            const autoMappings: ColumnMapping[] = [];
            for (const role of schema.roles) {
              const matchingColumn = columns.find(
                (col) =>
                  col.toLowerCase().replace(/[_\s-]/g, '') ===
                  role.id.toLowerCase().replace(/[_\s-]/g, '')
              );
              if (matchingColumn) {
                autoMappings.push({
                  sourceColumn: matchingColumn,
                  roleId: role.id,
                  displayName: matchingColumn,
                });
              }
            }
            setMappings(autoMappings);
            setStep('map'); // Skip configure step, go straight to mapping
          }
        } else {
          setStep('configure');
        }
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    };
    reader.readAsText(file);
  }, [schemaId, schemas]);

  const handleSchemaSelect = (id: string) => {
    setSchemaId(id);
    const schema = schemas.find((s) => s.id === id);
    if (schema && source) {
      // Auto-map columns with matching names
      const autoMappings: ColumnMapping[] = [];
      for (const role of schema.roles) {
        const matchingColumn = source.columns.find(
          (col) =>
            col.toLowerCase().replace(/[_\s-]/g, '') ===
            role.id.toLowerCase().replace(/[_\s-]/g, '')
        );
        if (matchingColumn) {
          autoMappings.push({
            sourceColumn: matchingColumn,
            roleId: role.id,
            displayName: matchingColumn,
          });
        }
      }
      setMappings(autoMappings);
    }
  };

  const handleMappingChange = (roleId: string, column: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.roleId === roleId);
      if (existing) {
        if (!column) {
          return prev.filter((m) => m.roleId !== roleId);
        }
        return prev.map((m) =>
          m.roleId === roleId ? { ...m, sourceColumn: column, displayName: column } : m
        );
      }
      if (column) {
        return [...prev, { sourceColumn: column, roleId, displayName: column }];
      }
      return prev;
    });
  };

  const handleDisplayNameChange = (roleId: string, displayName: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.roleId === roleId ? { ...m, displayName } : m))
    );
  };

  const handleAISuggestMappings = async () => {
    if (!source || !selectedSchema) return;

    setAiSuggesting(true);
    setAiResult(null);

    try {
      // Get sample data (first 10 rows)
      const sampleData = source.parsedData.slice(0, 10);

      // Generate prompt
      const prompt = suggestMappingsPrompt(source.columns, sampleData, selectedSchema);

      // Call LLM
      const response = await callLLM(prompt, aiSettings);

      if (response.success) {
        try {
          // Parse JSON response
          const suggestedMappings = JSON.parse(response.content);

          // Convert to ColumnMapping format
          const newMappings: ColumnMapping[] = [];
          for (const [roleId, columnName] of Object.entries(suggestedMappings)) {
            if (typeof columnName === 'string' && source.columns.includes(columnName)) {
              newMappings.push({
                sourceColumn: columnName,
                roleId,
                displayName: columnName,
              });
            }
          }

          // Apply mappings
          setMappings(newMappings);
          setAiResult({
            success: true,
            message: `Applied ${newMappings.length} suggested mappings`,
          });
        } catch (parseErr) {
          setAiResult({
            success: false,
            message: 'Failed to parse AI response. Try again or map manually.',
          });
        }
      } else {
        setAiResult({
          success: false,
          message: response.error || 'AI suggestion failed',
        });
      }
    } catch (err) {
      setAiResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleCreate = () => {
    if (!source || !schemaId || !name) return;

    const bundle: DataBundle = {
      id: generateId(),
      name,
      schemaId,
      source,
      mappings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onComplete(bundle);
  };

  const canProceedToMap = name && schemaId;
  const requiredRoles = selectedSchema?.roles.filter((r) => r.required) || [];
  const hasRequiredMappings = requiredRoles.every((r) =>
    mappings.some((m) => m.roleId === r.id)
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <label className="w-full max-w-md border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-zinc-600 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400 mb-2">Drop a file or click to upload</p>
            <p className="text-zinc-600 text-sm">CSV or JSON files supported</p>
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {/* Step: Configure */}
      {step === 'configure' && source && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label>Dataset Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dataset"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label>Schema Type</Label>
            <Select value={schemaId} onValueChange={handleSchemaSelect}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Select a schema..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {schemas.map((schema) => (
                  <SelectItem key={schema.id} value={schema.id}>
                    <div className="flex items-center gap-2">
                      <span>{schema.name}</span>
                      <span className="text-zinc-500 text-xs">({schema.dataType})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-sm text-zinc-400">
              File: <span className="text-zinc-200">{source.fileName}</span>
            </p>
            <p className="text-sm text-zinc-400">
              Rows: <span className="text-zinc-200">{source.parsedData.length}</span> •
              Columns: <span className="text-zinc-200">{source.columns.length}</span>
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t border-zinc-800 mt-4">
            <Button variant="outline" onClick={onCancel} className="border-zinc-700">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                console.log('Configure Mappings clicked', { name, schemaId, canProceedToMap });
                setStep('map');
              }}
              disabled={!canProceedToMap}
              className={`flex-1 ${canProceedToMap ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'}`}
            >
              {!name ? 'Enter a name first' : !schemaId ? 'Select a schema first' : 'Configure Mappings'}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Map Columns */}
      {step === 'map' && source && selectedSchema && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="text-sm text-zinc-400 mb-4">
            Map your columns to semantic roles. Required roles are marked with *.
          </div>

          {/* AI Suggest Mappings Button */}
          {aiSettings.enabled && (
            <div className="space-y-2">
              <Button
                onClick={handleAISuggestMappings}
                disabled={aiSuggesting}
                variant="outline"
                className="w-full border-purple-500/30 hover:bg-purple-500/10"
              >
                {aiSuggesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
                    Suggest Mappings with AI
                  </>
                )}
              </Button>

              {/* AI Result Alert */}
              {aiResult && (
                <Alert
                  className={
                    aiResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }
                >
                  {aiResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                  <AlertDescription
                    className={aiResult.success ? 'text-emerald-200 text-sm' : 'text-red-200 text-sm'}
                  >
                    {aiResult.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {selectedSchema.roles.map((role) => {
                const mapping = mappings.find((m) => m.roleId === role.id);

                return (
                  <div key={role.id} className="space-y-2">
                    <Label className="flex items-center gap-1">
                      {role.name}
                      {role.required && <span className="text-red-400">*</span>}
                      <span className="text-zinc-600 text-xs ml-1">({role.id})</span>
                    </Label>
                    <p className="text-xs text-zinc-500">{role.description}</p>
                    <div className="flex gap-2">
                      <Select
                        value={mapping?.sourceColumn || '__none__'}
                        onValueChange={(v) => handleMappingChange(role.id, v === '__none__' ? '' : v)}
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1">
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="__none__">— None —</SelectItem>
                          {source.columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping && (
                        <Input
                          value={mapping.displayName}
                          onChange={(e) => handleDisplayNameChange(role.id, e.target.value)}
                          placeholder="Display name"
                          className="bg-zinc-800 border-zinc-700 w-40"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setStep('configure')}
              className="border-zinc-700"
            >
              Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!hasRequiredMappings}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              Create Dataset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// BUNDLE EDITOR COMPONENT
// ============================================

interface BundleEditorProps {
  bundle: DataBundle;
  schema: SemanticSchema | undefined;
  onComplete: (mappings: ColumnMapping[]) => void;
  onCancel: () => void;
}

function BundleEditor({ bundle, schema, onComplete, onCancel }: BundleEditorProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(bundle.mappings);

  if (!schema) {
    return (
      <div className="p-4 text-center text-zinc-500">
        Schema not found. Cannot edit mappings.
      </div>
    );
  }

  const handleMappingChange = (roleId: string, column: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.roleId === roleId);
      if (existing) {
        if (!column) {
          return prev.filter((m) => m.roleId !== roleId);
        }
        return prev.map((m) =>
          m.roleId === roleId ? { ...m, sourceColumn: column, displayName: column } : m
        );
      }
      if (column) {
        return [...prev, { sourceColumn: column, roleId, displayName: column }];
      }
      return prev;
    });
  };

  const handleDisplayNameChange = (roleId: string, displayName: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.roleId === roleId ? { ...m, displayName } : m))
    );
  };

  const requiredRoles = schema.roles.filter((r) => r.required);
  const hasRequiredMappings = requiredRoles.every((r) =>
    mappings.some((m) => m.roleId === r.id)
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-zinc-400">
              File: <span className="text-zinc-200">{bundle.source.fileName}</span>
            </p>
            <p className="text-sm text-zinc-400">
              Schema: <span className="text-zinc-200">{schema.name}</span>
            </p>
            <p className="text-sm text-zinc-400 mt-2">
              Map your columns to semantic roles. Required roles are marked with *.
            </p>
          </div>

          {schema.roles.map((role) => {
            const mapping = mappings.find((m) => m.roleId === role.id);
            const selectedColumn = mapping?.sourceColumn || '';

            return (
              <div key={role.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    {role.name}
                    {role.required && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  <Badge variant="secondary" className="text-xs bg-zinc-800">
                    {role.dataType || 'any'}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500">{role.description}</p>
                <div className="flex gap-2">
                  <Select
                    value={selectedColumn || '__none__'}
                    onValueChange={(val) => handleMappingChange(role.id, val === '__none__' ? '' : val)}
                  >
                    <SelectTrigger className="flex-1 bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="__none__">— None —</SelectItem>
                      {bundle.source.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping && (
                    <Input
                      value={mapping.displayName}
                      onChange={(e) => handleDisplayNameChange(role.id, e.target.value)}
                      placeholder="Display name"
                      className="bg-zinc-800 border-zinc-700 w-40"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex gap-2 pt-4 px-4 border-t border-zinc-800">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-zinc-700"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onComplete(mappings)}
          disabled={!hasRequiredMappings}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          title={!hasRequiredMappings ? 'Please map all required roles' : 'Save mappings'}
        >
          {!hasRequiredMappings ? 'Map all required roles first' : 'Save Mappings'}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// RELOAD FILE UPLOADER COMPONENT
// ============================================

interface ReloadFileUploaderProps {
  bundleId: string;
  onFileSelect: (bundleId: string, file: File) => void;
  currentFileName: string;
}

function ReloadFileUploader({ bundleId, onFileSelect, currentFileName }: ReloadFileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(bundleId, file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.json'))) {
      onFileSelect(bundleId, file);
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
        Note: Existing column mappings will be preserved for columns that exist in the new file.
      </p>
    </div>
  );
}
