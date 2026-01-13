import { useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, RotateCcw, Trash2, Edit2, FileText, Network, GitBranch, Calendar, LayoutGrid, Grid3x3, MapPin, TrendingUp } from 'lucide-react';
import { generateId } from '@/lib/dataUtils';
import type { SemanticSchema, SemanticRole, DataType } from '@/types';

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

const dataTypeColors = {
  hierarchy: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  tabular: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  network: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  timeline: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  treemap: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  heatmap: 'bg-red-500/10 text-red-400 border-red-500/20',
  geographic: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  flow: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

export function SchemaManager() {
  const schemas = useAppStore((s) => s.schemas);
  const addSchema = useAppStore((s) => s.addSchema);
  const updateSchema = useAppStore((s) => s.updateSchema);
  const deleteSchema = useAppStore((s) => s.deleteSchema);
  const resetSchemas = useAppStore((s) => s.resetSchemas);
  const setViewMode = useAppStore((s) => s.setViewMode);

  const [isCreating, setIsCreating] = useState(false);
  const [editingSchema, setEditingSchema] = useState<SemanticSchema | null>(null);

  return (
    <div className="h-full flex flex-col p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Semantic Schemas</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Define the structure and roles for different data types
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetSchemas} className="border-zinc-700">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                New Schema
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle>Create Semantic Schema</DialogTitle>
                <DialogDescription>
                  Define a new schema with roles for mapping data columns
                </DialogDescription>
              </DialogHeader>
              <SchemaEditor
                onSave={(schema) => {
                  addSchema(schema);
                  setIsCreating(false);
                }}
                onCancel={() => setIsCreating(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <Accordion type="single" collapsible className="space-y-3">
          {schemas.map((schema) => {
            const Icon = dataTypeIcons[schema.dataType];

            return (
              <AccordionItem
                key={schema.id}
                value={schema.id}
                className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-zinc-800/50">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{schema.name}</div>
                      <div className="text-xs text-zinc-500">{schema.description}</div>
                    </div>
                    <Badge variant="outline" className={`ml-auto mr-4 ${dataTypeColors[schema.dataType]}`}>
                      {schema.dataType}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-zinc-300">Semantic Roles</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700 h-7"
                          onClick={() => setViewMode('bundles')}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          New Bundle
                        </Button>
                        <Dialog
                          open={editingSchema?.id === schema.id}
                          onOpenChange={(open) => !open && setEditingSchema(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-700 h-7"
                              onClick={() => setEditingSchema(schema)}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-900 border-zinc-800">
                            <DialogHeader>
                              <DialogTitle>Edit Schema</DialogTitle>
                            </DialogHeader>
                            <SchemaEditor
                              initialSchema={schema}
                              onSave={(updated) => {
                                updateSchema(schema.id, updated);
                                setEditingSchema(null);
                              }}
                              onCancel={() => setEditingSchema(null)}
                            />
                          </DialogContent>
                        </Dialog>
                        {!schema.id.endsWith('-default') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 h-7 text-red-400 hover:text-red-300"
                            onClick={() => deleteSchema(schema.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      {schema.roles.map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{role.name}</span>
                              <code className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                {role.id}
                              </code>
                              {role.required && (
                                <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-400">
                                  Required
                                </Badge>
                              )}
                              {role.multiple && (
                                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-400">
                                  Multiple
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{role.description}</p>
                          </div>
                          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                            {role.dataType || 'any'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}

// ============================================
// SCHEMA EDITOR COMPONENT
// ============================================

interface SchemaEditorProps {
  initialSchema?: SemanticSchema;
  onSave: (schema: SemanticSchema) => void;
  onCancel: () => void;
}

function SchemaEditor({ initialSchema, onSave, onCancel }: SchemaEditorProps) {
  const [name, setName] = useState(initialSchema?.name || '');
  const [description, setDescription] = useState(initialSchema?.description || '');
  const [dataType, setDataType] = useState<DataType>(initialSchema?.dataType || 'tabular');
  const [roles, setRoles] = useState<SemanticRole[]>(initialSchema?.roles || []);

  const addRole = () => {
    setRoles([
      ...roles,
      {
        id: `role_${roles.length + 1}`,
        name: 'New Role',
        description: '',
        required: false,
        dataType: 'string',
      },
    ]);
  };

  const updateRole = (index: number, updates: Partial<SemanticRole>) => {
    setRoles(roles.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const schema: SemanticSchema = {
      id: initialSchema?.id || `custom-${generateId()}`,
      name,
      description,
      dataType,
      roles,
    };
    onSave(schema);
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Schema Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Schema"
            className="bg-zinc-800 border-zinc-700"
          />
        </div>
        <div className="space-y-2">
          <Label>Data Type</Label>
          <Select value={dataType} onValueChange={(v) => setDataType(v as DataType)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="hierarchy">Hierarchy</SelectItem>
              <SelectItem value="tabular">Tabular</SelectItem>
              <SelectItem value="network">Network</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this schema is for..."
          className="bg-zinc-800 border-zinc-700 resize-none"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Semantic Roles</Label>
          <Button size="sm" variant="outline" onClick={addRole} className="border-zinc-700 h-7">
            <Plus className="w-3 h-3 mr-1" />
            Add Role
          </Button>
        </div>

        <ScrollArea className="h-[250px]">
          <div className="space-y-3 pr-4">
            {roles.map((role, index) => (
              <Card key={index} className="bg-zinc-800 border-zinc-700">
                <CardContent className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={role.name}
                      onChange={(e) => updateRole(index, { name: e.target.value })}
                      placeholder="Role Name"
                      className="bg-zinc-900 border-zinc-700 text-sm"
                    />
                    <Input
                      value={role.id}
                      onChange={(e) =>
                        updateRole(index, { id: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                      }
                      placeholder="role_id"
                      className="bg-zinc-900 border-zinc-700 text-sm font-mono"
                    />
                  </div>
                  <Input
                    value={role.description}
                    onChange={(e) => updateRole(index, { description: e.target.value })}
                    placeholder="Description"
                    className="bg-zinc-900 border-zinc-700 text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={role.required}
                          onCheckedChange={(checked) => updateRole(index, { required: checked })}
                        />
                        <Label className="text-xs">Required</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={role.multiple}
                          onCheckedChange={(checked) => updateRole(index, { multiple: checked })}
                        />
                        <Label className="text-xs">Multiple</Label>
                      </div>
                      <Select
                        value={role.dataType || 'string'}
                        onValueChange={(v) => updateRole(index, { dataType: v as SemanticRole['dataType'] })}
                      >
                        <SelectTrigger className="w-24 h-7 bg-zinc-900 border-zinc-700 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => removeRole(index)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex gap-2 pt-4 border-t border-zinc-800">
        <Button variant="outline" onClick={onCancel} className="border-zinc-700">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name || roles.length === 0}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          {initialSchema ? 'Update Schema' : 'Create Schema'}
        </Button>
      </div>
    </div>
  );
}
