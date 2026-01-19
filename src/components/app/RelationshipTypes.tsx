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
// Separator unused but kept for potential future use
import { Search, Edit2, Plus, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { getCategories, type RelationshipType } from '@/config/relationshipTypes';

export function RelationshipTypes() {
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
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleReset = () => {
    if (confirm('Reset all relationship types to defaults? This will remove any custom types you added.')) {
      resetRelationshipTypes();
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Relationship Types</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Configure semantic relationship types for network visualizations
            </p>
          </div>
          <div className="flex gap-2">
            <AddTypeDialog onAdd={addRelationshipType} categories={categories} />
            <Button variant="outline" size="sm" onClick={handleReset} className="border-zinc-700">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search relationship types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[220px] bg-zinc-900 border-zinc-800">
              <SelectValue placeholder="All Categories" />
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
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {Array.from(typesByCategory.entries()).map(([category, types]) => {
            const isExpanded = expandedCategories.has(category);
            return (
              <Card key={category} className="bg-zinc-900 border-zinc-800">
                <CardHeader
                  className="cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      )}
                      <CardTitle className="text-lg">{category}</CardTitle>
                      <Badge variant="secondary" className="bg-zinc-800">
                        {types.length}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent>
                    <div className="space-y-2">
                      {types.map((type) => (
                        <TypeCard
                          key={type.name}
                          type={type}
                          onUpdate={(updates) => updateRelationshipType(type.name, updates)}
                        />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {filteredTypes.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No relationship types found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper components (TypeCard, AddTypeDialog, EditTypeDialog) are defined below
function TypeCard({
  type,
  onUpdate,
}: {
  type: RelationshipType;
  onUpdate: (updates: Partial<RelationshipType>) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <div
          className="w-12 h-8 rounded border-2 flex items-center justify-center"
          style={{
            borderColor: type.color,
            borderStyle: type.lineStyle || 'solid',
          }}
        >
          <div
            className="w-8 h-0.5"
            style={{
              backgroundColor: type.lineStyle ? 'transparent' : type.color,
              borderTop: type.lineStyle === 'dashed' ? '2px dashed' : type.lineStyle === 'dotted' ? '2px dotted' : 'none',
              borderColor: type.lineStyle ? type.color : undefined,
            }}
          />
        </div>
        <div className="flex-1">
          <div className="font-medium text-zinc-200">{type.name}</div>
          <div className="text-xs text-zinc-500">{type.description}</div>
        </div>
      </div>
      <EditTypeDialog type={type} onSave={onUpdate} />
    </div>
  );
}

function AddTypeDialog({
  onAdd,
  categories,
}: {
  onAdd: (type: RelationshipType) => void;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0] || 'General');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#10b981');
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');

  const handleSave = () => {
    onAdd({
      name,
      category,
      description,
      color,
      lineStyle,
      inverseName: name, // Default to same name
      symmetric: true,
      purpose: description,
    });
    setOpen(false);
    setName('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-zinc-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Type
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Add Relationship Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., sources from"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label>Color</Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="bg-zinc-800 border-zinc-700 h-10"
            />
          </div>
          <div>
            <Label>Line Style</Label>
            <Select value={lineStyle} onValueChange={(v) => setLineStyle(v as typeof lineStyle)}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
          <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name} className="bg-emerald-600 hover:bg-emerald-700">
            Add Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTypeDialog({
  type,
  onSave,
}: {
  type: RelationshipType;
  onSave: (updates: Partial<RelationshipType>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(type.color);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(type.lineStyle || 'solid');
  const [description, setDescription] = useState(type.description);

  const handleSave = () => {
    onSave({ color, lineStyle, description });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Edit: {type.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label>Color</Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="bg-zinc-800 border-zinc-700 h-10"
            />
          </div>
          <div>
            <Label>Line Style</Label>
            <Select value={lineStyle} onValueChange={(v) => setLineStyle(v as typeof lineStyle)}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
          <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">
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
