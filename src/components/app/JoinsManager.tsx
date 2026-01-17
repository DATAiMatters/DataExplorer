import { useState } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GitMerge, Trash2, Eye, AlertCircle, ArrowRight, Database, Download } from 'lucide-react';
import { JoinBuilder } from './JoinBuilder';
import { parseCSV } from '@/lib/dataUtils';
import { generateId } from '@/lib/dataUtils';
import type { DataBundle, JoinDefinition, VirtualBundle } from '@/types';

export function JoinsManager() {
  const joins = useAppStore((s) => s.joins);
  const virtualBundles = useAppStore((s) => s.virtualBundles);
  const bundles = useAppStore((s) => s.bundles);
  const schemas = useAppStore((s) => s.schemas);
  const deleteJoin = useAppStore((s) => s.deleteJoin);
  const deleteVirtualBundle = useAppStore((s) => s.deleteVirtualBundle);
  const setSelectedBundle = useAppStore((s) => s.setSelectedBundle);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const addBundle = useAppStore((s) => s.addBundle);

  const [showBuilder, setShowBuilder] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const handleDeleteJoin = (joinId: string) => {
    const dependentVBundles = virtualBundles.filter((vb) => vb.sourceJoinIds.includes(joinId));

    if (dependentVBundles.length > 0) {
      const message = `This join is used by ${dependentVBundles.length} derived dataset(s). Deleting it will also delete:\n\n${dependentVBundles.map((vb) => `- ${vb.name}`).join('\n')}\n\nContinue?`;
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

  const handleLoadSampleData = async () => {
    setLoadingSamples(true);
    try {
      // Check if samples already loaded
      const existingFlocBundle = bundles.find((b) => b.name === 'SAP Functional Locations');
      const existingEquipBundle = bundles.find((b) => b.name === 'SAP Equipment Assets');

      if (existingFlocBundle && existingEquipBundle) {
        alert('Sample data already loaded! Check your Datasets.');
        setLoadingSamples(false);
        return;
      }

      // Load FLOC dataset
      const flocResponse = await fetch('/samples/joins/fast-food-functional-locations.csv');
      const flocText = await flocResponse.text();
      const flocParsed = parseCSV(flocText);

      // Load Equipment dataset
      const equipResponse = await fetch('/samples/joins/fast-food-equipment-assets.csv');
      const equipText = await equipResponse.text();
      const equipParsed = parseCSV(equipText);

      // Find tabular schema
      const tabularSchema = schemas.find((s) => s.dataType === 'tabular');
      if (!tabularSchema) {
        alert('Tabular schema not found. Cannot load sample data.');
        setLoadingSamples(false);
        return;
      }

      // Create FLOC bundle
      let flocBundleId: string;
      if (!existingFlocBundle) {
        const flocBundle: DataBundle = {
          id: generateId(),
          name: 'SAP Functional Locations',
          description: 'Functional Location hierarchy for FastBite restaurant chain (SAP PM data)',
          schemaId: tabularSchema.id,
          source: {
            type: 'csv',
            fileName: 'fast-food-functional-locations.csv',
            rawData: flocText,
            parsedData: flocParsed.data,
            columns: flocParsed.columns,
          },
          mappings: [
            { roleId: 'row_id', sourceColumn: 'FLOC_ID', displayName: 'FLOC ID' },
            { roleId: 'category', sourceColumn: 'FLOC_TYPE', displayName: 'FLOC Type' },
            { roleId: 'category', sourceColumn: 'REGION', displayName: 'Region' },
            { roleId: 'category', sourceColumn: 'STATUS', displayName: 'Status' },
            { roleId: 'text', sourceColumn: 'FLOC_NAME', displayName: 'FLOC Name' },
            { roleId: 'text', sourceColumn: 'PARENT_FLOC', displayName: 'Parent FLOC' },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addBundle(flocBundle);
        flocBundleId = flocBundle.id;
      } else {
        flocBundleId = existingFlocBundle.id;
      }

      // Create Equipment bundle
      let equipBundleId: string;
      if (!existingEquipBundle) {
        const equipBundle: DataBundle = {
          id: generateId(),
          name: 'SAP Equipment Assets',
          description: 'Commercial equipment assets for FastBite restaurants with functional location references (SAP PM data)',
          schemaId: tabularSchema.id,
          source: {
            type: 'csv',
            fileName: 'fast-food-equipment-assets.csv',
            rawData: equipText,
            parsedData: equipParsed.data,
            columns: equipParsed.columns,
          },
          mappings: [
            { roleId: 'row_id', sourceColumn: 'EQUIPMENT_ID', displayName: 'Equipment ID' },
            { roleId: 'category', sourceColumn: 'EQUIPMENT_TYPE', displayName: 'Equipment Type' },
            { roleId: 'category', sourceColumn: 'STATUS', displayName: 'Status' },
            { roleId: 'category', sourceColumn: 'CRITICALITY', displayName: 'Criticality' },
            { roleId: 'text', sourceColumn: 'EQUIPMENT_NAME', displayName: 'Equipment Name' },
            { roleId: 'text', sourceColumn: 'FLOC_ID', displayName: 'FLOC ID' },
            { roleId: 'text', sourceColumn: 'MANUFACTURER', displayName: 'Manufacturer' },
            { roleId: 'measure', sourceColumn: 'ACQUISITION_COST', displayName: 'Acquisition Cost' },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addBundle(equipBundle);
        equipBundleId = equipBundle.id;
      } else {
        equipBundleId = existingEquipBundle.id;
      }

      // Ask if user wants to auto-create a join
      const createJoin = confirm(
        'Sample data loaded successfully!\n\n' +
        '✓ SAP Functional Locations (30 locations)\n' +
        '✓ SAP Equipment Assets (43 equipment items)\n\n' +
        'Would you like to automatically create a sample join between these datasets?\n\n' +
        'Click OK to create join, or Cancel to create it manually.'
      );

      if (createJoin) {
        // Create a sample join
        const sampleJoin: JoinDefinition = {
          id: generateId(),
          name: 'Equipment by Location',
          description: 'Left join showing equipment installed at each functional location',
          leftBundleId: flocBundleId,
          rightBundleId: equipBundleId,
          joinType: 'left',
          conditions: [
            {
              leftRoleId: 'row_id',  // FLOC_ID from Functional Locations
              rightRoleId: 'text',   // FLOC_ID from Equipment (first text field)
              operator: '=',
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const addJoin = useAppStore.getState().addJoin;
        const addVirtualBundle = useAppStore.getState().addVirtualBundle;

        addJoin(sampleJoin);

        // Create virtual bundle
        const virtualBundle: VirtualBundle = {
          id: generateId(),
          name: 'Equipment by Location (Derived)',
          description: 'Derived dataset showing equipment with their functional locations',
          type: 'join',
          sourceJoinIds: [sampleJoin.id],
          schemaId: tabularSchema.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        addVirtualBundle(virtualBundle);

        alert(
          'Sample join created successfully!\n\n' +
          'Join: "Equipment by Location"\n' +
          'Type: Left Join (all locations, with equipment where available)\n' +
          'Derived Dataset: "Equipment by Location (Derived)"\n\n' +
          'You can now explore the joined data or create additional joins.'
        );
      } else {
        // Show info about creating joins manually
        const viewDatasets = confirm(
          'Sample datasets are ready!\n\n' +
          'The datasets are now in your Datasets list.\n\n' +
          'To create a join:\n' +
          '1. Click "New Join" button above\n' +
          '2. Select both datasets\n' +
          '3. Choose join type\n' +
          '4. Map FLOC_ID to FLOC_ID\n\n' +
          'Would you like to view the datasets now?'
        );

        if (viewDatasets) {
          setViewMode('bundles');
        }
      }

    } catch (error) {
      console.error('Failed to load sample data:', error);
      alert('Failed to load sample data. Please check the console for details.');
    } finally {
      setLoadingSamples(false);
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
          <p className="text-zinc-500 text-sm mt-1">Manage joins and derived datasets</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-zinc-700"
            onClick={handleLoadSampleData}
            disabled={loadingSamples}
          >
            <Download className="w-4 h-4 mr-2" />
            {loadingSamples ? 'Loading...' : 'Load Sample Data'}
          </Button>
          <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <GitMerge className="w-4 h-4 mr-2" />
                New Join
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-zinc-900 border-zinc-800">
              <JoinBuilder />
            </DialogContent>
          </Dialog>
        </div>
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
            <div className="flex flex-col gap-2">
              <Button onClick={() => setShowBuilder(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <GitMerge className="w-4 h-4 mr-2" />
                Create Join
              </Button>
              <Button onClick={handleLoadSampleData} variant="outline" className="border-zinc-700" disabled={loadingSamples}>
                <Download className="w-4 h-4 mr-2" />
                {loadingSamples ? 'Loading...' : 'Try with Sample Data'}
              </Button>
            </div>
            <p className="text-zinc-600 text-xs mt-4">
              Sample data includes SAP Functional Locations and Equipment Assets
            </p>
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

                    {/* Derived Datasets */}
                    {dependentVBundles.length > 0 && (
                      <div>
                        <div className="text-xs text-zinc-500 mb-2">Derived Datasets:</div>
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
                                    if (confirm(`Delete derived dataset "${vb.name}"?`)) {
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
                            ? 'Both source datasets are missing'
                            : !leftBundle
                            ? 'Left dataset is missing'
                            : 'Right dataset is missing'}
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
