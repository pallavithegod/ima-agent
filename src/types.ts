export type MemoryMatch = {
  similarity: number;
  incident: Pick<
    Incident,
    | "id"
    | "title"
    | "service"
    | "severity"
    | "root_cause"
    | "resolution_steps"
    | "created_at"
  >;
};

export type TimelineItem = {
  at: string;
  event: string;
};

export type Incident = {
  id: string;
  title: string;
  description: string;
  service: string;
  severity: string;
  error_category: string;
  root_cause_type: string;
  status: "open" | "resolved";
  novelty: "new" | "related" | "recurring";
  error_logs: string;
  diagnosis: string;
  root_cause: string;
  resolution_steps: string[];
  impact: string;
  action_items: string[];
  timeline: TimelineItem[];
  retrieved_memories: MemoryMatch[];
  source: string;
  deployment_id?: string;
  commit_sha?: string;
  repository?: string;
  git_ref?: string;
  file_path?: string;
  code_snippet?: string;
  fix_summary?: string;
  fix_rationale?: string;
  fix_diff?: string;
  pull_request_url?: string;
  remediation_error?: string;
  engineer?: string;
  time_to_resolve_minutes?: number;
  created_at: string;
  resolved_at?: string;
};

export type Analytics = {
  totals: {
    incidents: number;
    open: number;
    resolved: number;
    recurring: number;
    average_mttr: number;
  };
  by_service: { name: string; value: number }[];
  by_category: { name: string; value: number }[];
  by_severity: { name: string; value: number }[];
  by_novelty: { name: string; value: number }[];
  trends: { service: string; pattern: string; count: number; recommendation: string }[];
  recent: Incident[];
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type Deployment = {
  id: string;
  platform: string;
  service: string;
  status: string;
  commit_sha?: string;
  message: string;
  created_at: string;
  raw_payload: {
    repository?: string;
    git_ref?: string;
    file_path?: string;
    logs?: string;
  };
};

export type Health = {
  status: string;
  llm_mode: string;
  memory_mode: string;
};

export type ProviderHealthResource = {
  provider: "vercel" | "render";
  resourceId?: string;
  resourceName?: string;
  ownerId?: string | null;
  repository?: string | null;
  repositoryImported?: boolean;
  tracked?: boolean;
  accessible: boolean;
  error?: string;
  latestDeployment?: {
    id: string;
    status: string;
    commitSha?: string | null;
    message?: string | null;
    createdAt?: string | null;
    url?: string | null;
  } | null;
};

export type IntegrationStatus = {
  connections: { provider: string; account_name: string; updated_at?: string; metadata?: Record<string, unknown> }[];
  projects: {
    id: number;
    vercel_project_id: string;
    vercel_project_name: string;
    github_repository: string;
  }[];
  renderServices: {
    id: number;
    render_service_id: string;
    render_service_name: string;
    render_owner_id?: string | null;
    github_repository: string;
  }[];
  repositories: {
    id: number;
    github_repository: string;
    poll_interval_seconds: number;
    last_synced_at?: string | null;
    last_sync_error?: string | null;
  }[];
  monitorActive: boolean;
  vercelProjectAccessEnabled: boolean;
  vercelAuthorizationConfigured: boolean;
};

export type VercelProjectSummary = {
  id: string;
  name: string;
  teamId: string | null;
};

export type GitHubRepository = {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  ownerAvatar?: string | null;
  private: boolean;
  url: string;
  description?: string | null;
  language?: string | null;
  defaultBranch: string;
  updatedAt?: string | null;
  imported: boolean;
  vercelProject?: VercelProjectSummary | null;
};

export type RepositoryActivity = {
  repository: GitHubRepository;
  commits: {
    sha: string;
    message: string;
    author: string;
    avatar?: string | null;
    createdAt?: string | null;
    url: string;
  }[];
  deployments: {
    id: string;
    name: string;
    state: string;
    url?: string | null;
    createdAt?: string | null;
    commitSha?: string | null;
    commitMessage?: string | null;
  }[];
  latestLogs: {
    id: string;
    createdAt?: string | null;
    level: string;
    text: string;
  }[];
  workflows: {
    commit_sha: string;
    commit_message?: string | null;
    commit_url?: string | null;
    status: string;
    deployment_id?: string | null;
    incident_id?: string | null;
    pull_request_url?: string | null;
    error?: string | null;
    created_at: string;
    updated_at: string;
  }[];
};
