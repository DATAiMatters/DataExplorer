import { useState } from 'react';
import { useAppStore } from '@/store';
import { AI_PRESETS } from '@/lib/aiPresets';
import { testConnection } from '@/lib/aiService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, AlertTriangle, CheckCircle2, Loader2, Info } from 'lucide-react';

export function AISettings() {
  const aiSettings = useAppStore((s) => s.aiSettings);
  const setAISettings = useAppStore((s) => s.setAISettings);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handlePresetChange = (presetKey: string) => {
    if (presetKey === 'custom') {
      setAISettings({
        provider: 'openai-compatible',
        endpoint: '',
        apiKey: '',
        model: '',
      });
    } else {
      const preset = AI_PRESETS[presetKey];
      if (preset) {
        setAISettings({
          provider: preset.provider,
          endpoint: preset.endpoint,
          apiKey: preset.apiKey,
          model: preset.model,
          maxTokens: preset.maxTokens,
        });
      }
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(aiSettings);
      if (result.success) {
        setTestResult({
          success: true,
          message: 'Connection successful! AI features are ready to use.',
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed. Please check your settings.',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Detect current preset
  const currentPreset = Object.entries(AI_PRESETS).find(
    ([, preset]) =>
      preset.endpoint === aiSettings.endpoint &&
      preset.provider === aiSettings.provider &&
      preset.model === aiSettings.model
  )?.[0] || 'custom';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI Integration</h1>
          <p className="text-xs text-zinc-500">Connect your AI provider for enhanced features</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="ai-enabled" className="text-sm font-medium text-zinc-200">
                Enable AI Features
              </Label>
              <p className="text-xs text-zinc-500 mt-1">
                Auto-suggest mappings, describe data, and explain columns
              </p>
            </div>
            <Switch
              id="ai-enabled"
              checked={aiSettings.enabled}
              onCheckedChange={(enabled) => setAISettings({ enabled })}
            />
          </div>

          {/* Security Warning */}
          <Alert className="bg-amber-500/10 border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <AlertDescription className="text-sm text-amber-200">
              <strong>Security Notice:</strong> Your API key is stored in your browser's local storage.
              Anyone with access to this browser could see it. For sensitive keys, consider using a local
              model like Ollama or LM Studio.
            </AlertDescription>
          </Alert>

          {/* Provider Preset */}
          <div className="space-y-2">
            <Label htmlFor="preset" className="text-sm font-medium text-zinc-200">
              Provider Preset
            </Label>
            <Select value={currentPreset} onValueChange={handlePresetChange}>
              <SelectTrigger id="preset" className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="lmstudio">LM Studio (Local)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="custom">Custom Configuration</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              Select a preset to auto-fill settings, or choose Custom to configure manually
            </p>
          </div>

          {/* Provider Type */}
          <div className="space-y-2">
            <Label htmlFor="provider" className="text-sm font-medium text-zinc-200">
              Provider Type
            </Label>
            <Select
              value={aiSettings.provider}
              onValueChange={(provider) =>
                setAISettings({ provider: provider as 'openai-compatible' | 'anthropic' | 'ollama' })
              }
            >
              <SelectTrigger id="provider" className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="openai-compatible">OpenAI Compatible</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-2">
            <Label htmlFor="endpoint" className="text-sm font-medium text-zinc-200">
              API Endpoint
            </Label>
            <Input
              id="endpoint"
              type="url"
              placeholder="https://api.openai.com/v1/chat/completions"
              value={aiSettings.endpoint}
              onChange={(e) => setAISettings({ endpoint: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
            />
            <p className="text-xs text-zinc-500">
              The full URL to the API endpoint (e.g., http://localhost:11434/api/generate for Ollama)
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium text-zinc-200">
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={aiSettings.apiKey}
              onChange={(e) => setAISettings({ apiKey: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono"
            />
            <p className="text-xs text-zinc-500">
              Leave empty for local models (Ollama, LM Studio). Required for cloud providers.
            </p>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model" className="text-sm font-medium text-zinc-200">
              Model Name
            </Label>
            <Input
              id="model"
              type="text"
              placeholder="gpt-4o-mini"
              value={aiSettings.model}
              onChange={(e) => setAISettings({ model: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
            />
            <p className="text-xs text-zinc-500">
              Model identifier (e.g., gpt-4o-mini, claude-sonnet-4, llama3, etc.)
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label htmlFor="maxTokens" className="text-sm font-medium text-zinc-200">
              Max Tokens
            </Label>
            <Input
              id="maxTokens"
              type="number"
              min="100"
              max="32000"
              value={aiSettings.maxTokens}
              onChange={(e) => setAISettings({ maxTokens: parseInt(e.target.value) || 1000 })}
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
            />
            <p className="text-xs text-zinc-500">
              Maximum tokens for AI responses (100-32000). Higher values allow longer responses.
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="space-y-3">
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !aiSettings.endpoint || !aiSettings.model}
              className="w-full"
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            {/* Test Result */}
            {testResult && (
              <Alert
                className={
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <AlertDescription
                  className={testResult.success ? 'text-emerald-200' : 'text-red-200'}
                >
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Info Box */}
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Info className="w-4 h-4 text-blue-400" />
            <AlertDescription className="text-sm text-blue-200">
              <strong>AI Features Available:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Auto-suggest column mappings when creating bundles</li>
                <li>Generate dataset descriptions in Explorer</li>
                <li>Explain column contents in Tabular view</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Common Provider Examples */}
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-zinc-200">Common Configurations</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 font-mono min-w-24">Ollama:</span>
                <span className="text-zinc-400">http://localhost:11434/api/generate</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 font-mono min-w-24">LM Studio:</span>
                <span className="text-zinc-400">http://localhost:1234/v1/chat/completions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 font-mono min-w-24">OpenAI:</span>
                <span className="text-zinc-400">https://api.openai.com/v1/chat/completions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 font-mono min-w-24">Anthropic:</span>
                <span className="text-zinc-400">https://api.anthropic.com/v1/messages</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
