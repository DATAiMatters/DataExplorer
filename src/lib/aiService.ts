import type { AISettings } from '@/types';

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

  if (!settings.endpoint || !settings.model) {
    return { success: false, content: '', error: 'AI not configured properly' };
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
      error: err instanceof Error ? err.message : 'Unknown error',
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: settings.maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      return { success: false, content: '', error: `API error: ${error}` };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0].message.content,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, content: '', error: 'Request timed out after 30 seconds' };
    }
    throw err;
  }
}

/**
 * Anthropic API (different message format)
 */
async function callAnthropic(
  prompt: string,
  settings: AISettings
): Promise<AIResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: settings.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      return { success: false, content: '', error: `API error: ${error}` };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content[0].text,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, content: '', error: 'Request timed out after 30 seconds' };
    }
    throw err;
  }
}

/**
 * Ollama API (local, different format)
 */
async function callOllama(
  prompt: string,
  settings: AISettings
): Promise<AIResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        prompt: prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      return { success: false, content: '', error: `API error: ${error}` };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.response,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, content: '', error: 'Request timed out after 30 seconds' };
    }
    throw err;
  }
}

/**
 * Test the connection with a simple prompt
 */
export async function testConnection(settings: AISettings): Promise<AIResponse> {
  return callLLM('Respond with exactly: "Connection successful"', settings);
}
