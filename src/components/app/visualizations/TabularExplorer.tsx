import { useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { profileTabularData } from '@/lib/dataUtils';
import { callLLM } from '@/lib/aiService';
import { explainColumnPrompt } from '@/lib/aiPrompts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { BarChart3, Hash, Type, Calendar, ToggleLeft, AlertCircle, Search, Eye, ShieldCheck, ChevronDown, ChevronRight, HelpCircle, Sparkles, Loader2, Database, Link2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema, TabularProfile, CriticalDataElement, CDEDataType } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

const typeIcons = {
  string: Type,
  number: Hash,
  date: Calendar,
  boolean: ToggleLeft,
  mixed: AlertCircle,
};

const typeColors = {
  string: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  number: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  date: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  boolean: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  mixed: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export function TabularExplorer({ bundle }: Props) {
  const [viewMode, setViewMode] = useState<'profile' | 'grid'>('profile');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'nulls' | 'unique'>('name');

  const profiles = useMemo(() => {
    try {
      return profileTabularData(bundle.source, bundle.mappings);
    } catch (e) {
      console.error('Failed to profile data:', e);
      return [];
    }
  }, [bundle]);

  const filteredProfiles = useMemo(() => {
    let result = profiles;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) => p.column.toLowerCase().includes(term) || p.displayName.toLowerCase().includes(term)
      );
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nulls':
          return b.nullCount - a.nullCount;
        case 'unique':
          return b.uniqueCount - a.uniqueCount;
        default:
          return a.column.localeCompare(b.column);
      }
    });
    return result;
  }, [profiles, searchTerm, sortBy]);

  const summary = useMemo(() => {
    const totalRows = bundle.source.parsedData.length;
    const totalColumns = bundle.source.columns.length;
    const mappedColumns = bundle.mappings.length;
    const columnsWithNulls = profiles.filter((p) => p.nullCount > 0).length;
    const avgCompleteness =
      profiles.length > 0
        ? profiles.reduce((acc, p) => acc + (p.totalCount - p.nullCount) / p.totalCount, 0) /
          profiles.length
        : 1;
    const avgQuality =
      profiles.length > 0
        ? Math.round(profiles.reduce((acc, p) => acc + p.qualityScore, 0) / profiles.length)
        : 100;
    return {
      totalRows,
      totalColumns,
      mappedColumns,
      columnsWithNulls,
      avgCompleteness: Math.round(avgCompleteness * 100),
      avgQuality
    };
  }, [bundle, profiles]);

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('profile')} />;
  }

  // Show profile view
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-zinc-400">Data Profile</span>
          </div>
          <div className="flex gap-4 text-sm">
            <div><span className="text-zinc-500">Rows: </span><span className="text-zinc-200 font-medium">{summary.totalRows.toLocaleString()}</span></div>
            <div><span className="text-zinc-500">Columns: </span><span className="text-zinc-200 font-medium">{summary.totalColumns}</span></div>
            <div><span className="text-zinc-500">Mapped: </span><span className="text-zinc-200 font-medium">{summary.mappedColumns}</span></div>
            <div><span className="text-zinc-500">Completeness: </span><span className="text-emerald-400 font-medium">{summary.avgCompleteness}%</span></div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className={`w-4 h-4 ${summary.avgQuality >= 80 ? 'text-emerald-400' : summary.avgQuality >= 60 ? 'text-amber-400' : 'text-red-400'}`} />
              <span className="text-zinc-500">Quality: </span>
              <span className={`font-medium ${summary.avgQuality >= 80 ? 'text-emerald-400' : summary.avgQuality >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {summary.avgQuality}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode('grid')}
            className="h-8 gap-1.5 border-zinc-700 hover:bg-zinc-800"
          >
            <Eye className="w-3.5 h-3.5" />
            View Data
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div className="flex gap-1">
            {(['name', 'nulls', 'unique'] as const).map((s) => (
              <Button key={s} size="sm" variant={sortBy === s ? 'secondary' : 'ghost'} onClick={() => setSortBy(s)} className="h-8 text-xs capitalize">{s}</Button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.map((profile) => (
            <ProfileCard key={profile.column} profile={profile} totalRows={summary.totalRows} bundle={bundle} />
          ))}
        </div>
        {filteredProfiles.length === 0 && (
          <div className="text-center py-12 text-zinc-500">No columns match your search</div>
        )}
      </ScrollArea>
    </div>
  );
}

function ProfileCard({ profile, totalRows, bundle }: { profile: TabularProfile; totalRows: number; bundle: DataBundle }) {
  const aiSettings = useAppStore((s) => s.aiSettings);
  const cdes = useAppStore((s) => s.cdes);
  const addCDE = useAppStore((s) => s.addCDE);
  const kpis = useAppStore((s) => s.kpis);
  const dqRules = useAppStore((s) => s.dqRules);
  const outcomes = useAppStore((s) => s.businessOutcomes);

  const [showIssues, setShowIssues] = useState(false);
  const [showCdeDetails, setShowCdeDetails] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');

  // CDE dialog state
  const [showCdeDialog, setShowCdeDialog] = useState(false);
  const [cdeName, setCdeName] = useState('');
  const [cdeDescription, setCdeDescription] = useState('');
  const [cdeDefinition, setCdeDefinition] = useState('');
  const [cdeDataType, setCdeDataType] = useState<CDEDataType>('string');
  const [cdeKpiIds, setCdeKpiIds] = useState<string[]>([]);

  // Check if this column is already a CDE
  const existingCde = cdes.find(
    (cde) => cde.bundleId === bundle.id && cde.columnName === profile.column
  );

  const resetCdeForm = () => {
    setCdeName(profile.displayName);
    setCdeDescription(`Data element from ${bundle.name}`);
    setCdeDefinition('');
    setCdeDataType(profile.dataType === 'number' ? 'number' : profile.dataType === 'date' ? 'date' : profile.dataType === 'boolean' ? 'boolean' : 'string');
    setCdeKpiIds([]);
  };

  const handleMarkAsCde = () => {
    resetCdeForm();
    setShowCdeDialog(true);
  };

  const handleCreateCde = () => {
    const now = new Date().toISOString();
    const newCde: CriticalDataElement = {
      id: `cde-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: cdeName.trim(),
      description: cdeDescription.trim(),
      dataType: cdeDataType,
      businessDefinition: cdeDefinition.trim(),
      bundleId: bundle.id,
      columnName: profile.column,
      sourceSystem: bundle.name,
      sourceTable: bundle.source.fileName,
      sourceColumn: profile.column,
      kpiIds: cdeKpiIds,
      dqRuleIds: [],
      createdAt: now,
      updatedAt: now,
    };
    addCDE(newCde);
    setShowCdeDialog(false);
  };

  const Icon = typeIcons[profile.dataType];
  const colorClass = typeColors[profile.dataType];
  const completeness = Math.round(((totalRows - profile.nullCount) / totalRows) * 100);
  const uniqueness = Math.round((profile.uniqueCount / totalRows) * 100);

  const qualityColor = profile.qualityScore >= 80 ? 'text-emerald-400' : profile.qualityScore >= 60 ? 'text-amber-400' : 'text-red-400';
  const qualityBgColor = profile.qualityScore >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : profile.qualityScore >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const handleExplainColumn = async () => {
    setIsExplaining(true);

    try {
      const sampleValues = bundle.source.parsedData
        .slice(0, 20)
        .map((row) => row[profile.column])
        .filter((v) => v != null);

      const prompt = explainColumnPrompt(
        profile.displayName,
        sampleValues,
        profile.nullCount,
        profile.uniqueCount,
        profile.totalCount
      );

      const response = await callLLM(prompt, aiSettings);

      if (response.success) {
        setExplanation(response.content);
        setShowExplanation(true);
      } else {
        setExplanation(`Error: ${response.error || 'Failed to generate explanation'}`);
        setShowExplanation(true);
      }
    } catch (err) {
      setExplanation(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setShowExplanation(true);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <Card className={`bg-zinc-900 border-zinc-800 ${existingCde ? 'ring-1 ring-amber-500/30' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium truncate">{profile.displayName}</CardTitle>
              {existingCde && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">
                  <Database className="w-2.5 h-2.5 mr-0.5" />
                  CDE
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-mono truncate">{profile.column}</p>
          </div>
          <div className="flex gap-1.5 ml-2 shrink-0">
            <Badge variant="outline" className={qualityBgColor}>
              <ShieldCheck className={`w-3 h-3 mr-1 ${qualityColor}`} />
              <span className={qualityColor}>{profile.qualityScore}</span>
            </Badge>
            <Badge variant="outline" className={colorClass}>
              <Icon className="w-3 h-3 mr-1" />
              {profile.dataType}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-semibold text-zinc-200">{profile.totalCount.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <div className="bg-zinc-800/50 rounded-lg p-2 cursor-pointer hover:bg-zinc-800 transition-colors group relative">
                <div className="text-lg font-semibold text-zinc-200">{profile.uniqueCount.toLocaleString()}</div>
                <div className="text-xs text-zinc-500 flex items-center justify-center gap-1">
                  Unique
                  {profile.topValues && profile.topValues.length > 0 && (
                    <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
            </DialogTrigger>
            {profile.topValues && profile.topValues.length > 0 && (
              <DialogContent className="max-w-2xl max-h-[80vh] bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle className="text-zinc-200">
                    Unique Values: {profile.displayName}
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-1">
                    {profile.topValues.map((tv, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-zinc-300 font-mono text-sm truncate flex-1">{tv.value}</span>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="text-zinc-500 text-sm">{tv.count.toLocaleString()}</span>
                          <div className="w-24 bg-zinc-700 rounded-full h-2">
                            <div
                              className="bg-emerald-500 h-2 rounded-full"
                              style={{ width: `${(tv.count / totalRows) * 100}%` }}
                            />
                          </div>
                          <span className="text-zinc-500 text-xs w-12 text-right">
                            {((tv.count / totalRows) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            )}
          </Dialog>
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className={`text-lg font-semibold ${profile.nullCount > 0 ? 'text-amber-400' : 'text-zinc-200'}`}>{profile.nullCount.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Nulls</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Completeness</span>
            <span className={completeness < 80 ? 'text-amber-400' : 'text-emerald-400'}>{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-1.5" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Uniqueness</span>
            <span className="text-zinc-400">{uniqueness}%</span>
          </div>
          <Progress value={uniqueness} className="h-1.5" />
        </div>

        {profile.numericStats && (
          <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between"><span className="text-zinc-500">Min</span><span className="text-zinc-300">{profile.numericStats.min.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Max</span><span className="text-zinc-300">{profile.numericStats.max.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Mean</span><span className="text-zinc-300">{profile.numericStats.mean.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Median</span><span className="text-zinc-300">{profile.numericStats.median.toLocaleString()}</span></div>
          </div>
        )}

        {profile.topValues && profile.topValues.length > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="text-xs text-zinc-500 mb-2">Top Values</div>
            <div className="space-y-1">
              {profile.topValues.slice(0, 5).map((tv, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 truncate text-zinc-300">{tv.value}</div>
                  <div className="text-zinc-500">{tv.count}</div>
                  <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(tv.count / totalRows) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.qualityIssues && profile.qualityIssues.length > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <button
              onClick={() => setShowIssues(!showIssues)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors w-full"
            >
              {showIssues ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Quality Issues ({profile.qualityIssues.length})</span>
            </button>
            {showIssues && (
              <div className="mt-2 space-y-1">
                {profile.qualityIssues.map((issue, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded text-xs ${
                      issue.severity === 'error'
                        ? 'bg-red-500/10 text-red-400'
                        : issue.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="flex-1">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aiSettings.enabled && (
          <div className="pt-2 border-t border-zinc-800">
            <Dialog open={showExplanation} onOpenChange={setShowExplanation}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-purple-500/30 hover:bg-purple-500/10"
                  onClick={handleExplainColumn}
                  disabled={isExplaining}
                >
                  {isExplaining ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-3 h-3 mr-2 text-purple-400" />
                      Explain Column
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Column Explanation
                  </DialogTitle>
                  <DialogDescription>
                    AI analysis of {profile.displayName}
                  </DialogDescription>
                </DialogHeader>
                <Alert className="bg-zinc-800/50 border-zinc-700">
                  <AlertDescription className="text-zinc-200 whitespace-pre-wrap">
                    {explanation || 'Generating explanation...'}
                  </AlertDescription>
                </Alert>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Mark as CDE section */}
        <div className="pt-2 border-t border-zinc-800">
          {existingCde ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowCdeDetails(!showCdeDetails)}
                className="w-full flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <div className="text-left">
                    <div className="text-xs font-medium text-amber-300">{existingCde.name}</div>
                    <div className="text-[10px] text-amber-400/70">Critical Data Element</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {existingCde.kpiIds.length > 0 && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                      <Link2 className="w-2.5 h-2.5 mr-1" />
                      {existingCde.kpiIds.length} KPI{existingCde.kpiIds.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {showCdeDetails ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-amber-400" />}
                </div>
              </button>

              {showCdeDetails && (
                <CDEContextPanel cde={existingCde} kpis={kpis} dqRules={dqRules} outcomes={outcomes} />
              )}
            </div>
          ) : (
            <Dialog open={showCdeDialog} onOpenChange={setShowCdeDialog}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-amber-500/30 hover:bg-amber-500/10"
                  onClick={handleMarkAsCde}
                >
                  <Database className="w-3 h-3 mr-2 text-amber-400" />
                  Mark as CDE
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-400" />
                    Mark as Critical Data Element
                  </DialogTitle>
                  <DialogDescription>
                    Register this column as a CDE to track its business importance and link it to KPIs.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="cde-name">Name</Label>
                    <input
                      id="cde-name"
                      value={cdeName}
                      onChange={(e) => setCdeName(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cde-description">Description</Label>
                    <input
                      id="cde-description"
                      value={cdeDescription}
                      onChange={(e) => setCdeDescription(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cde-definition">Business Definition</Label>
                    <Textarea
                      id="cde-definition"
                      value={cdeDefinition}
                      onChange={(e) => setCdeDefinition(e.target.value)}
                      placeholder="Describe what this data element means in business terms..."
                      className="bg-zinc-800 border-zinc-700 min-h-[80px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Data Type</Label>
                      <Select value={cdeDataType} onValueChange={(v) => setCdeDataType(v as CDEDataType)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="identifier">Identifier</SelectItem>
                          <SelectItem value="currency">Currency</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Source</Label>
                      <div className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2">
                        <div className="truncate">{bundle.name}</div>
                        <div className="text-zinc-500 truncate">{profile.column}</div>
                      </div>
                    </div>
                  </div>
                  {kpis.length > 0 && (
                    <div className="grid gap-2">
                      <Label>Link to KPIs (optional)</Label>
                      <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto bg-zinc-800/50 rounded-md p-2 border border-zinc-700">
                        {kpis.map((kpi) => (
                          <label key={kpi.id} className="flex items-center gap-2 text-xs text-zinc-300 p-1 hover:bg-zinc-800 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cdeKpiIds.includes(kpi.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCdeKpiIds([...cdeKpiIds, kpi.id]);
                                } else {
                                  setCdeKpiIds(cdeKpiIds.filter((id) => id !== kpi.id));
                                }
                              }}
                              className="rounded border-zinc-600 bg-zinc-700"
                            />
                            {kpi.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" onClick={() => setShowCdeDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateCde}
                    disabled={!cdeName.trim() || !cdeDefinition.trim()}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Create CDE
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CDEContextPanelProps {
  cde: CriticalDataElement;
  kpis: import('@/types').KPI[];
  dqRules: import('@/types').DataQualityRule[];
  outcomes: import('@/types').BusinessOutcome[];
}

function CDEContextPanel({ cde, kpis, dqRules, outcomes }: CDEContextPanelProps) {
  // Get linked KPIs
  const linkedKpis = kpis.filter((kpi) => cde.kpiIds.includes(kpi.id));

  // Get DQ rules for this CDE
  const linkedRules = dqRules.filter((rule) => rule.cdeId === cde.id);

  // Get outcomes through KPIs
  const linkedOutcomeIds = new Set(linkedKpis.flatMap((kpi) => kpi.outcomeIds));
  const linkedOutcomes = outcomes.filter((o) => linkedOutcomeIds.has(o.id));

  // Calculate overall DQ score from linked rules
  const rulesWithResults = linkedRules.filter((r) => r.lastRunResult);
  const avgPassRate = rulesWithResults.length > 0
    ? rulesWithResults.reduce((sum, r) => sum + (r.lastRunResult?.passRate || 0), 0) / rulesWithResults.length
    : null;

  return (
    <div className="space-y-3 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700">
      {/* Business Definition */}
      {cde.businessDefinition && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Business Definition</div>
          <p className="text-xs text-zinc-300">{cde.businessDefinition}</p>
        </div>
      )}

      {/* Linked Outcomes */}
      {linkedOutcomes.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
            Linked Outcomes ({linkedOutcomes.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {linkedOutcomes.map((outcome) => (
              <Badge
                key={outcome.id}
                variant="outline"
                className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                {outcome.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Linked KPIs */}
      {linkedKpis.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
            Linked KPIs ({linkedKpis.length})
          </div>
          <div className="space-y-1">
            {linkedKpis.map((kpi) => (
              <div
                key={kpi.id}
                className="flex items-center justify-between p-1.5 rounded bg-blue-500/10 border border-blue-500/20"
              >
                <span className="text-xs text-blue-300 truncate">{kpi.name}</span>
                <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">
                  {kpi.frequency}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DQ Rules */}
      {linkedRules.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
              DQ Rules ({linkedRules.length})
            </div>
            {avgPassRate !== null && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  avgPassRate >= 95
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : avgPassRate >= 80
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                {avgPassRate.toFixed(1)}% avg
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            {linkedRules.map((rule) => {
              const hasResult = rule.lastRunResult !== undefined;
              const passRate = rule.lastRunResult?.passRate || 0;
              const statusColor = !hasResult
                ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                : passRate >= rule.passThreshold
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : passRate >= rule.passThreshold * 0.9
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400';

              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-1.5 rounded border ${statusColor}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {rule.ruleType}
                    </Badge>
                    <span className="text-xs truncate">{rule.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasResult ? (
                      <>
                        <span className="text-[10px]">{passRate.toFixed(1)}%</span>
                        <span className="text-[9px] text-zinc-500">/ {rule.passThreshold}%</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Not run</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No links message */}
      {linkedKpis.length === 0 && linkedRules.length === 0 && (
        <div className="text-xs text-zinc-500 text-center py-2">
          No KPIs or DQ rules linked to this CDE yet.
        </div>
      )}
    </div>
  );
}
