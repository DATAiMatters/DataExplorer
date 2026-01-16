import { useState } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GitMerge, Trash2, Eye, AlertCircle, ArrowRight, Database } from 'lucide-react';
import { JoinBuilder } from './JoinBuilder';

export function JoinsManager() {
  const joins = useAppStore((s) => s.joins);
  const virtualBundles = useAppStore((s) => s.virtualBundles);
  const bundles = useAppStore((s) => s.bundles);
  const deleteJoin = useAppStore((s) => s.deleteJoin);
  const deleteVirtualBundle = useAppStore((s) => s.deleteVirtualBundle);
  const setSelectedBundle = useAppStore((s) => s.setSelectedBundle);
  const setViewMode = useAppStore((s) => s.setViewMode);

  const [showBuilder, setShowBuilder] = useState(false);

  const handleDeleteJoin = (joinId: string) => {
    const dependentVBundles = virtualBundles.filter((vb) => vb.sourceJoinIds.includes(joinId));

    if (dependentVBundles.length > 0) {
      const message = `This join is used by ${dependentVBundles.length} virtual bundle(s). Deleting it will also delete:\n\n${dependentVBundles.map((vb) => `- ${vb.name}`).join('\n')}\n\nContinue?`;
      if (!confirm(message)) return;
    }

    deleteJoin(joinId);
  };

  const handleViewLineage = (joinId: string) => {
    const join = joins.find((j) => j.id === joinId);
    if (!join) return;

    // Find virtual bundle that uses this join
    const vBundle = virtualBundles.find((vb) => vb.sourceJoinIds.includes(joinId));
    if (vBundle) {
      setSelectedBundle(vBundle.id);
      setViewMode('explorer');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-emerald-400" />
            Data Joins
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Manage joins and virtual bundles</p>
        </div>
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <GitMerge className="w-4 h-4 mr-2" />
              New Join
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] p-0 bg-zinc-900 border-zinc-800">
            <JoinBuilder />
          </DialogContent>
        </Dialog>
      </header>

      {joins.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <GitMerge className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">No joins yet</h3>
            <p className="text-zinc-500 text-sm mb-4">
              Create your first join to combine data from multiple bundles
            </p>
            <Button onClick={() => setShowBuilder(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <GitMerge className="w-4 h-4 mr-2" />
              Create Join
            </Button>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4">
            {/* Joins List */}
            {joins.map((join) => {
              const leftBundle = bundles.find((b) => b.id === join.leftBundleId);
              const rightBundle = bundles.find((b) => b.id === join.rightBundleId);
              const dependentVBundles = virtualBundles.filter((vb) => vb.sourceJoinIds.includes(join.id));

              return (
                <Card key={join.id} className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {join.name}
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            {join.joinType}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {join.description || `Joining ${leftBundle?.name} with ${rightBundle?.name}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {dependentVBundles.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700"
                            onClick={() => handleViewLineage(join.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                          onClick={() => handleDeleteJoin(join.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Join Flow */}
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                        <Database className="w-4 h-4 text-blue-400" />
                        <span className="font-medium">{leftBundle?.name || 'Unknown'}</span>
                        <Badge variant="secondary" className="text-xs">
                          {leftBundle?.source.parsedData.length || 0} rows
                        </Badge>
                      </div>

                      <ArrowRight className="w-5 h-5 text-zinc-600" />

                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="font-medium">{rightBundle?.name || 'Unknown'}</span>
                        <Badge variant="secondary" className="text-xs">
                          {rightBundle?.source.parsedData.length || 0} rows
                        </Badge>
                      </div>
                    </div>

                    {/* Join Conditions */}
                    <div>
                      <div className="text-xs text-zinc-500 mb-2">Join Conditions:</div>
                      <div className="space-y-1">
                        {join.conditions.map((condition, index) => (
                          <div key={index} className="text-sm text-zinc-400 font-mono bg-zinc-800 px-3 py-2 rounded">
                            {condition.leftRoleId} {condition.operator} {condition.rightRoleId}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Virtual Bundles */}
                    {dependentVBundles.length > 0 && (
                      <div>
                        <div className="text-xs text-zinc-500 mb-2">Virtual Bundles:</div>
                        <div className="space-y-2">
                          {dependentVBundles.map((vb) => (
                            <div
                              key={vb.id}
                              className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-emerald-400" />
                                <span>{vb.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {vb.type}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedBundle(vb.id);
                                    setViewMode('explorer');
                                  }}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="hover:text-red-400"
                                  onClick={() => {
                                    if (confirm(`Delete virtual bundle "${vb.name}"?`)) {
                                      deleteVirtualBundle(vb.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Bundles Warning */}
                    {(!leftBundle || !rightBundle) && (
                      <Alert className="bg-red-500/10 border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <AlertDescription className="text-red-200 text-sm">
                          {!leftBundle && !rightBundle
                            ? 'Both source bundles are missing'
                            : !leftBundle
                            ? 'Left bundle is missing'
                            : 'Right bundle is missing'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
