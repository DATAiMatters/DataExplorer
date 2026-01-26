import { useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { generateId } from '@/lib/dataUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Target, Trash2, Pencil, Link2, MoreVertical, Unlink, Network, ShieldCheck, Play, ArrowRight, Activity, Zap, Database, Box, Layers } from 'lucide-react';
import { OutcomeCanvas } from './visualizations/OutcomeCanvas';
import type {
  BusinessOutcome,
  CriticalDataElement,
  DataQualityRule,
  KPI,
  OutcomeCategory,
  EntityStatus,
  KPIDirection,
  KPIFrequency,
  CDEDataType,
  DQRuleType,
  DQSeverity,
  ExecutionEngine,
} from '@/types';

const outcomeCategories: OutcomeCategory[] = [
  'financial',
  'operational',
  'compliance',
  'customer',
  'safety',
];

const entityStatuses: EntityStatus[] = ['draft', 'active', 'deprecated'];
const kpiDirections: KPIDirection[] = ['higher_is_better', 'lower_is_better', 'target_range'];
const kpiFrequencies: KPIFrequency[] = ['real-time', 'daily', 'weekly', 'monthly', 'quarterly'];
const cdeDataTypes: CDEDataType[] = ['string', 'number', 'date', 'boolean'];
const dqRuleTypes: DQRuleType[] = [
  'completeness',
  'validity',
  'consistency',
  'timeliness',
  'uniqueness',
  'accuracy',
];
const dqSeverities: DQSeverity[] = ['critical', 'major', 'minor'];
const executionEngines: ExecutionEngine[] = ['none', 'sql', 'great_expectations', 'custom'];

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export function BusinessOutcomes() {
  const outcomes = useAppStore((s) => s.businessOutcomes);
  const processAreas = useAppStore((s) => s.processAreas);
  const kpis = useAppStore((s) => s.kpis);
  const cdes = useAppStore((s) => s.cdes);
  const dqRules = useAppStore((s) => s.dqRules);
  const bundles = useAppStore((s) => s.bundles);
  const addOutcome = useAppStore((s) => s.addBusinessOutcome);
  const deleteOutcome = useAppStore((s) => s.deleteBusinessOutcome);
  const addKPI = useAppStore((s) => s.addKPI);
  const deleteKPI = useAppStore((s) => s.deleteKPI);
  const addCDE = useAppStore((s) => s.addCDE);
  const deleteCDE = useAppStore((s) => s.deleteCDE);
  const addDQRule = useAppStore((s) => s.addDQRule);
  const deleteDQRule = useAppStore((s) => s.deleteDQRule);
  const updateOutcome = useAppStore((s) => s.updateBusinessOutcome);
  const updateKPI = useAppStore((s) => s.updateKPI);
  const updateCDE = useAppStore((s) => s.updateCDE);
  const updateDQRule = useAppStore((s) => s.updateDQRule);

  // Calculate overall DQ health score
  const dqHealthScore = useMemo(() => {
    const rulesWithResults = dqRules.filter((r) => r.lastRunResult);
    if (rulesWithResults.length === 0) return null;
    return rulesWithResults.reduce((sum, r) => sum + (r.lastRunResult?.passRate || 0), 0) / rulesWithResults.length;
  }, [dqRules]);

  const rulesExecuted = dqRules.filter((r) => r.lastRunResult).length;

  const processAreaById = useMemo(
    () => new Map(processAreas.map((area) => [area.id, area])),
    [processAreas]
  );
  const outcomeById = useMemo(
    () => new Map(outcomes.map((outcome) => [outcome.id, outcome])),
    [outcomes]
  );

  const [activeTab, setActiveTab] = useState('outcomes');

  // Edit mode state - stores the ID of item being edited, null for create mode
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editingCdeId, setEditingCdeId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogType, setLinkDialogType] = useState<'outcome-kpi' | 'kpi-cde' | 'cde-rule' | null>(null);
  const [linkDialogSourceId, setLinkDialogSourceId] = useState<string | null>(null);

  const [isOutcomeDialogOpen, setIsOutcomeDialogOpen] = useState(false);
  const [outcomeName, setOutcomeName] = useState('');
  const [outcomeDescription, setOutcomeDescription] = useState('');
  const [outcomeCategory, setOutcomeCategory] = useState<OutcomeCategory>('operational');
  const [outcomeOwner, setOutcomeOwner] = useState('');
  const [outcomeTargetValue, setOutcomeTargetValue] = useState('');
  const [outcomeStatus, setOutcomeStatus] = useState<EntityStatus>('active');
  const [outcomeProcessAreaIds, setOutcomeProcessAreaIds] = useState<string[]>([]);
  const [outcomeTags, setOutcomeTags] = useState('');

  const [isKPIDialogOpen, setIsKPIDialogOpen] = useState(false);
  const [kpiName, setKpiName] = useState('');
  const [kpiDescription, setKpiDescription] = useState('');
  const [kpiFormula, setKpiFormula] = useState('');
  const [kpiUnit, setKpiUnit] = useState('');
  const [kpiDirection, setKpiDirection] = useState<KPIDirection>('higher_is_better');
  const [kpiTarget, setKpiTarget] = useState('');
  const [kpiWarning, setKpiWarning] = useState('');
  const [kpiCritical, setKpiCritical] = useState('');
  const [kpiFrequency, setKpiFrequency] = useState<KPIFrequency>('monthly');
  const [kpiOwner, setKpiOwner] = useState('');
  const [kpiStatus, setKpiStatus] = useState<EntityStatus>('active');
  const [kpiCalcWindow, setKpiCalcWindow] = useState('');
  const [kpiOutcomeIds, setKpiOutcomeIds] = useState<string[]>([]);
  const [kpiProcessAreaId, setKpiProcessAreaId] = useState<string>('none');

  const [isCDEDialogOpen, setIsCDEDialogOpen] = useState(false);
  const [cdeName, setCdeName] = useState('');
  const [cdeDescription, setCdeDescription] = useState('');
  const [cdeDataType, setCdeDataType] = useState<CDEDataType>('string');
  const [cdeDefinition, setCdeDefinition] = useState('');
  const [cdeSourceSystem, setCdeSourceSystem] = useState('');
  const [cdeSourceTable, setCdeSourceTable] = useState('');
  const [cdeSourceColumn, setCdeSourceColumn] = useState('');
  const [cdeOwner, setCdeOwner] = useState('');
  const [cdeStatus, setCdeStatus] = useState<EntityStatus>('active');
  const [cdeBundleId, setCdeBundleId] = useState('');
  const [cdeColumnName, setCdeColumnName] = useState('');
  const [cdeKpiIds, setCdeKpiIds] = useState<string[]>([]);

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleCdeId, setRuleCdeId] = useState('none');
  const [ruleType, setRuleType] = useState<DQRuleType>('completeness');
  const [ruleSeverity, setRuleSeverity] = useState<DQSeverity>('major');
  const [rulePassThreshold, setRulePassThreshold] = useState('99');
  const [ruleExecutable, setRuleExecutable] = useState(false);
  const [ruleExpression, setRuleExpression] = useState('');
  const [ruleExpectedPattern, setRuleExpectedPattern] = useState('');
  const [ruleReferenceDataset, setRuleReferenceDataset] = useState('');
  const [ruleEngine, setRuleEngine] = useState<ExecutionEngine>('none');
  const [ruleStatus, setRuleStatus] = useState<EntityStatus>('active');
  const [isRunningRules, setIsRunningRules] = useState(false);

  // Import the rule execution engine
  const runAllDQRules = async () => {
    setIsRunningRules(true);
    try {
      const { executeRule } = await import('@/lib/dqRuleEngine');

      for (const rule of dqRules) {
        // Find the CDE for this rule
        const cde = cdes.find((c) => c.id === rule.cdeId);
        if (!cde || !cde.bundleId || !cde.columnName) continue;

        // Find the bundle
        const bundle = bundles.find((b) => b.id === cde.bundleId);
        if (!bundle) continue;

        // Execute the rule
        const result = executeRule({ bundle, cde, rule });

        // Update the rule with the result
        updateDQRule(rule.id, {
          lastRunDate: result.executedAt,
          lastRunResult: {
            totalRecords: result.totalRecords,
            passedRecords: result.passedRecords,
            failedRecords: result.failedRecords,
            passRate: result.passRate,
          },
        });
      }
    } finally {
      setIsRunningRules(false);
    }
  };

  const resetOutcomeForm = () => {
    setEditingOutcomeId(null);
    setOutcomeName('');
    setOutcomeDescription('');
    setOutcomeCategory('operational');
    setOutcomeOwner('');
    setOutcomeTargetValue('');
    setOutcomeStatus('active');
    setOutcomeProcessAreaIds([]);
    setOutcomeTags('');
  };

  const populateOutcomeForm = (outcome: BusinessOutcome) => {
    setEditingOutcomeId(outcome.id);
    setOutcomeName(outcome.name);
    setOutcomeDescription(outcome.description);
    setOutcomeCategory(outcome.category);
    setOutcomeOwner(outcome.owner || '');
    setOutcomeTargetValue(outcome.targetValue || '');
    setOutcomeStatus(outcome.status || 'active');
    setOutcomeProcessAreaIds(outcome.processAreaIds);
    setOutcomeTags(outcome.tags?.join(', ') || '');
  };

  const resetKPIForm = () => {
    setEditingKpiId(null);
    setKpiName('');
    setKpiDescription('');
    setKpiFormula('');
    setKpiUnit('');
    setKpiDirection('higher_is_better');
    setKpiTarget('');
    setKpiWarning('');
    setKpiCritical('');
    setKpiFrequency('monthly');
    setKpiOwner('');
    setKpiStatus('active');
    setKpiCalcWindow('');
    setKpiOutcomeIds([]);
    setKpiProcessAreaId('none');
  };

  const populateKPIForm = (kpi: KPI) => {
    setEditingKpiId(kpi.id);
    setKpiName(kpi.name);
    setKpiDescription(kpi.description);
    setKpiFormula(kpi.formula || '');
    setKpiUnit(kpi.unit);
    setKpiDirection(kpi.direction);
    setKpiTarget(kpi.targetValue?.toString() || '');
    setKpiWarning(kpi.warningThreshold?.toString() || '');
    setKpiCritical(kpi.criticalThreshold?.toString() || '');
    setKpiFrequency(kpi.frequency);
    setKpiOwner(kpi.owner || '');
    setKpiStatus(kpi.status || 'active');
    setKpiCalcWindow(kpi.calculationWindow || '');
    setKpiOutcomeIds(kpi.outcomeIds);
    setKpiProcessAreaId(kpi.processAreaId || 'none');
  };

  const resetCDEForm = () => {
    setEditingCdeId(null);
    setCdeName('');
    setCdeDescription('');
    setCdeDataType('string');
    setCdeDefinition('');
    setCdeSourceSystem('');
    setCdeSourceTable('');
    setCdeSourceColumn('');
    setCdeOwner('');
    setCdeStatus('active');
    setCdeBundleId('');
    setCdeColumnName('');
    setCdeKpiIds([]);
  };

  const populateCDEForm = (cde: CriticalDataElement) => {
    setEditingCdeId(cde.id);
    setCdeName(cde.name);
    setCdeDescription(cde.description);
    setCdeDataType(cde.dataType);
    setCdeDefinition(cde.businessDefinition);
    setCdeSourceSystem(cde.sourceSystem || '');
    setCdeSourceTable(cde.sourceTable || '');
    setCdeSourceColumn(cde.sourceColumn || '');
    setCdeOwner(cde.owner || '');
    setCdeStatus(cde.status || 'active');
    setCdeBundleId(cde.bundleId || '');
    setCdeColumnName(cde.columnName || '');
    setCdeKpiIds(cde.kpiIds);
  };

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleDescription('');
    setRuleCdeId('none');
    setRuleType('completeness');
    setRuleSeverity('major');
    setRulePassThreshold('99');
    setRuleExecutable(false);
    setRuleExpression('');
    setRuleExpectedPattern('');
    setRuleReferenceDataset('');
    setRuleEngine('none');
    setRuleStatus('active');
  };

  const populateRuleForm = (rule: DataQualityRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.description);
    setRuleCdeId(rule.cdeId);
    setRuleType(rule.ruleType);
    setRuleSeverity(rule.severity);
    setRulePassThreshold(rule.passThreshold.toString());
    setRuleExecutable(rule.isExecutable);
    setRuleExpression(rule.expression || '');
    setRuleExpectedPattern(rule.expectedPattern || '');
    setRuleReferenceDataset(rule.referenceDataset || '');
    setRuleEngine(rule.executionEngine || 'none');
    setRuleStatus(rule.status || 'active');
  };

  const handleSaveOutcome = () => {
    const now = new Date().toISOString();
    const tags = outcomeTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (editingOutcomeId) {
      // Update existing
      updateOutcome(editingOutcomeId, {
        name: outcomeName.trim(),
        description: outcomeDescription.trim(),
        category: outcomeCategory,
        owner: outcomeOwner.trim() || undefined,
        targetValue: outcomeTargetValue.trim() || undefined,
        status: outcomeStatus,
        tags: tags.length > 0 ? tags : undefined,
        processAreaIds: outcomeProcessAreaIds,
      });
    } else {
      // Create new
      const newOutcome: BusinessOutcome = {
        id: generateId(),
        name: outcomeName.trim(),
        description: outcomeDescription.trim(),
        category: outcomeCategory,
        owner: outcomeOwner.trim() || undefined,
        targetValue: outcomeTargetValue.trim() || undefined,
        status: outcomeStatus,
        tags: tags.length > 0 ? tags : undefined,
        processAreaIds: outcomeProcessAreaIds,
        createdAt: now,
        updatedAt: now,
      };
      addOutcome(newOutcome);
    }
    setIsOutcomeDialogOpen(false);
    resetOutcomeForm();
  };

  const handleSaveKPI = () => {
    const now = new Date().toISOString();

    if (editingKpiId) {
      // Update existing - preserve cdeIds
      const existingKpi = kpis.find((k) => k.id === editingKpiId);
      updateKPI(editingKpiId, {
        name: kpiName.trim(),
        description: kpiDescription.trim(),
        formula: kpiFormula.trim() || undefined,
        unit: kpiUnit.trim(),
        direction: kpiDirection,
        targetValue: parseOptionalNumber(kpiTarget),
        warningThreshold: parseOptionalNumber(kpiWarning),
        criticalThreshold: parseOptionalNumber(kpiCritical),
        frequency: kpiFrequency,
        owner: kpiOwner.trim() || undefined,
        status: kpiStatus,
        calculationWindow: kpiCalcWindow.trim() || undefined,
        outcomeIds: kpiOutcomeIds,
        processAreaId: kpiProcessAreaId === 'none' ? undefined : kpiProcessAreaId,
        cdeIds: existingKpi?.cdeIds || [],
      });
    } else {
      // Create new
      const newKpi: KPI = {
        id: generateId(),
        name: kpiName.trim(),
        description: kpiDescription.trim(),
        formula: kpiFormula.trim() || undefined,
        unit: kpiUnit.trim(),
        direction: kpiDirection,
        targetValue: parseOptionalNumber(kpiTarget),
        warningThreshold: parseOptionalNumber(kpiWarning),
        criticalThreshold: parseOptionalNumber(kpiCritical),
        frequency: kpiFrequency,
        owner: kpiOwner.trim() || undefined,
        status: kpiStatus,
        calculationWindow: kpiCalcWindow.trim() || undefined,
        outcomeIds: kpiOutcomeIds,
        processAreaId: kpiProcessAreaId === 'none' ? undefined : kpiProcessAreaId,
        cdeIds: [],
        createdAt: now,
        updatedAt: now,
      };
      addKPI(newKpi);
    }
    setIsKPIDialogOpen(false);
    resetKPIForm();
  };

  const handleSaveCDE = () => {
    const now = new Date().toISOString();

    if (editingCdeId) {
      // Update existing - preserve dqRuleIds
      const existingCde = cdes.find((c) => c.id === editingCdeId);
      updateCDE(editingCdeId, {
        name: cdeName.trim(),
        description: cdeDescription.trim(),
        dataType: cdeDataType,
        businessDefinition: cdeDefinition.trim(),
        sourceSystem: cdeSourceSystem.trim() || undefined,
        sourceTable: cdeSourceTable.trim() || undefined,
        sourceColumn: cdeSourceColumn.trim() || undefined,
        owner: cdeOwner.trim() || undefined,
        status: cdeStatus,
        bundleId: cdeBundleId.trim() || undefined,
        columnName: cdeColumnName.trim() || undefined,
        kpiIds: cdeKpiIds,
        dqRuleIds: existingCde?.dqRuleIds || [],
      });
    } else {
      // Create new
      const newCde: CriticalDataElement = {
        id: generateId(),
        name: cdeName.trim(),
        description: cdeDescription.trim(),
        dataType: cdeDataType,
        businessDefinition: cdeDefinition.trim(),
        sourceSystem: cdeSourceSystem.trim() || undefined,
        sourceTable: cdeSourceTable.trim() || undefined,
        sourceColumn: cdeSourceColumn.trim() || undefined,
        owner: cdeOwner.trim() || undefined,
        status: cdeStatus,
        bundleId: cdeBundleId.trim() || undefined,
        columnName: cdeColumnName.trim() || undefined,
        kpiIds: cdeKpiIds,
        dqRuleIds: [],
        createdAt: now,
        updatedAt: now,
      };
      addCDE(newCde);
    }
    setIsCDEDialogOpen(false);
    resetCDEForm();
  };

  const handleSaveRule = () => {
    if (ruleCdeId === 'none' && !editingRuleId) return;
    const now = new Date().toISOString();

    if (editingRuleId) {
      // Update existing
      updateDQRule(editingRuleId, {
        name: ruleName.trim(),
        description: ruleDescription.trim(),
        cdeId: ruleCdeId === 'none' ? '' : ruleCdeId,
        ruleType,
        expression: ruleExpression.trim() || undefined,
        expectedPattern: ruleExpectedPattern.trim() || undefined,
        referenceDataset: ruleReferenceDataset.trim() || undefined,
        executionEngine: ruleEngine,
        status: ruleStatus,
        severity: ruleSeverity,
        passThreshold: parseOptionalNumber(rulePassThreshold) ?? 99,
        isExecutable: ruleExecutable,
      });
    } else {
      // Create new
      const newRule: DataQualityRule = {
        id: generateId(),
        name: ruleName.trim(),
        description: ruleDescription.trim(),
        cdeId: ruleCdeId,
        ruleType,
        expression: ruleExpression.trim() || undefined,
        expectedPattern: ruleExpectedPattern.trim() || undefined,
        referenceDataset: ruleReferenceDataset.trim() || undefined,
        executionEngine: ruleEngine,
        status: ruleStatus,
        severity: ruleSeverity,
        passThreshold: parseOptionalNumber(rulePassThreshold) ?? 99,
        isExecutable: ruleExecutable,
        createdAt: now,
        updatedAt: now,
      };
      addDQRule(newRule);
    }
    setIsRuleDialogOpen(false);
    resetRuleForm();
  };

  // Link management functions
  const linkKpiToOutcome = (kpiId: string, outcomeId: string) => {
    const kpi = kpis.find((k) => k.id === kpiId);
    if (kpi && !kpi.outcomeIds.includes(outcomeId)) {
      updateKPI(kpiId, { outcomeIds: [...kpi.outcomeIds, outcomeId] });
    }
  };

  const unlinkKpiFromOutcome = (kpiId: string, outcomeId: string) => {
    const kpi = kpis.find((k) => k.id === kpiId);
    if (kpi) {
      updateKPI(kpiId, { outcomeIds: kpi.outcomeIds.filter((id) => id !== outcomeId) });
    }
  };

  const linkCdeToKpi = (cdeId: string, kpiId: string) => {
    const cde = cdes.find((c) => c.id === cdeId);
    const kpi = kpis.find((k) => k.id === kpiId);
    if (cde && !cde.kpiIds.includes(kpiId)) {
      updateCDE(cdeId, { kpiIds: [...cde.kpiIds, kpiId] });
    }
    if (kpi && !kpi.cdeIds.includes(cdeId)) {
      updateKPI(kpiId, { cdeIds: [...kpi.cdeIds, cdeId] });
    }
  };

  const unlinkCdeFromKpi = (cdeId: string, kpiId: string) => {
    const cde = cdes.find((c) => c.id === cdeId);
    const kpi = kpis.find((k) => k.id === kpiId);
    if (cde) {
      updateCDE(cdeId, { kpiIds: cde.kpiIds.filter((id) => id !== kpiId) });
    }
    if (kpi) {
      updateKPI(kpiId, { cdeIds: kpi.cdeIds.filter((id) => id !== cdeId) });
    }
  };

  const linkRuleToCde = (ruleId: string, cdeId: string) => {
    const rule = dqRules.find((r) => r.id === ruleId);
    const cde = cdes.find((c) => c.id === cdeId);
    if (rule) {
      updateDQRule(ruleId, { cdeId });
    }
    if (cde && !cde.dqRuleIds.includes(ruleId)) {
      updateCDE(cdeId, { dqRuleIds: [...cde.dqRuleIds, ruleId] });
    }
  };

  const unlinkRuleFromCde = (ruleId: string, cdeId: string) => {
    const cde = cdes.find((c) => c.id === cdeId);
    if (cde) {
      updateCDE(cdeId, { dqRuleIds: cde.dqRuleIds.filter((id) => id !== ruleId) });
    }
    // Note: rule still has cdeId but it's now orphaned
  };

  // Get unlinked items for link dialog
  const getUnlinkedKpisForOutcome = (outcomeId: string) => {
    return kpis.filter((kpi) => !kpi.outcomeIds.includes(outcomeId));
  };

  const getUnlinkedCdesForKpi = (kpiId: string) => {
    return cdes.filter((cde) => !cde.kpiIds.includes(kpiId));
  };

  const getUnlinkedRulesForCde = (cdeId: string) => {
    return dqRules.filter((rule) => rule.cdeId !== cdeId);
  };

  const totalOutcomes = outcomes.length;
  const totalKpis = kpis.length;
  const totalCdes = cdes.length;
  const totalRules = dqRules.length;

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" />
            Business Outcomes
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Connect outcomes to KPIs, critical data elements, and quality rules.
          </p>
        </div>
      </header>

      {/* Extended Catalog Schema - Traceability Chain */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-300">Traceability Chain</span>
          <span className="text-xs text-zinc-500 ml-2">Goal → KPI → Decision → Signal → Rule → DataProduct → Dataset</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {/* Goal */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-zinc-400">Goal</span>
            </div>
            <div className="text-2xl font-semibold text-emerald-400">{totalOutcomes}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

          {/* KPI */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-blue-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-zinc-400">KPI</span>
            </div>
            <div className="text-2xl font-semibold text-blue-400">{totalKpis}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

          {/* Decision */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-orange-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-zinc-400">Decision</span>
            </div>
            <div className="text-2xl font-semibold text-orange-400">—</div>
            <div className="text-[10px] text-zinc-500">Neo4j only</div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

          {/* Signal */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-yellow-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs text-zinc-400">Signal</span>
            </div>
            <div className="text-2xl font-semibold text-yellow-400">—</div>
            <div className="text-[10px] text-zinc-500">Neo4j only</div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

          {/* Rule */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-violet-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-zinc-400">Rule</span>
            </div>
            <div className="text-2xl font-semibold text-violet-400">{totalRules}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

          {/* DataProduct */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-cyan-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-zinc-400">DataProduct</span>
            </div>
            <div className="text-2xl font-semibold text-cyan-400">—</div>
            <div className="text-[10px] text-zinc-500">Neo4j only</div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

          {/* Dataset */}
          <div className="flex-shrink-0 bg-zinc-800/50 border border-indigo-500/30 rounded-lg p-3 min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-zinc-400">Dataset</span>
            </div>
            <div className="text-2xl font-semibold text-indigo-400">—</div>
            <div className="text-[10px] text-zinc-500">SKP / Neo4j</div>
          </div>

          {/* DQ Health */}
          <div className="flex-shrink-0 ml-4 pl-4 border-l border-zinc-700">
            <div className={`bg-zinc-800/50 border rounded-lg p-3 min-w-[120px] ${dqHealthScore !== null ? (dqHealthScore >= 95 ? 'border-emerald-500/30' : dqHealthScore >= 80 ? 'border-amber-500/30' : 'border-red-500/30') : 'border-zinc-700'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs text-zinc-400">DQ Health</span>
              </div>
              {dqHealthScore !== null ? (
                <div className={`text-2xl font-semibold ${dqHealthScore >= 95 ? 'text-emerald-400' : dqHealthScore >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                  {dqHealthScore.toFixed(1)}%
                </div>
              ) : (
                <div className="text-2xl font-semibold text-zinc-500">—</div>
              )}
              <div className="text-[10px] text-zinc-500">{rulesExecuted}/{totalRules} executed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legacy Stats Grid - CDEs */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Critical Data Elements</CardDescription>
            <CardTitle className="text-3xl">{totalCdes}</CardTitle>
            <p className="text-xs text-zinc-500">Mapped to KPIs</p>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Linked KPI-CDE Pairs</CardDescription>
            <CardTitle className="text-3xl">{cdes.reduce((sum, c) => sum + c.kpiIds.length, 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Rules per CDE (avg)</CardDescription>
            <CardTitle className="text-3xl">{totalCdes > 0 ? (totalRules / totalCdes).toFixed(1) : '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Orphan Rules</CardDescription>
            <CardTitle className="text-3xl">{dqRules.filter(r => !r.cdeId || r.cdeId === 'none').length}</CardTitle>
            <p className="text-xs text-zinc-500">Not linked to CDE</p>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="bg-zinc-900 border border-zinc-800 w-fit">
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="cdes">CDEs</TabsTrigger>
          <TabsTrigger value="rules">DQ Rules</TabsTrigger>
          <TabsTrigger value="canvas">
            <Network className="w-4 h-4 mr-1" />
            Canvas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outcomes" className="flex-1 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Outcome Portfolio</h2>
              <p className="text-sm text-zinc-500">Start with outcomes and drill down to KPIs.</p>
            </div>
            <Dialog open={isOutcomeDialogOpen} onOpenChange={(open) => {
              setIsOutcomeDialogOpen(open);
              if (!open) resetOutcomeForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Outcome
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle>{editingOutcomeId ? 'Edit Business Outcome' : 'Create Business Outcome'}</DialogTitle>
                  <DialogDescription>Define the strategic result and link it to process areas.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="outcome-name">Name</Label>
                    <Input id="outcome-name" value={outcomeName} onChange={(e) => setOutcomeName(e.target.value)} placeholder="Minimize unplanned downtime" className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="outcome-description">Description</Label>
                    <Textarea id="outcome-description" value={outcomeDescription} onChange={(e) => setOutcomeDescription(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select value={outcomeCategory} onValueChange={(value) => setOutcomeCategory(value as OutcomeCategory)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {outcomeCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={outcomeStatus} onValueChange={(value) => setOutcomeStatus(value as EntityStatus)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="outcome-owner">Owner</Label>
                      <Input id="outcome-owner" value={outcomeOwner} onChange={(e) => setOutcomeOwner(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="outcome-target">Target Value</Label>
                      <Input id="outcome-target" value={outcomeTargetValue} onChange={(e) => setOutcomeTargetValue(e.target.value)} placeholder="Unplanned downtime < 2%" className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="outcome-tags">Tags (comma-separated)</Label>
                    <Input id="outcome-tags" value={outcomeTags} onChange={(e) => setOutcomeTags(e.target.value)} placeholder="reliability, maintenance" className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Process Areas</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {processAreas.map((area) => (
                        <label key={area.id} className="flex items-center gap-2 text-sm text-zinc-300">
                          <Checkbox
                            checked={outcomeProcessAreaIds.includes(area.id)}
                            onCheckedChange={(checked) => {
                              setOutcomeProcessAreaIds((prev) =>
                                checked
                                  ? [...prev, area.id]
                                  : prev.filter((id) => id !== area.id)
                              );
                            }}
                          />
                          {area.code} - {area.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOutcomeDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveOutcome} disabled={!outcomeName.trim()}>
                    {editingOutcomeId ? 'Save Changes' : 'Create Outcome'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[calc(100vh-360px)] pr-2">
            {outcomes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">No outcomes yet</h3>
                <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                  Create your first business outcome to anchor KPIs and data quality rules.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {outcomes.map((outcome) => {
                  const areas = outcome.processAreaIds
                    .map((id) => processAreaById.get(id))
                    .filter((area): area is NonNullable<typeof area> => Boolean(area));
                  const linkedKpis = kpis.filter((kpi) => kpi.outcomeIds.includes(outcome.id));
                  const unlinkedKpis = getUnlinkedKpisForOutcome(outcome.id);

                  // Calculate DQ score for outcome (aggregated from linked KPIs)
                  const outcomeRules: DataQualityRule[] = [];
                  for (const kpi of linkedKpis) {
                    const kpiCdes = cdes.filter((cde) => cde.kpiIds.includes(kpi.id));
                    for (const cde of kpiCdes) {
                      const cdeRules = dqRules.filter((r) => r.cdeId === cde.id);
                      outcomeRules.push(...cdeRules);
                    }
                  }
                  const executedOutcomeRules = outcomeRules.filter((r) => r.lastRunResult);
                  const outcomeDqScore = executedOutcomeRules.length > 0
                    ? Math.round(executedOutcomeRules.reduce((sum, r) => sum + (r.lastRunResult?.passRate || 0), 0) / executedOutcomeRules.length)
                    : null;

                  return (
                    <Card key={outcome.id} className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{outcome.name}</CardTitle>
                            <CardDescription className="mt-1">{outcome.description}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-200">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                populateOutcomeForm(outcome);
                                setIsOutcomeDialogOpen(true);
                              }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setLinkDialogType('outcome-kpi');
                                  setLinkDialogSourceId(outcome.id);
                                  setLinkDialogOpen(true);
                                }}
                                disabled={unlinkedKpis.length === 0}
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                Link KPI
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400"
                                onClick={() => {
                                  if (confirm('Delete this outcome?')) {
                                    deleteOutcome(outcome.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{outcome.category}</Badge>
                          {outcome.status && <Badge variant="outline">{outcome.status}</Badge>}
                          {outcome.owner && <Badge variant="outline">{outcome.owner}</Badge>}
                        </div>
                        {outcome.targetValue && (
                          <div className="text-sm text-zinc-400">
                            Target: <span className="text-zinc-200">{outcome.targetValue}</span>
                          </div>
                        )}
                        <div className="text-sm text-zinc-400">
                          Process Areas: {areas.map((area) => area.code).join(', ') || 'None'}
                        </div>
                        <div className="text-sm text-zinc-400">
                          Linked KPIs:{' '}
                          {linkedKpis.length === 0 ? (
                            <span className="text-zinc-500">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {linkedKpis.map((kpi) => (
                                <Badge
                                  key={kpi.id}
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-zinc-800 group"
                                  onClick={() => unlinkKpiFromOutcome(kpi.id, outcome.id)}
                                  title="Click to unlink"
                                >
                                  {kpi.name}
                                  <Unlink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100" />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {outcome.tags && outcome.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {outcome.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* DQ Score Section */}
                        {outcomeRules.length > 0 && (
                          <div className="border-t border-zinc-800 pt-3 mt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-zinc-400 flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4" />
                                DQ Score
                              </span>
                              {outcomeDqScore !== null ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    outcomeDqScore >= 80
                                      ? 'border-emerald-500/50 text-emerald-400'
                                      : outcomeDqScore >= 60
                                      ? 'border-amber-500/50 text-amber-400'
                                      : 'border-red-500/50 text-red-400'
                                  }
                                >
                                  {outcomeDqScore}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-zinc-500">Not run</Badge>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {executedOutcomeRules.length} of {outcomeRules.length} rules executed
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="kpis" className="flex-1 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">KPI Library</h2>
              <p className="text-sm text-zinc-500">Define metrics and link them to outcomes.</p>
            </div>
            <Dialog open={isKPIDialogOpen} onOpenChange={(open) => {
              setIsKPIDialogOpen(open);
              if (!open) resetKPIForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New KPI
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle>{editingKpiId ? 'Edit KPI' : 'Create KPI'}</DialogTitle>
                  <DialogDescription>Capture the metric definition and link it to outcomes.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="kpi-name">Name</Label>
                    <Input id="kpi-name" value={kpiName} onChange={(e) => setKpiName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="kpi-description">Description</Label>
                    <Textarea id="kpi-description" value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="kpi-formula">Formula</Label>
                    <Input id="kpi-formula" value={kpiFormula} onChange={(e) => setKpiFormula(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="kpi-unit">Unit</Label>
                      <Input id="kpi-unit" value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Direction</Label>
                      <Select value={kpiDirection} onValueChange={(value) => setKpiDirection(value as KPIDirection)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Direction" />
                        </SelectTrigger>
                        <SelectContent>
                          {kpiDirections.map((direction) => (
                            <SelectItem key={direction} value={direction}>
                              {direction}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Frequency</Label>
                      <Select value={kpiFrequency} onValueChange={(value) => setKpiFrequency(value as KPIFrequency)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {kpiFrequencies.map((freq) => (
                            <SelectItem key={freq} value={freq}>
                              {freq}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="kpi-target">Target</Label>
                      <Input id="kpi-target" value={kpiTarget} onChange={(e) => setKpiTarget(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="kpi-warning">Warning Threshold</Label>
                      <Input id="kpi-warning" value={kpiWarning} onChange={(e) => setKpiWarning(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="kpi-critical">Critical Threshold</Label>
                      <Input id="kpi-critical" value={kpiCritical} onChange={(e) => setKpiCritical(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="kpi-owner">Owner</Label>
                      <Input id="kpi-owner" value={kpiOwner} onChange={(e) => setKpiOwner(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={kpiStatus} onValueChange={(value) => setKpiStatus(value as EntityStatus)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="kpi-window">Calculation Window</Label>
                      <Input id="kpi-window" value={kpiCalcWindow} onChange={(e) => setKpiCalcWindow(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Process Area</Label>
                      <Select value={kpiProcessAreaId} onValueChange={setKpiProcessAreaId}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Select process area" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {processAreas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.code} - {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Linked Outcomes</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {outcomes.map((outcome) => (
                        <label key={outcome.id} className="flex items-center gap-2 text-sm text-zinc-300">
                          <Checkbox
                            checked={kpiOutcomeIds.includes(outcome.id)}
                            onCheckedChange={(checked) => {
                              setKpiOutcomeIds((prev) =>
                                checked
                                  ? [...prev, outcome.id]
                                  : prev.filter((id) => id !== outcome.id)
                              );
                            }}
                          />
                          {outcome.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsKPIDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveKPI} disabled={!kpiName.trim() || !kpiUnit.trim()}>
                    {editingKpiId ? 'Save Changes' : 'Create KPI'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[calc(100vh-360px)] pr-2">
            {kpis.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">No KPIs yet</h3>
                <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                  Create KPIs and attach them to outcomes to define success.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {kpis.map((kpi) => {
                  const linkedOutcomes = kpi.outcomeIds
                    .map((id) => outcomeById.get(id))
                    .filter((o): o is BusinessOutcome => Boolean(o));
                  const linkedCdes = cdes.filter((cde) => cde.kpiIds.includes(kpi.id));
                  const unlinkedCdes = getUnlinkedCdesForKpi(kpi.id);

                  // Get DQ rules linked to this KPI's CDEs and calculate aggregate score
                  const kpiRules = dqRules.filter((rule) => {
                    const cde = cdes.find((c) => c.id === rule.cdeId);
                    return cde && cde.kpiIds.includes(kpi.id);
                  });
                  const executedRules = kpiRules.filter((r) => r.lastRunResult);
                  const kpiDqScore = executedRules.length > 0
                    ? Math.round(executedRules.reduce((sum, r) => sum + (r.lastRunResult?.passRate || 0), 0) / executedRules.length)
                    : null;

                  return (
                    <Card key={kpi.id} className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{kpi.name}</CardTitle>
                            <CardDescription className="mt-1">{kpi.description}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-200">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                populateKPIForm(kpi);
                                setIsKPIDialogOpen(true);
                              }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setLinkDialogType('kpi-cde');
                                  setLinkDialogSourceId(kpi.id);
                                  setLinkDialogOpen(true);
                                }}
                                disabled={unlinkedCdes.length === 0}
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                Link CDE
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400"
                                onClick={() => {
                                  if (confirm('Delete this KPI?')) {
                                    deleteKPI(kpi.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{kpi.direction}</Badge>
                          <Badge variant="outline">{kpi.frequency}</Badge>
                          {kpi.status && <Badge variant="outline">{kpi.status}</Badge>}
                        </div>
                        <div className="text-sm text-zinc-400">
                          Unit: <span className="text-zinc-200">{kpi.unit}</span>
                        </div>
                        {kpi.formula && (
                          <div className="text-sm text-zinc-400">
                            Formula: <span className="text-zinc-200">{kpi.formula}</span>
                          </div>
                        )}
                        {kpi.targetValue !== undefined && (
                          <div className="text-sm text-zinc-400">
                            Target: <span className="text-zinc-200">{kpi.targetValue}</span>
                          </div>
                        )}
                        <div className="text-sm text-zinc-400">
                          Outcomes:{' '}
                          {linkedOutcomes.length === 0 ? (
                            <span className="text-zinc-500">None</span>
                          ) : (
                            <span className="text-zinc-200">{linkedOutcomes.map((o) => o.name).join(', ')}</span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400">
                          Linked CDEs:{' '}
                          {linkedCdes.length === 0 ? (
                            <span className="text-zinc-500">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {linkedCdes.map((cde) => (
                                <Badge
                                  key={cde.id}
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-zinc-800 group"
                                  onClick={() => unlinkCdeFromKpi(cde.id, kpi.id)}
                                  title="Click to unlink"
                                >
                                  {cde.name}
                                  <Unlink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100" />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* DQ Score Section */}
                        {kpiRules.length > 0 && (
                          <div className="border-t border-zinc-800 pt-3 mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-zinc-400 flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4" />
                                DQ Score
                              </span>
                              {kpiDqScore !== null ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    kpiDqScore >= 80
                                      ? 'border-emerald-500/50 text-emerald-400'
                                      : kpiDqScore >= 60
                                      ? 'border-amber-500/50 text-amber-400'
                                      : 'border-red-500/50 text-red-400'
                                  }
                                >
                                  {kpiDqScore}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-zinc-500">Not run</Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              {kpiRules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-500 truncate max-w-[150px]" title={rule.name}>{rule.name}</span>
                                  {rule.lastRunResult ? (
                                    <span className={
                                      rule.lastRunResult.passRate >= rule.passThreshold
                                        ? 'text-emerald-400'
                                        : rule.lastRunResult.passRate >= rule.passThreshold * 0.8
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                    }>
                                      {Math.round(rule.lastRunResult.passRate)}%
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">--</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="cdes" className="flex-1 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Critical Data Elements</h2>
              <p className="text-sm text-zinc-500">Register critical fields and link them to KPIs.</p>
            </div>
            <Dialog open={isCDEDialogOpen} onOpenChange={(open) => {
              setIsCDEDialogOpen(open);
              if (!open) resetCDEForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New CDE
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle>{editingCdeId ? 'Edit Critical Data Element' : 'Create Critical Data Element'}</DialogTitle>
                  <DialogDescription>Capture the business definition and data source.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="cde-name">Name</Label>
                    <Input id="cde-name" value={cdeName} onChange={(e) => setCdeName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cde-description">Description</Label>
                    <Textarea id="cde-description" value={cdeDescription} onChange={(e) => setCdeDescription(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cde-definition">Business Definition</Label>
                    <Textarea id="cde-definition" value={cdeDefinition} onChange={(e) => setCdeDefinition(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Data Type</Label>
                      <Select value={cdeDataType} onValueChange={(value) => setCdeDataType(value as CDEDataType)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Data type" />
                        </SelectTrigger>
                        <SelectContent>
                          {cdeDataTypes.map((dataType) => (
                            <SelectItem key={dataType} value={dataType}>
                              {dataType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={cdeStatus} onValueChange={(value) => setCdeStatus(value as EntityStatus)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cde-owner">Owner</Label>
                      <Input id="cde-owner" value={cdeOwner} onChange={(e) => setCdeOwner(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cde-system">Source System</Label>
                      <Input id="cde-system" value={cdeSourceSystem} onChange={(e) => setCdeSourceSystem(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cde-table">Source Table</Label>
                      <Input id="cde-table" value={cdeSourceTable} onChange={(e) => setCdeSourceTable(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cde-column">Source Column</Label>
                      <Input id="cde-column" value={cdeSourceColumn} onChange={(e) => setCdeSourceColumn(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="cde-bundle">Bundle ID</Label>
                      <Input id="cde-bundle" value={cdeBundleId} onChange={(e) => setCdeBundleId(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cde-column-name">Column Name</Label>
                      <Input id="cde-column-name" value={cdeColumnName} onChange={(e) => setCdeColumnName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Linked KPIs</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {kpis.map((kpi) => (
                        <label key={kpi.id} className="flex items-center gap-2 text-sm text-zinc-300">
                          <Checkbox
                            checked={cdeKpiIds.includes(kpi.id)}
                            onCheckedChange={(checked) => {
                              setCdeKpiIds((prev) =>
                                checked
                                  ? [...prev, kpi.id]
                                  : prev.filter((id) => id !== kpi.id)
                              );
                            }}
                          />
                          {kpi.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCDEDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveCDE} disabled={!cdeName.trim() || !cdeDefinition.trim()}>
                    {editingCdeId ? 'Save Changes' : 'Create CDE'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[calc(100vh-360px)] pr-2">
            {cdes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">No CDEs yet</h3>
                <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                  Register critical data elements to tie metrics to data quality rules.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {cdes.map((cde) => {
                  const linkedKpis = cde.kpiIds
                    .map((id) => kpis.find((k) => k.id === id))
                    .filter((k): k is KPI => Boolean(k));
                  const linkedRules = dqRules.filter((rule) => rule.cdeId === cde.id);
                  const unlinkedRules = getUnlinkedRulesForCde(cde.id);

                  // Calculate DQ score for CDE
                  const executedCdeRules = linkedRules.filter((r) => r.lastRunResult);
                  const cdeDqScore = executedCdeRules.length > 0
                    ? Math.round(executedCdeRules.reduce((sum, r) => sum + (r.lastRunResult?.passRate || 0), 0) / executedCdeRules.length)
                    : null;

                  return (
                    <Card key={cde.id} className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{cde.name}</CardTitle>
                            <CardDescription className="mt-1">{cde.description}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-200">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                populateCDEForm(cde);
                                setIsCDEDialogOpen(true);
                              }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setLinkDialogType('cde-rule');
                                  setLinkDialogSourceId(cde.id);
                                  setLinkDialogOpen(true);
                                }}
                                disabled={unlinkedRules.length === 0}
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                Link Rule
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400"
                                onClick={() => {
                                  if (confirm('Delete this CDE?')) {
                                    deleteCDE(cde.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{cde.dataType}</Badge>
                          {cde.status && <Badge variant="outline">{cde.status}</Badge>}
                          {cde.owner && <Badge variant="outline">{cde.owner}</Badge>}
                        </div>
                        <div className="text-sm text-zinc-400">
                          Definition: <span className="text-zinc-200">{cde.businessDefinition}</span>
                        </div>
                        <div className="text-sm text-zinc-400">
                          Linked KPIs:{' '}
                          {linkedKpis.length === 0 ? (
                            <span className="text-zinc-500">None</span>
                          ) : (
                            <span className="text-zinc-200">{linkedKpis.map((k) => k.name).join(', ')}</span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400">
                          DQ Rules:{' '}
                          {linkedRules.length === 0 ? (
                            <span className="text-zinc-500">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {linkedRules.map((rule) => (
                                <Badge
                                  key={rule.id}
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-zinc-800 group"
                                  onClick={() => unlinkRuleFromCde(rule.id, cde.id)}
                                  title="Click to unlink"
                                >
                                  {rule.name}
                                  <Unlink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100" />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* DQ Score Section */}
                        {linkedRules.length > 0 && (
                          <div className="border-t border-zinc-800 pt-3 mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-zinc-400 flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4" />
                                DQ Score
                              </span>
                              {cdeDqScore !== null ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    cdeDqScore >= 80
                                      ? 'border-emerald-500/50 text-emerald-400'
                                      : cdeDqScore >= 60
                                      ? 'border-amber-500/50 text-amber-400'
                                      : 'border-red-500/50 text-red-400'
                                  }
                                >
                                  {cdeDqScore}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-zinc-500">Not run</Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              {linkedRules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-500 truncate max-w-[150px]" title={rule.name}>{rule.name}</span>
                                  {rule.lastRunResult ? (
                                    <span className={
                                      rule.lastRunResult.passRate >= rule.passThreshold
                                        ? 'text-emerald-400'
                                        : rule.lastRunResult.passRate >= rule.passThreshold * 0.8
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                    }>
                                      {Math.round(rule.lastRunResult.passRate)}%
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">--</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rules" className="flex-1 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Data Quality Rules</h2>
              <p className="text-sm text-zinc-500">Document rules and plan execution readiness.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={runAllDQRules}
                disabled={isRunningRules || dqRules.length === 0}
                className="border-violet-500/30 hover:bg-violet-500/10"
              >
                {isRunningRules ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full mr-2" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2 text-violet-400" />
                    Run All Rules
                  </>
                )}
              </Button>
              <Dialog open={isRuleDialogOpen} onOpenChange={(open) => {
                setIsRuleDialogOpen(open);
                if (!open) resetRuleForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Rule
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle>{editingRuleId ? 'Edit Data Quality Rule' : 'Create Data Quality Rule'}</DialogTitle>
                  <DialogDescription>Capture rule definitions and execution metadata.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="rule-name">Name</Label>
                    <Input id="rule-name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rule-description">Description</Label>
                    <Textarea id="rule-description" value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>CDE</Label>
                      <Select value={ruleCdeId} onValueChange={setRuleCdeId}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Select CDE" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {cdes.map((cde) => (
                            <SelectItem key={cde.id} value={cde.id}>
                              {cde.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Rule Type</Label>
                      <Select value={ruleType} onValueChange={(value) => setRuleType(value as DQRuleType)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Rule type" />
                        </SelectTrigger>
                        <SelectContent>
                          {dqRuleTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>Severity</Label>
                      <Select value={ruleSeverity} onValueChange={(value) => setRuleSeverity(value as DQSeverity)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                          {dqSeverities.map((severity) => (
                            <SelectItem key={severity} value={severity}>
                              {severity}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rule-threshold">Pass Threshold (%)</Label>
                      <Input id="rule-threshold" value={rulePassThreshold} onChange={(e) => setRulePassThreshold(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={ruleStatus} onValueChange={(value) => setRuleStatus(value as EntityStatus)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Execution Engine</Label>
                      <Select value={ruleEngine} onValueChange={(value) => setRuleEngine(value as ExecutionEngine)}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Execution engine" />
                        </SelectTrigger>
                        <SelectContent>
                          {executionEngines.map((engine) => (
                            <SelectItem key={engine} value={engine}>
                              {engine}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <Checkbox
                        checked={ruleExecutable}
                        onCheckedChange={(checked) => setRuleExecutable(Boolean(checked))}
                      />
                      <span className="text-sm text-zinc-300">Executable now</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rule-expression">Expression</Label>
                    <Textarea id="rule-expression" value={ruleExpression} onChange={(e) => setRuleExpression(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="rule-pattern">Expected Pattern</Label>
                      <Input id="rule-pattern" value={ruleExpectedPattern} onChange={(e) => setRuleExpectedPattern(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rule-reference">Reference Dataset</Label>
                      <Input id="rule-reference" value={ruleReferenceDataset} onChange={(e) => setRuleReferenceDataset(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleSaveRule}
                    disabled={!ruleName.trim() || (ruleCdeId === 'none' && !editingRuleId)}
                  >
                    {editingRuleId ? 'Save Changes' : 'Create Rule'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-360px)] pr-2">
            {dqRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">No rules yet</h3>
                <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                  Document data quality rules and prepare for future execution.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {dqRules.map((rule) => {
                  const cde = cdes.find((item) => item.id === rule.cdeId);
                  return (
                    <Card key={rule.id} className="bg-zinc-900 border-zinc-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-base">{rule.name}</CardTitle>
                            <CardDescription className="mt-1">{rule.description}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-200">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                populateRuleForm(rule);
                                setIsRuleDialogOpen(true);
                              }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400"
                                onClick={() => {
                                  if (confirm('Delete this rule?')) {
                                    deleteDQRule(rule.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{rule.ruleType}</Badge>
                          <Badge variant="outline">{rule.severity}</Badge>
                          {rule.status && <Badge variant="outline">{rule.status}</Badge>}
                        </div>
                        <div className="text-sm text-zinc-400">
                          CDE: <span className="text-zinc-200">{cde?.name || 'Unlinked'}</span>
                        </div>
                        <div className="text-sm text-zinc-400">
                          Pass threshold: <span className="text-zinc-200">{rule.passThreshold}%</span>
                        </div>
                        {rule.expression && (
                          <div className="text-sm text-zinc-400">
                            Expression: <span className="text-zinc-200">{rule.expression}</span>
                          </div>
                        )}

                        {/* Last Run Results */}
                        {rule.lastRunResult ? (
                          <div className="border-t border-zinc-800 pt-3 mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-zinc-400 flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4" />
                                Last Run
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  rule.lastRunResult.passRate >= rule.passThreshold
                                    ? 'border-emerald-500/50 text-emerald-400'
                                    : rule.lastRunResult.passRate >= rule.passThreshold * 0.8
                                    ? 'border-amber-500/50 text-amber-400'
                                    : 'border-red-500/50 text-red-400'
                                }
                              >
                                {Math.round(rule.lastRunResult.passRate)}% pass
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center p-2 bg-zinc-800/50 rounded">
                                <div className="text-zinc-400">Total</div>
                                <div className="text-zinc-200 font-medium">{rule.lastRunResult.totalRecords.toLocaleString()}</div>
                              </div>
                              <div className="text-center p-2 bg-emerald-900/20 rounded">
                                <div className="text-emerald-400">Passed</div>
                                <div className="text-emerald-300 font-medium">{rule.lastRunResult.passedRecords.toLocaleString()}</div>
                              </div>
                              <div className="text-center p-2 bg-red-900/20 rounded">
                                <div className="text-red-400">Failed</div>
                                <div className="text-red-300 font-medium">{rule.lastRunResult.failedRecords.toLocaleString()}</div>
                              </div>
                            </div>
                            {rule.lastRunDate && (
                              <div className="text-xs text-zinc-500 mt-2">
                                Last run: {new Date(rule.lastRunDate).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="border-t border-zinc-800 pt-3 mt-3">
                            <div className="text-xs text-zinc-500 text-center py-2">
                              Not yet executed
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="canvas" className="flex-1 mt-4">
          <div className="h-full min-h-[600px]">
            <OutcomeCanvas />
          </div>
        </TabsContent>
      </Tabs>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => {
        setLinkDialogOpen(open);
        if (!open) {
          setLinkDialogType(null);
          setLinkDialogSourceId(null);
        }
      }}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>
              {linkDialogType === 'outcome-kpi' && 'Link KPI to Outcome'}
              {linkDialogType === 'kpi-cde' && 'Link CDE to KPI'}
              {linkDialogType === 'cde-rule' && 'Link Rule to CDE'}
            </DialogTitle>
            <DialogDescription>
              Select an item to link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {linkDialogType === 'outcome-kpi' && linkDialogSourceId && (
                  getUnlinkedKpisForOutcome(linkDialogSourceId).map((kpi) => (
                    <Button
                      key={kpi.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => {
                        linkKpiToOutcome(kpi.id, linkDialogSourceId);
                        setLinkDialogOpen(false);
                      }}
                    >
                      <div>
                        <div className="font-medium">{kpi.name}</div>
                        <div className="text-xs text-zinc-500">{kpi.description}</div>
                      </div>
                    </Button>
                  ))
                )}
                {linkDialogType === 'kpi-cde' && linkDialogSourceId && (
                  getUnlinkedCdesForKpi(linkDialogSourceId).map((cde) => (
                    <Button
                      key={cde.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => {
                        linkCdeToKpi(cde.id, linkDialogSourceId);
                        setLinkDialogOpen(false);
                      }}
                    >
                      <div>
                        <div className="font-medium">{cde.name}</div>
                        <div className="text-xs text-zinc-500">{cde.businessDefinition}</div>
                      </div>
                    </Button>
                  ))
                )}
                {linkDialogType === 'cde-rule' && linkDialogSourceId && (
                  getUnlinkedRulesForCde(linkDialogSourceId).map((rule) => (
                    <Button
                      key={rule.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => {
                        linkRuleToCde(rule.id, linkDialogSourceId);
                        setLinkDialogOpen(false);
                      }}
                    >
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-xs text-zinc-500">{rule.ruleType} - {rule.severity}</div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
