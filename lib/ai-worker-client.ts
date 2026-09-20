/**
 * LeadPulse AI V2 — Python Worker Client
 *
 * Lightweight TypeScript bridge connecting the Next.js environment
 * to the Python AI worker (FastAPI / OpenAI Agents SDK).
 */

export interface LeadTriageOutput {
  business_name: string;
  score: number;
  priority: string;
  recommended_channel: string;
}

export interface TokenUsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AgentRunResult<T = unknown> {
  success: boolean;
  output: T;
  agent_type: string;
  execution_time_ms: number;
  token_usage?: TokenUsageStats;
  error?: string | null;
}

export interface RunAgentOptions {
  prompt: string;
  agent_type?: 'base' | 'triage';
  timeout_seconds?: number;
  context?: Record<string, unknown>;
}

export interface WorkerHealthInfo {
  status: string;
  service: string;
  version: string;
  provider: {
    configured: boolean;
    mode: string;
    model: string;
  };
}

export interface WorkerReadinessInfo {
  status: string;
  provider_accessible: boolean;
  provider_status: string;
  details?: string | null;
}

/**
 * Get base URL for the Python AI Worker service from environment variables.
 */
export function getWorkerBaseUrl(): string {
  const url = process.env.AI_WORKER_URL || 'http://localhost:8000';
  return url.replace(/\/+$/, '');
}

/**
 * Check health of the Python AI Worker.
 */
export async function checkWorkerHealth(): Promise<WorkerHealthInfo> {
  const baseUrl = getWorkerBaseUrl();
  const res = await fetch(`${baseUrl}/health`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Worker health check failed with status ${res.status}`);
  }

  return (await res.json()) as WorkerHealthInfo;
}

/**
 * Check readiness of the Python AI Worker and its upstream provider connectivity.
 */
export async function checkWorkerReadiness(): Promise<WorkerReadinessInfo> {
  const baseUrl = getWorkerBaseUrl();
  const res = await fetch(`${baseUrl}/health/ready`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Worker readiness check failed with status ${res.status}`);
  }

  return (await res.json()) as WorkerReadinessInfo;
}

/**
 * Execute an agent task via the Python AI Worker service.
 */
export async function runAgentTask<T = unknown>(
  options: RunAgentOptions
): Promise<AgentRunResult<T>> {
  const baseUrl = getWorkerBaseUrl();
  const timeoutSeconds = options.timeout_seconds || 180;
  // Network timeout includes 10-second buffer over agent execution timeout
  const timeoutMs = (timeoutSeconds + 10) * 1000;

  const payload = {
    prompt: options.prompt,
    agent_type: options.agent_type || 'triage',
    timeout_seconds: options.timeout_seconds,
    context: options.context,
  };

  const res = await fetch(`${baseUrl}/api/v1/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    try {
      const errorJson = JSON.parse(errorBody);
      const detail = errorJson.detail || errorJson.error || errorBody;
      throw new Error(`AI Worker error (HTTP ${res.status} [${errorJson.error_code || 'ERROR'}]): ${detail}`);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.startsWith('AI Worker error')) {
        throw parseErr;
      }
      throw new Error(`AI Worker returned HTTP ${res.status}: ${errorBody}`);
    }
  }

  return (await res.json()) as AgentRunResult<T>;
}

