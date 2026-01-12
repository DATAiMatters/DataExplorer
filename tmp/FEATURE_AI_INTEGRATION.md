# Feature: AI Integration

> **Status:** Planned
> **Priority:** Enhancement
> **Dependencies:** None (browser-only)

## Overview

Allow users to connect their own LLM (local or cloud) to enhance Data Explorer with AI-powered features like auto-suggesting column mappings, describing data, and explaining anomalies.

## User Configuration

Users provide their own LLM connection. Store in localStorage alongside other app settings.

### Settings Schema

```typescript
// Add to src/types/index.ts

interface AISettings {
  enabled: boolean;
  provider: 'openai-compatible' | 'anthropic' | 'ollama';
  endpoint: string;
  apiKey: string;        // Empty for local models
  model: string;
  maxTokens: number;     // Default 1000
}

// Presets for common providers
const AI_PRESETS = {
  ollama: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434/api/generate',
    apiKey: '',
    model: 'llama3',
    maxTokens: 1000
  },
  lmstudio: {
    provider: 'openai-compatible',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    apiKey: 'not-needed',
    model: 'local-model',
    maxTokens: 1000
  },
  openai: {
    provider: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
    maxTokens: 1000
  },
  anthropic: {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1000
  },
  groq: {
    provider: 'openai-compatible',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: '',
    model: 'llama-3.1-70b-versatile',
    maxTokens: 1000
  },
  openrouter: {
    provider: 'openai-compatible',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: '',
    model: 'anthropic/claude-sonnet-4-20250514',
    maxTokens: 1000
  }
};
```

### Store Updates

```typescript
// Add to src/store/index.ts

interface AppStore {
  // ... existing fields ...
  
  aiSettings: AISettings;
  setAISettings: (settings: Partial<AISettings>) => void;
}

// Default state
aiSettings: {
  enabled: false,
  provider: 'openai-compatible',
  endpoint: '',
  apiKey: '',
  model: '',
  maxTokens: 1000
}
```

## AI Service Module

Create a standalone service that handles all LLM communication.

### File: `src/lib/aiService.ts`

```typescript
import { AISettings } from '@/types';

export interface AIResponse {
  success: boolean;
  content: string;
  error?: string;
}

/**
 * Call the configured LLM with a prompt
 */
export async function callLLM(
  prompt: string, 
  settings: AISettings
): Promise<AIResponse> {
  if (!settings.enabled) {
    return { success: false, content: '', error: 'AI not enabled' };
  }

  try {
    if (settings.provider === 'ollama') {
      return await callOllama(prompt, settings);
    } else if (settings.provider === 'anthropic') {
      return await callAnthropic(prompt, settings);
    } else {
      return await callOpenAICompatible(prompt, settings);
    }
  } catch (err) {
    return { 
      success: false, 
      content: '', 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * OpenAI-compatible API (OpenAI, Groq, Together, OpenRouter, LM Studio)
 */
async function callOpenAICompatible(
  prompt: string, 
  settings: AISettings
): Promise<AIResponse> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: settings.maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, content: '', error };
  }

  const data = await response.json();
  return { 
    success: true, 
    content: data.choices[0].message.content 
  };
}

/**
 * Anthropic API (different message format)
 */
async function callAnthropic(
  prompt: string, 
  settings: AISettings
): Promise<AIResponse> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: settings.maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, content: '', error };
  }

  const data = await response.json();
  return { 
    success: true, 
    content: data.content[0].text 
  };
}

/**
 * Ollama API (local, different format)
 */
async function callOllama(
  prompt: string, 
  settings: AISettings
): Promise<AIResponse> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.model,
      prompt: prompt,
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, content: '', error };
  }

  const data = await response.json();
  return { 
    success: true, 
    content: data.response 
  };
}

/**
 * Test the connection with a simple prompt
 */
export async function testConnection(settings: AISettings): Promise<AIResponse> {
  return callLLM('Respond with exactly: "Connection successful"', settings);
}
```

## Prompt Templates

Create reusable prompts for each AI feature.

### File: `src/lib/aiPrompts.ts`

```typescript
import { DataSource, SemanticSchema, ColumnMapping } from '@/types';

/**
 * Generate a prompt to suggest column mappings
 */
export function suggestMappingsPrompt(
  columns: string[],
  sampleData: Record<string, unknown>[],
  schema: SemanticSchema
): string {
  const sampleStr = JSON.stringify(sampleData.slice(0, 5), null, 2);
  const rolesStr = schema.roles
    .map(r => `- ${r.id}: ${r.description}${r.required ? ' (REQUIRED)' : ''}`)
    .join('\n');

  return `You are a data mapping assistant. Given the following columns and sample data, suggest which columns should map to which semantic roles.

## Available Columns
${columns.join(', ')}

## Sample Data (first 5 rows)
${sampleStr}

## Semantic Roles to Map
${rolesStr}

## Instructions
- Return a JSON object mapping role IDs to column names
- Only include mappings you're confident about
- Required roles should be prioritized
- Example format: {"node_id": "FLOC_CODE", "parent_id": "PARENT_FLOC"}

## Your Response (JSON only, no explanation)`;
}

/**
 * Generate a prompt to describe a dataset
 */
