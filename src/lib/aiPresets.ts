import type { AIPreset } from '@/types';

export const AI_PRESETS: Record<string, AIPreset> = {
  ollama: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434/api/generate',
    apiKey: '',
    model: 'llama3',
    maxTokens: 1000,
  },
  lmstudio: {
    provider: 'openai-compatible',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    apiKey: 'not-needed',
    model: 'local-model',
    maxTokens: 1000,
  },
  openai: {
    provider: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
    maxTokens: 1000,
  },
  anthropic: {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1000,
  },
  groq: {
    provider: 'openai-compatible',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: '',
    model: 'llama-3.1-70b-versatile',
    maxTokens: 1000,
  },
  openrouter: {
    provider: 'openai-compatible',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: '',
    model: 'anthropic/claude-sonnet-4-20250514',
    maxTokens: 1000,
  },
};
