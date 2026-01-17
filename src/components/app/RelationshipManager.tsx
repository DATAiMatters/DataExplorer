import { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Edit2, Plus, RotateCcw, GitBranch, ChevronDown, ChevronRight, GitMerge, Network } from 'lucide-react';
import { getCategories, type RelationshipType } from '@/config/relationshipTypes';
import { JoinsManager } from './JoinsManager';
import { LineageGraphExplorer } from './visualizations/LineageGraphExplorer';

export function RelationshipManager() {
  const [activeTab, setActiveTab] = useState('types');
  const relationshipTypeConfig = useAppStore((s) => s.relationshipTypeConfig);
  const addRelationshipType = useAppStore((s) => s.addRelationshipType);
  const updateRelationshipType = useAppStore((s) => s.updateRelationshipType);
  const resetRelationshipTypes = useAppStore((s) => s.resetRelationshipTypes);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    return getCategories(relationshipTypeConfig);
  }, [relationshipTypeConfig]);

  const filteredTypes = useMemo(() => {
    let types = relationshipTypeConfig.types;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      types = types.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.category.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'all') {
      types = types.filter((t) => t.category === selectedCategory);
    }

    return types;
  }, [relationshipTypeConfig.types, searchTerm, selectedCategory]);

  const typesByCategory = useMemo(() => {
    const grouped = new Map<string, RelationshipType[]>();
    filteredTypes.forEach((type) => {
      if (!grouped.has(type.category)) {
        grouped.set(type.category, []);
      }
      grouped.get(type.category)!.push(type);
    });
    return grouped;
  }, [filteredTypes]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleReset = () => {
    if (confirm('Reset all relationship types to defaults? This will discard your customizations.')) {
      resetRelationshipTypes();
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-emerald-400" />
              Relationships
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage relationship types and data joins
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="bg-zinc-800">
            <TabsTrigger value="types" className="gap-2">
              <GitBranch className="w-4 h-4" />
              Relationship Types
            </TabsTrigger>
            <TabsTrigger value="joins" className="gap-2">
              <GitMerge className="w-4 h-4" />
              Data Joins
            </TabsTrigger>
            <TabsTrigger value="lineage" className="gap-2">
              <Network className="w-4 h-4" />
              Lineage Graph
            </TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="mt-0 flex-1 flex flex-col">
            {/* Filters */}
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search relationship types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-zinc-800 border-zinc-700"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-64 bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </Button>
                <AddRelationshipDialog onAdd={addRelationshipType} categories={categories} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="joins" className="mt-4">
            <JoinsManager />
          </TabsContent>

          <TabsContent value="lineage" className="mt-0 h-[calc(100vh-240px)]">
            <LineageGraphExplorer />
          </TabsContent>
        </Tabs>
      </div>

      {/* Content - Only show for types tab */}
      {activeTab === 'types' && (
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {Array.from(typesByCategory.entries()).map(([category, types]) => (
              <Card key={category} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCategory(category)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedCategories.has(category) ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      )}
                      <CardTitle className="text-lg">{category}</CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        {types.length}
                      </Badge>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full border-2"
                      style={{
                        backgroundColor: relationshipTypeConfig.categoryColors[category] || '#6b7280',
                        borderColor: relationshipTypeConfig.categoryColors[category] || '#6b7280',
                      }}
                    />
                  </div>
                </CardHeader>

                {expandedCategories.has(category) && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {types.map((type) => (
                        <RelationshipTypeCard
                          key={type.name}
                          type={type}
                          onUpdate={updateRelationshipType}
                        />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}

            {filteredTypes.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                No relationship types match your search
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function RelationshipTypeCard({
  type,
  onUpdate,
}: {
  type: RelationshipType;
  onUpdate: (name: string, updates: Partial<RelationshipType>) => void;
}) {

  return (
    <div className="p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-zinc-700/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-zinc-200">{type.name}</span>
            {type.symmetric && (
              <Badge variant="outline" className="text-xs">
                Symmetric
              </Badge>
            )}
            <div
              className="w-12 h-1 rounded-full"
              style={{
                backgroundColor: type.color || '#6b7280',
                borderStyle: type.lineStyle === 'dashed' ? 'dashed' : type.lineStyle === 'dotted' ? 'dotted' : 'solid',
                borderWidth: type.lineStyle !== 'solid' ? '1px' : '0',
              }}
            />
          </div>
          <p className="text-sm text-zinc-400 mb-1">{type.description}</p>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Inverse: {type.inverseName}</span>
            <Separator orientation="vertical" className="h-3 bg-zinc-700" />
            <span>Purpose: {type.purpose}</span>
          </div>
        </div>
        <EditRelationshipDialog
          type={type}
          onSave={(updates) => {
            onUpdate(type.name, updates);
          }}
        />
      </div>
    </div>
  );
}

function AddRelationshipDialog({
  onAdd,
  categories,
}: {
  onAdd: (type: RelationshipType) => void;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<RelationshipType>({
    category: categories[0] || 'Data Lineage',
    name: '',
    inverseName: '',
    description: '',
    symmetric: false,
    purpose: '',
    color: '#6b7280',
    lineStyle: 'solid',
  });

  const handleSave = () => {
    if (!formData.name || !formData.inverseName) {
      alert('Name and inverse name are required');
      return;
    }
    onAdd(formData);
    setOpen(false);
    // Reset form
    setFormData({
      category: categories[0] || 'Data Lineage',
      name: '',
      inverseName: '',
      description: '',
      symmetric: false,
      purpose: '',
      color: '#6b7280',
      lineStyle: 'solid',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" />
          Add Type
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Relationship Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category" className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., depends on"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inverseName">Inverse Name *</Label>
              <Input
                id="inverseName"
                value={formData.inverseName}
                onChange={(e) => setFormData({ ...formData, inverseName: e.target.value })}
                placeholder="e.g., is depended on by"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="bg-zinc-800 border-zinc-700 h-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this relationship type"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div>
            <Label htmlFor="purpose">Purpose</Label>
            <Input
              id="purpose"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="What is this relationship used for?"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div>
            <Label htmlFor="lineStyle">Line Style</Label>
            <Select
              value={formData.lineStyle}
              onValueChange={(value: 'solid' | 'dashed' | 'dotted') =>
                setFormData({ ...formData, lineStyle: value })
              }
            >
              <SelectTrigger id="lineStyle" className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Add Relationship Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRelationshipDialog({
  type,
  onSave,
}: {
  type: RelationshipType;
  onSave: (updates: Partial<RelationshipType>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState(type);

  const handleSave = () => {
    onSave(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Relationship Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-color">Color</Label>
              <Input
                id="edit-color"
                type="color"
                value={formData.color || '#6b7280'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="bg-zinc-800 border-zinc-700 h-10"
              />
            </div>
            <div>
              <Label htmlFor="edit-lineStyle">Line Style</Label>
              <Select
                value={formData.lineStyle || 'solid'}
                onValueChange={(value: 'solid' | 'dashed' | 'dotted') =>
                  setFormData({ ...formData, lineStyle: value })
                }
              >
                <SelectTrigger id="edit-lineStyle" className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div>
            <Label htmlFor="edit-purpose">Purpose</Label>
            <Input
              id="edit-purpose"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="p-3 bg-zinc-800 rounded-lg">
            <div className="text-sm text-zinc-400 space-y-1">
              <div><span className="text-zinc-500">Name:</span> {type.name}</div>
              <div><span className="text-zinc-500">Inverse:</span> {type.inverseName}</div>
              <div><span className="text-zinc-500">Category:</span> {type.category}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