export function describeDataPrompt(
  columns: string[],
  sampleData: Record<string, unknown>[],
  rowCount: number
): string {
  const sampleStr = JSON.stringify(sampleData.slice(0, 10), null, 2);

  return `You are a data analyst. Describe this dataset in 2-3 sentences for a business user.

## Dataset Info
- Columns: ${columns.join(', ')}
- Total rows: ${rowCount}

## Sample Data (first 10 rows)
${sampleStr}

## Instructions
- Describe what this data appears to represent
- Mention any obvious patterns or data types
- Keep it concise and non-technical
- Do not use markdown formatting

## Your Response`;
}

/**
 * Generate a prompt to explain a column
 */
export function explainColumnPrompt(
  columnName: string,
  sampleValues: unknown[],
  nullCount: number,
  uniqueCount: number,
  totalCount: number
): string {
  const samplesStr = sampleValues.slice(0, 20).join(', ');

  return `You are a data analyst. Explain what this column likely represents.

## Column: ${columnName}

## Statistics
- Total values: ${totalCount}
- Unique values: ${uniqueCount}
- Null/empty: ${nullCount}

## Sample Values
${samplesStr}

## Instructions
- Explain what this column likely represents in 1-2 sentences
- Mention the apparent data type (ID, name, date, number, category, etc.)
- Note any patterns in the values
- Do not use markdown formatting

## Your Response`;
}

/**
 * Generate a prompt to suggest a better display name
 */
export function suggestDisplayNamePrompt(
  columnName: string,
  sampleValues: unknown[]
): string {
  const samplesStr = sampleValues.slice(0, 10).join(', ');

  return `Given this technical column name and sample values, suggest a user-friendly display name.

Column: ${columnName}
Samples: ${samplesStr}

Respond with ONLY the suggested display name, nothing else. Use title case.`;
}

/**
 * Generate a prompt to explain an anomaly or outlier
 */
export function explainAnomalyPrompt(
  columnName: string,
  anomalyValue: unknown,
  normalValues: unknown[],
  context: string
): string {
  return `You are a data quality analyst. Explain why this value might be anomalous.

## Column: ${columnName}

## Anomaly Value
${anomalyValue}

## Typical Values
${normalValues.slice(0, 10).join(', ')}

## Context
${context}

## Instructions
- Explain in 1-2 sentences why this value stands out
- Suggest possible reasons (data entry error, edge case, etc.)
- Do not use markdown formatting

## Your Response`;
}
```

## UI Components

### AI Settings Panel

Create a new settings panel accessible from the sidebar.

**File:** `src/components/app/AISettings.tsx`

Key elements:
- Provider preset dropdown (Ollama, OpenAI, Anthropic, Groq, etc.)
- Endpoint input (auto-filled from preset, editable)
- API key input (password field)
- Model input
- Test connection button
- Enable/disable toggle
- Warning about API key storage in browser

### Integration Points

Add AI features to existing components:

#### 1. BundleManager.tsx - Suggest Mappings Button

Location: In the column mapping step of bundle creation

```tsx
// Add after schema selection, before manual mapping
{aiSettings.enabled && (
  <Button 
    variant="outline" 
    onClick={handleSuggestMappings}
    disabled={isLoadingAI}
  >
    <Sparkles className="w-4 h-4 mr-2" />
    {isLoadingAI ? 'Thinking...' : 'Suggest Mappings'}
  </Button>
)}
```

#### 2. Explorer.tsx - Describe Data Button

Location: In the explorer header

```tsx
{aiSettings.enabled && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={handleDescribeData}
  >
    <MessageSquare className="w-4 h-4 mr-2" />
    Describe
  </Button>
)}
```

#### 3. TabularExplorer.tsx - Explain Column

Location: On each column profile card

```tsx
{aiSettings.enabled && (
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => handleExplainColumn(column)}
  >
    <HelpCircle className="w-3 h-3" />
  </Button>
)}
```

## Implementation Order

1. **Phase 1: Foundation**
   - Add types to `src/types/index.ts`
   - Add store slice to `src/store/index.ts`
   - Create `src/lib/aiService.ts`
   - Create `src/lib/aiPrompts.ts`

2. **Phase 2: Settings UI**
   - Create `src/components/app/AISettings.tsx`
   - Add to sidebar navigation
   - Implement test connection

3. **Phase 3: First Feature**
   - Add "Suggest Mappings" to BundleManager
   - Parse JSON response and apply mappings

4. **Phase 4: Additional Features**
   - Add "Describe Data" to Explorer
   - Add "Explain Column" to TabularExplorer

## Error Handling

- Show toast notifications for AI errors
- Graceful fallback if AI unavailable
- Timeout after 30 seconds
- Rate limit awareness (show "try again later")

## Security Notes

Display this warning in AI Settings:

> ⚠️ **Security Notice:** Your API key is stored in your browser's local storage. 
> This is convenient but means anyone with access to this browser could see it.
> For sensitive keys, consider using the "Ask each session" option or a local model like Ollama.

## Testing Checklist

- [ ] Ollama connection works (local)
- [ ] LM Studio connection works (local)
- [ ] OpenAI connection works (requires key)
- [ ] Anthropic connection works (requires key)
- [ ] Settings persist across refresh
- [ ] Suggest mappings produces valid JSON
- [ ] Graceful handling when AI unavailable
- [ ] Loading states show correctly
- [ ] Errors display as toasts

## Future Enhancements

- Natural language data filtering ("show me items over $1000")
- Auto-generate schema descriptions
- Data quality suggestions
- Anomaly explanation in profiler
- Chat interface for asking questions about data
