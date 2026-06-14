import type {
  Analytics,
  Deployment,
  GitHubRepository,
  Health,
  Incident,
  IntegrationStatus,
  ProviderHealthResource,
  RepositoryActivity,
  User,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const AUTH_URL = import.meta.env.VITE_AUTH_URL || "http://localhost:4000";

type AuthResponse = { token: string; user: User };

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(payload.detail || payload.error || "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function authenticate(
  mode: "login" | "register",
  body: { name?: string; email: string; password: string },
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_URL}/api/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<AuthResponse>(response);
}

export async function authenticateWithFirebase(body: {
  idToken: string;
  githubAccessToken: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_URL}/api/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<AuthResponse>(response);
}

export function api(token: string) {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
    return parseResponse<T>(response);
  };
  const authRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${AUTH_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
    });
    return parseResponse<T>(response);
  };

  return {
    health: () => request<Health>("/health"),
    analytics: () => request<Analytics>("/api/analytics"),
    incidents: () => request<Incident[]>("/api/incidents"),
    incident: (id: string) => request<Incident>(`/api/incidents/${id}`),
    resolveIncident: (id: string, body: Record<string, unknown>) =>
      request<Incident>(`/api/incidents/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    handoff: () => request<Record<string, unknown>>("/api/handoff"),
    deployments: () => request<Deployment[]>("/api/deployments"),
    syncVercel: () =>
      request<Record<string, unknown>>("/api/integrations/vercel/sync", { method: "POST" }),
    syncRender: () =>
      request<Record<string, unknown>>("/api/integrations/render/sync", { method: "POST" }),
    integrationStatus: () => authRequest<IntegrationStatus>("/api/integrations/status"),
    providerHealth: () => authRequest<{ resources: ProviderHealthResource[] }>(
      "/api/integrations/provider-health",
    ),
    inspectProvider: (provider: "vercel" | "render") =>
      authRequest<Record<string, unknown>>(`/api/integrations/provider-health/${provider}/inspect`, {
        method: "POST",
      }),
    trackProviderResource: (resource: ProviderHealthResource) =>
      authRequest<{
        tracked: boolean;
        inspection: Record<string, unknown> | null;
        inspectionError?: string | null;
      }>(
        "/api/integrations/provider-health/track",
        {
          method: "POST",
          body: JSON.stringify({
            provider: resource.provider,
            resourceId: resource.resourceId,
            resourceName: resource.resourceName,
            ownerId: resource.ownerId || null,
            repository: resource.repository,
          }),
        },
      ),
    startVercel: () => authRequest<{ url: string }>("/api/integrations/vercel/start"),
    connectVercelToken: (accessToken: string) => authRequest<{
      connected: boolean;
      projects: number;
      matches: number;
    }>("/api/integrations/vercel/token", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),
    githubRepositories: () => authRequest<{ repositories: GitHubRepository[] }>("/api/integrations/github/repositories"),
    importRepository: (repository: GitHubRepository) =>
      authRequest<{ repository: GitHubRepository; requiresProjectMapping: boolean }>("/api/integrations/repositories/import", {
        method: "POST",
        body: JSON.stringify({
          fullName: repository.fullName,
          id: repository.id,
          private: repository.private,
          defaultBranch: repository.defaultBranch,
        }),
      }),
    repositoryActivity: (fullName: string) =>
      authRequest<RepositoryActivity>(
        `/api/integrations/repositories/${fullName.split("/").map(encodeURIComponent).join("/")}/activity`,
      ),
    repositorySettings: (fullName: string, pollIntervalSeconds: number) =>
      authRequest<{ updated: boolean }>(
        `/api/integrations/repositories/${fullName.split("/").map(encodeURIComponent).join("/")}/settings`,
        { method: "PATCH", body: JSON.stringify({ pollIntervalSeconds }) },
      ),
    vercelProjects: () => authRequest<{
      projects: { id: string; name: string; teamId: string | null; scope: string; githubRepository?: string | null }[];
      teamAccessLimited: boolean;
    }>("/api/integrations/vercel/projects"),
    rematchRepositories: () => authRequest<{
      matches: { repository: string; project: { id: string; name: string } }[];
      teamAccessLimited: boolean;
    }>("/api/integrations/repositories/rematch", { method: "POST" }),
    connectRender: (apiKey: string) => authRequest<{
      connected: boolean;
      accountName: string;
      services: number;
      matches: number;
    }>(
      "/api/integrations/render/connect",
      { method: "POST", body: JSON.stringify({ apiKey }) },
    ),
    disconnectProvider: (provider: "vercel" | "render") =>
      authRequest<void>(`/api/integrations/connections/${provider}`, { method: "DELETE" }),
    trackProject: (body: Record<string, unknown>) => authRequest("/api/integrations/tracked-projects", {
      method: "POST", body: JSON.stringify(body),
    }),
    createDraftPr: (incidentId: string) =>
      request<{ incident: Incident; pull_request_url: string }>(
        `/api/incidents/${incidentId}/create-draft-pr`,
        { method: "POST", body: JSON.stringify({ approved: true }) },
      ),
    downloadReport: async (incident: Incident) => {
      const response = await fetch(`${API_URL}/api/incidents/${incident.id}/report.pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not generate report");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `incident-${incident.id.slice(0, 8)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  };
}
