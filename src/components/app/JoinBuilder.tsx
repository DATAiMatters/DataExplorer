import { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { generateId } from '@/lib/dataUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Plus, Trash2, AlertCircle, CheckCircle2, GitMerge } from 'lucide-react';
import type { JoinDefinition, JoinCondition, JoinType, JoinOperator } from '@/types';

export function JoinBuilder() {
  const bundles = useAppStore((s) => s.bundles);
  const schemas = useAppStore((s) => s.schemas);
  const addJoin = useAppStore((s) => s.addJoin);
  const addVirtualBundle = useAppStore((s) => s.addVirtualBundle);
  const setViewMode = useAppStore((s) => s.setViewMode);

  const [name, setName] = useState('');
  const [leftBundleId, setLeftBundleId] = useState('');
  const [rightBundleId, setRightBundleId] = useState('');
  const [joinType, setJoinType] = useState<JoinType>('inner');
  const [conditions, setConditions] = useState<JoinCondition[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const leftBundle = bundles.find((b) => b.id === leftBundleId);
  const rightBundle = bundles.find((b) => b.id === rightBundleId);
  const leftSchema = leftBundle ? schemas.find((s) => s.id === leftBundle.schemaId) : null;
  const rightSchema = rightBundle ? schemas.find((s) => s.id === rightBundle.schemaId) : null;

  // Auto-suggest join conditions based on matching role IDs
  const suggestedConditions = useMemo(() => {
    if (!leftSchema || !rightSchema) return [];

    const suggestions: JoinCondition[] = [];
    leftSchema.roles.forEach((leftRole) => {
      const matchingRole = rightSchema.roles.find((r) => r.id === leftRole.id);
      if (matchingRole) {
        suggestions.push({
          leftRoleId: leftRole.id,
          rightRoleId: matchingRole.id,
          operator: '=',
        });
      }
    });

    return suggestions;
  }, [leftSchema, rightSchema]);

  // Preview join results
  const preview = useMemo(() => {
    if (!leftBundle || !rightBundle || conditions.length === 0) {
      return { rowCount: 0, matchRate: 0, canPreview: false };
    }

    const condition = conditions[0];
    const leftMapping = leftBundle.mappings.find((m) => m.roleId === condition.leftRoleId);
    const rightMapping = rightBundle.mappings.find((m) => m.roleId === condition.rightRoleId);

    if (!leftMapping || !rightMapping) {
      return { rowCount: 0, matchRate: 0, canPreview: false };
    }

    // Count matching values (simplified preview)
    const leftValues = new Set(
      leftBundle.source.parsedData.map((row) => row[leftMapping.sourceColumn])
    );
    const rightValues = new Set(
      rightBundle.source.parsedData.map((row) => row[rightMapping.sourceColumn])
    );

    const intersection = new Set(Array.from(leftValues).filter((v) => rightValues.has(v)));

    const matchRate = intersection.size / Math.max(leftValues.size, rightValues.size);
    const estimatedRows = Math.floor(
      joinType === 'inner'
        ? intersection.size
        : joinType === 'left'
        ? leftValues.size
        : joinType === 'right'
        ? rightValues.size
        : leftValues.size + rightValues.size
    );

    return { rowCount: estimatedRows, matchRate, canPreview: true };
  }, [leftBundle, rightBundle, conditions, joinType]);

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        leftRoleId: '',
        rightRoleId: '',
        operator: '=',
      },
    ]);
  };

  const handleUpdateCondition = (index: number, updates: Partial<JoinCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleApplySuggestions = () => {
    setConditions(suggestedConditions);
  };

  const handleCreateJoin = () => {
    if (!leftBundleId || !rightBundleId || conditions.length === 0) return;

    const join: JoinDefinition = {
      id: generateId(),
      name: name || `${leftBundle?.name} × ${rightBundle?.name}`,
      leftBundleId,
      rightBundleId,
      joinType,
      conditions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addJoin(join);

    // Create virtual bundle
    const vBundle = {
      id: generateId(),
      name: `${leftBundle?.name} + ${rightBundle?.name}`,
      type: 'join' as const,
      sourceJoinIds: [join.id],
      schemaId: leftBundle?.schemaId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addVirtualBundle(vBundle);

    // Reset form
    setName('');
    setLeftBundleId('');
    setRightBundleId('');
    setConditions([]);
    setShowPreview(false);

    // Navigate to relationships view
    setViewMode('relationships');
  };

  const canCreate =
    leftBundleId && rightBundleId && conditions.length > 0 && conditions.every((c) => c.leftRoleId && c.rightRoleId);

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      <header className="flex-shrink-0 p-6 pb-4 border-b border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <GitMerge className="w-6 h-6 text-emerald-400" />
          Join Builder
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Create semantic joins between data bundles</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6 pt-4">
        <div className="flex gap-6">
        {/* Left panel - Configuration */}
        <div className="flex-1 space-y-6">
              {/* Join Name */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base">Join Name</CardTitle>
                  <CardDescription>Give this join a descriptive name</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Customer Orders"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </CardContent>
              </Card>

              {/* Bundle Selection */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base">Select Bundles</CardTitle>
                  <CardDescription>Choose the two bundles to join</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Left Bundle</Label>
                    <Select value={leftBundleId} onValueChange={setLeftBundleId}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 mt-2">
                        <SelectValue placeholder="Select bundle..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {bundles.map((bundle) => (
                          <SelectItem key={bundle.id} value={bundle.id} disabled={bundle.id === rightBundleId}>
                            {bundle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <ArrowRight className="w-5 h-5 text-zinc-600" />
                  </div>

                  <div>
                    <Label>Right Bundle</Label>
                    <Select value={rightBundleId} onValueChange={setRightBundleId}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 mt-2">
                        <SelectValue placeholder="Select bundle..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {bundles.map((bundle) => (
                          <SelectItem key={bundle.id} value={bundle.id} disabled={bundle.id === leftBundleId}>
                            {bundle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Join Type */}
              {leftBundleId && rightBundleId && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-base">Join Type</CardTitle>
                    <CardDescription>Select how to combine the bundles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={joinType} onValueChange={(v) => setJoinType(v as JoinType)}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="inner">Inner Join (matching rows only)</SelectItem>
                        <SelectItem value="left">Left Join (all from left, matching from right)</SelectItem>
                        <SelectItem value="right">Right Join (all from right, matching from left)</SelectItem>
                        <SelectItem value="full">Full Outer Join (all rows from both)</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {/* Join Conditions */}
              {leftSchema && rightSchema && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Join Conditions</CardTitle>
                        <CardDescription>Define how the bundles are related</CardDescription>
                      </div>
                      {suggestedConditions.length > 0 && conditions.length === 0 && (
                        <Button size="sm" variant="outline" onClick={handleApplySuggestions} className="border-emerald-500/30">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                          Use Suggestions
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {conditions.map((condition, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-zinc-500">{leftBundle?.name}</Label>
                          <Select
                            value={condition.leftRoleId}
                            onValueChange={(v) => handleUpdateCondition(index, { leftRoleId: v })}
                          >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 mt-1">
                              <SelectValue placeholder="Select role..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              {leftSchema.roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-20">
                          <Select
                            value={condition.operator}
                            onValueChange={(v) => handleUpdateCondition(index, { operator: v as JoinOperator })}
                          >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              <SelectItem value="=">=</SelectItem>
                              <SelectItem value="!=">!=</SelectItem>
                              <SelectItem value=">">{'>'}</SelectItem>
                              <SelectItem value="<">{'<'}</SelectItem>
                              <SelectItem value=">=">{'>='}</SelectItem>
                              <SelectItem value="<=">{'<='}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex-1">
                          <Label className="text-xs text-zinc-500">{rightBundle?.name}</Label>
                          <Select
                            value={condition.rightRoleId}
                            onValueChange={(v) => handleUpdateCondition(index, { rightRoleId: v })}
                          >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 mt-1">
                              <SelectValue placeholder="Select role..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              {rightSchema.roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveCondition(index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    <Button onClick={handleAddCondition} variant="outline" className="w-full border-zinc-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Condition
                    </Button>

                    {suggestedConditions.length > 0 && conditions.length === 0 && (
                      <Alert className="bg-emerald-500/10 border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <AlertDescription className="text-emerald-200 text-sm">
                          Found {suggestedConditions.length} matching role{suggestedConditions.length > 1 ? 's' : ''} between
                          these bundles. Click "Use Suggestions" to apply.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              {canCreate && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowPreview(!showPreview)}
                    variant="outline"
                    className="flex-1 border-zinc-700"
                  >
                    {showPreview ? 'Hide' : 'Show'} Preview
                  </Button>
                  <Button onClick={handleCreateJoin} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    Create Join
                  </Button>
                </div>
              )}
        </div>

        {/* Right panel - Preview */}
        {showPreview && preview.canPreview && (
          <Card className="w-80 bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base">Join Preview</CardTitle>
              <CardDescription>Estimated results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-zinc-500 mb-1">Estimated Row Count</div>
                <div className="text-2xl font-semibold text-emerald-400">{preview.rowCount.toLocaleString()}</div>
              </div>

              <div>
                <div className="text-sm text-zinc-500 mb-1">Match Rate</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${preview.matchRate * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{Math.round(preview.matchRate * 100)}%</span>
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-500 mb-2">Source Bundles</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{leftBundle?.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {leftBundle?.source.parsedData.length} rows
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{rightBundle?.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {rightBundle?.source.parsedData.length} rows
                    </Badge>
                  </div>
                </div>
              </div>

              {preview.matchRate < 0.5 && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20">
                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-200 text-sm">
                    Low match rate. Consider checking your join conditions.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
