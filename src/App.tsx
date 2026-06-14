import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  FolderGit2,
  GitCommit,
  GitBranch,
  Github,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Plus,
  Rocket,
  Settings,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  SquareTerminal,
  Sparkles,
  RefreshCw,
  Wrench,
  X,
  UserRound,
  Home,
  HeartPulse,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, authenticateWithFirebase } from "./api";
import { signInWithGithub } from "./firebase";
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

const COLORS = ["#6ce5b1", "#80a7ff", "#f4c768", "#ff7d8f", "#a98bff"];

function App() {
  const knownPath = window.location.pathname === "/" || window.location.pathname === "";
  const [session, setSession] = useState<{ token: string; user: User } | null>(() => {
    const stored = localStorage.getItem("recallops-session");
    return stored ? JSON.parse(stored) : null;
  });
  const integrationError = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") === "error" ? params.get("error") : null;
  }, []);

  if (!knownPath) return <NotFoundPage />;

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  return (
    <Dashboard
      session={session}
      initialError={integrationError}
      onLogout={() => {
        localStorage.removeItem("recallops-session");
        setSession(null);
      }}
    />
  );
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (session: { token: string; user: User }) => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginWithGithub() {
    setLoading(true);
    setError("");
    try {
      const firebaseCredential = await signInWithGithub();
      const session = await authenticateWithFirebase(firebaseCredential);
      localStorage.setItem("recallops-session", JSON.stringify(session));
      localStorage.removeItem("recallops-onboarding-skipped");
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span><BrainCircuit size={21} /></span>RecallOps</div>
        <div className="auth-message">
        <p className="eyebrow">AUTONOMOUS INCIDENT INTELLIGENCE</p>
        <h1>Catch failed deploys.<br /><span>Ship the fix.</span></h1>
        <p className="auth-copy">
          Connect GitHub and Vercel once. RecallOps watches selected repositories,
          reconstructs deployment failures, and prepares a reviewable repair.
        </p>
        <div className="auth-capabilities">
          <span><GitBranch size={15} /> Commit-aware diagnosis</span>
          <span><SquareTerminal size={15} /> Live build evidence</span>
          <span><ShieldCheck size={15} /> Human-approved pull requests</span>
        </div>
        </div>
        <div className="auth-console" aria-hidden="true">
          <div className="console-top"><i /><i /><i /><span>deployment observer</span></div>
          <div className="console-row"><span className="console-time">10:42:18</span><b>WATCH</b><p>pallavithegod/ima</p></div>
          <div className="console-row"><span className="console-time">10:43:02</span><em>FAIL</em><p>Build exited with status 1</p></div>
          <div className="console-row"><span className="console-time">10:43:04</span><b>TRACE</b><p>commit 7f8a31c · api/main.py:84</p></div>
          <div className="console-row active"><span className="console-time">10:43:08</span><strong>FIX</strong><p>Draft remediation ready for review</p></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-icon"><Github size={23} /></div>
          <p className="eyebrow">START WITH YOUR CODE</p>
          <h2>Connect your engineering workspace</h2>
          <p>Choose the repositories RecallOps can monitor. Vercel authorization follows securely for deployment access.</p>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={loading} onClick={loginWithGithub}>
            <Github size={18} />
            {loading ? "Connecting to GitHub..." : "Continue with GitHub"}
          </button>
          <small><Lock size={13} /> Per-user tokens are encrypted and never shared between accounts.</small>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  session,
  initialError,
  onLogout,
}: {
  session: { token: string; user: User };
  initialError: string | null;
  onLogout: () => void;
}) {
  const client = useMemo(() => api(session.token), [session.token]);
  const [page, setPage] = useState<"overview" | "repositories" | "health" | "deployments" | "incidents" | "handoff" | "connections" | "account">("overview");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthResource[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [notice, setNotice] = useState("");
  const [onboardingSkipped, setOnboardingSkipped] = useState(
    localStorage.getItem("recallops-onboarding-skipped") === "true",
  );
  const [projectAccessGuideDismissed, setProjectAccessGuideDismissed] = useState(
    sessionStorage.getItem("recallops-project-access-guide-dismissed") === "true",
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("integration") || params.has("status") || params.has("error")) {
      if (params.get("status") === "connected") setNotice("Deployment provider connected");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      client.analytics(),
      client.incidents(),
      client.deployments(),
      client.health(),
      client.integrationStatus(),
      client.providerHealth(),
    ] as const);
    const [analyticsResult, incidentsResult, deploymentsResult, healthResult, integrationResult, providerHealthResult] = results;
    if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
    if (incidentsResult.status === "fulfilled") setIncidents(incidentsResult.value);
    if (deploymentsResult.status === "fulfilled") setDeployments(deploymentsResult.value);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (integrationResult.status === "fulfilled") setIntegrations(integrationResult.value);
    if (providerHealthResult.status === "fulfilled") setProviderHealth(providerHealthResult.value.resources);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length === results.length) {
      const reason = failures[0].reason;
      setError(reason instanceof Error ? reason.message : "Could not load dashboard");
    } else if (!initialError) {
      setError("");
    }
  }, [client, initialError]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="logo"><span><BrainCircuit size={20} /></span>RecallOps</div>
        <nav>
          <NavButton active={page === "overview"} icon={<LayoutDashboard />} label="Overview" onClick={() => setPage("overview")} />
          <NavButton active={page === "repositories"} icon={<FolderGit2 />} label="Repositories" onClick={() => setPage("repositories")} />
          <NavButton active={page === "health"} icon={<HeartPulse />} label="Health" onClick={() => setPage("health")} />
          <NavButton active={page === "deployments"} icon={<GitCommit />} label="Deployment failures" onClick={() => setPage("deployments")} />
          <NavButton active={page === "incidents"} icon={<AlertTriangle />} label="Incidents" count={analytics?.totals.open} onClick={() => setPage("incidents")} />
          <NavButton active={page === "handoff"} icon={<FileText />} label="On-call brief" onClick={() => setPage("handoff")} />
          <NavButton active={page === "connections"} icon={<Settings />} label="Connections" onClick={() => setPage("connections")} />
          <NavButton active={page === "account"} icon={<UserRound />} label="Account" onClick={() => setPage("account")} />
        </nav>
        <div className="sidebar-foot">
          <div className="agent-state">
            <span className={integrations?.monitorActive && health?.llm_mode === "deepseek" ? "active" : ""} />
            <div>
              <strong>
                {!health
                  ? "Checking agent"
                  : health.llm_mode !== "deepseek"
                    ? "DeepSeek key required"
                    : integrations?.monitorActive
                      ? "Monitor active"
                      : "Agent ready"}
              </strong>
              <small>
                {!integrations
                  ? "Loading repositories"
                  : integrations.repositories.length
                    ? `${integrations.repositories.length} repositories imported`
                    : "No repositories imported for this account"}
              </small>
            </div>
          </div>
          <button className="sidebar-profile" onClick={() => setPage("account")}><span>{session.user.name.slice(0, 2).toUpperCase()}</span><div><strong>{session.user.name}</strong><small>{session.user.email}</small></div></button>
          <button onClick={onLogout}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu /></button>
          <div>
            <p className="eyebrow">OPERATIONS WORKSPACE</p>
            <h2>{page === "overview" ? "Incident intelligence" : page === "repositories" ? "Monitored repositories" : page === "health" ? "Deployment health" : page === "deployments" ? "Deployment failures" : page === "incidents" ? "Incident memory" : page === "connections" ? "Connected accounts" : page === "account" ? "Account profile" : "On-call handoff"}</h2>
          </div>
        </header>

        {error && <Toast message={error} tone="error" onClose={() => setError("")} />}
        {notice && <Toast message={notice} tone="success" onClose={() => setNotice("")} />}
        {page === "overview" && (
          <Overview
            analytics={analytics}
            integrations={integrations}
            deployments={deployments}
            onAddRepository={() => setPage("repositories")}
            onSelect={setSelected}
          />
        )}
        {page === "repositories" && (
          <RepositoryPage client={client} status={integrations} onChanged={refresh} />
        )}
        {page === "health" && (
          <ProviderHealthPage
            client={client}
            resources={providerHealth}
            incidents={incidents}
            onChanged={refresh}
            onImportRepository={() => setPage("repositories")}
          />
        )}
        {page === "deployments" && (
          <DeploymentPage
            deployments={deployments}
            configured={Boolean(integrations?.projects.length)}
            importedCount={integrations?.repositories.length || 0}
            onSync={async () => {
              const syncs = [];
              if (integrations?.projects.length) syncs.push(client.syncVercel());
              if (integrations?.renderServices.length) syncs.push(client.syncRender());
              await Promise.allSettled(syncs);
              await refresh();
            }}
          />
        )}
        {page === "incidents" && <IncidentList incidents={incidents} onSelect={setSelected} />}
        {page === "handoff" && <Handoff incidents={incidents} analytics={analytics} onSelect={setSelected} />}
        {page === "connections" && <Connections client={client} status={integrations} onChanged={refresh} />}
        {page === "account" && <AccountPage user={session.user} status={integrations} />}
      </main>

      {integrations
        && !onboardingSkipped
        && !integrations.connections.some((item) => item.provider === "vercel" || item.provider === "render")
        && (
          <ProviderOnboarding
            client={client}
            onConnected={refresh}
            onSkip={() => {
              localStorage.setItem("recallops-onboarding-skipped", "true");
              setOnboardingSkipped(true);
            }}
          />
        )}
      {integrations
        && integrations.connections.some((item) => item.provider === "vercel")
        && !integrations.vercelProjectAccessEnabled
        && !projectAccessGuideDismissed
        && (
          <VercelProjectAccessGuide
            client={client}
            onEnabled={async () => {
              sessionStorage.removeItem("recallops-project-access-guide-dismissed");
              await refresh();
            }}
            onLater={() => {
              sessionStorage.setItem("recallops-project-access-guide-dismissed", "true");
              setProjectAccessGuideDismissed(true);
            }}
          />
        )}

      {selected && (
        <IncidentDrawer
          incident={selected}
          onClose={() => setSelected(null)}
          onDownload={() => client.downloadReport(selected)}
          onCreateDraftPr={async () => {
            const result = await client.createDraftPr(selected.id);
            setSelected(result.incident);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function NavButton({
  active, icon, label, count, onClick,
}: {
  active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}<span>{label}</span>{count ? <b>{count}</b> : null}
    </button>
  );
}

function Toast({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: "error" | "success";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5_000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`toast ${tone}`} role="status">
      {tone === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      <span>{message}</span>
      <button title="Dismiss notification" onClick={onClose}><X size={15} /></button>
      <i />
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found">
      <div className="not-found-code">404</div>
      <p className="eyebrow">PAGE NOT FOUND</p>
      <h1>This route does not exist.</h1>
      <p>The operations workspace is still right where you left it.</p>
      <a href="/"><Home size={17} /> Return to RecallOps</a>
    </main>
  );
}

function Overview({
  analytics,
  integrations,
  deployments,
  onAddRepository,
  onSelect,
}: {
  analytics: Analytics | null;
  integrations: IntegrationStatus | null;
  deployments: Deployment[];
  onAddRepository: () => void;
  onSelect: (item: Incident) => void;
}) {
  const cards = [
    { label: "Repositories", value: integrations?.repositories.length || 0, detail: `${integrations?.projects.length || 0} deployment projects linked`, icon: <FolderGit2 /> },
    { label: "Total incidents", value: analytics?.totals.incidents || 0, detail: `${analytics?.totals.resolved || 0} resolved`, icon: <Activity /> },
    { label: "Open now", value: analytics?.totals.open || 0, detail: "Needs attention", icon: <AlertTriangle /> },
    { label: "Average MTTR", value: `${analytics?.totals.average_mttr || 0}m`, detail: "Across resolutions", icon: <Clock3 /> },
  ];
  return (
    <div className="page-content">
      <section className="overview-command">
        <div>
          <p className="eyebrow">REPOSITORY MONITORING</p>
          <h3>{integrations?.repositories.length ? `${integrations.repositories.length} repositor${integrations.repositories.length === 1 ? "y" : "ies"} under watch` : "Start with a GitHub repository"}</h3>
          <p>Select the codebases that matter. RecallOps links matching Vercel projects and watches every deployment for failure evidence.</p>
        </div>
        <button className="primary-button compact" onClick={onAddRepository}><Plus size={17} /> Add GitHub repo</button>
        <div className="command-signal">
          <span className={integrations?.monitorActive ? "online" : ""}><Activity size={17} /></span>
          <div><strong>{integrations?.monitorActive ? "Monitor running" : "Waiting for repository"}</strong><small>{deployments.length ? `${deployments.length} deployment failures indexed` : "No failures indexed yet"}</small></div>
        </div>
      </section>
      <section className="metric-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <div className="metric-icon">{card.icon}</div>
            <p>{card.label}</p><strong>{card.value}</strong><small>{card.detail}</small>
          </article>
        ))}
      </section>
      <section className="panel overview-repositories">
        <div className="panel-heading"><div><p className="eyebrow">LIVE REPOSITORY STATE</p><h3>Imported codebases</h3></div><button className="text-action" onClick={onAddRepository}>Manage repositories <ArrowRight size={14} /></button></div>
        {integrations?.repositories.length ? integrations.repositories.map((repository) => {
          const project = integrations.projects.find((item) => item.github_repository.toLowerCase() === repository.github_repository.toLowerCase());
          return (
            <div className="overview-repository-row" key={repository.id}>
              <Github size={17} />
              <div><strong>{repository.github_repository}</strong><p>{project ? `Linked to ${project.vercel_project_name}` : "Awaiting Vercel project access"}</p></div>
              <span className={project ? "monitor-ready" : "monitor-waiting"}>{project ? "Monitoring" : "Needs mapping"}</span>
              <small>{repository.last_synced_at ? `Synced ${formatRelative(repository.last_synced_at)}` : "Not synced yet"}</small>
            </div>
          );
        }) : <Empty label="No GitHub repositories imported yet" />}
      </section>
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">INCIDENT VOLUME</p><h3>Failure surface by service</h3></div><BarChart3 size={20} /></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics?.by_service || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#24334a" />
              <XAxis dataKey="name" tick={{ fill: "#8290a5", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8290a5", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111d2e", border: "1px solid #293b55", borderRadius: 10 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6ce5b1" />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="panel pattern-panel">
          <div className="panel-heading"><div><p className="eyebrow">PROACTIVE MEMORY</p><h3>Patterns worth fixing</h3></div><Sparkles size={20} /></div>
          <div className="trend-list">
            {(analytics?.trends || []).slice(0, 4).map((trend) => (
              <div className="trend-item" key={`${trend.service}-${trend.pattern}`}>
                <span>{trend.count}x</span>
                <div><strong>{trend.service}</strong><p>{trend.pattern.replaceAll("-", " ")}</p></div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="dashboard-grid lower">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h3>Recent incident memory</h3></div></div>
          <div className="incident-table">
            {(analytics?.recent || []).slice(0, 6).map((incident) => <IncidentRow key={incident.id} incident={incident} onClick={() => onSelect(incident)} />)}
          </div>
        </article>
        <article className="panel donut-panel">
          <div className="panel-heading"><div><p className="eyebrow">SEVERITY MIX</p><h3>Operational risk</h3></div></div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={analytics?.by_severity || []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={4}>
                {(analytics?.by_severity || []).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111d2e", border: "1px solid #293b55", borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">{(analytics?.by_severity || []).map((item, index) => <span key={item.name}><i style={{ background: COLORS[index] }} />{item.name} {item.value}</span>)}</div>
        </article>
      </section>
    </div>
  );
}

function RepositoryPage({
  client,
  status,
  onChanged,
}: {
  client: ReturnType<typeof api>;
  status: IntegrationStatus | null;
  onChanged: () => Promise<void>;
}) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState("");
  const [selected, setSelected] = useState<GitHubRepository | null>(null);
  const [activity, setActivity] = useState<RepositoryActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState("");
  const githubConnected = status?.connections.some((item) => item.provider === "github");

  const loadRepositories = useCallback(async () => {
    if (!githubConnected) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await client.githubRepositories();
      setRepositories(result.repositories);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load GitHub repositories");
    } finally {
      setLoading(false);
    }
  }, [client, githubConnected]);

  useEffect(() => {
    void loadRepositories();
  }, [loadRepositories]);

  async function openRepository(repository: GitHubRepository, background = false) {
    setSelected(repository);
    if (!background) {
      setActivity(null);
      setActivityLoading(true);
    }
    setError("");
    try {
      setActivity(await client.repositoryActivity(repository.fullName));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load repository activity");
    } finally {
      if (!background) setActivityLoading(false);
    }
  }

  const owners = Array.from(new Set(repositories.map((repository) => repository.owner))).sort();
  const visible = repositories.filter((repository) => {
    const matchesOwner = owner === "all" || repository.owner === owner;
    const text = `${repository.fullName} ${repository.description || ""} ${repository.language || ""}`.toLowerCase();
    return matchesOwner && text.includes(query.toLowerCase());
  });

  if (!githubConnected) {
    return <div className="page-content"><div className="setup-notice"><Github size={18} /><div><strong>GitHub connection required</strong><p>Sign in with GitHub again to load repositories.</p></div></div></div>;
  }

  return (
    <div className="page-content repository-page">
      <section className="repository-heading">
        <div><p className="eyebrow">SOURCE INVENTORY</p><h3>Import Git Repository</h3><p>Choose a repository to monitor. Matching Vercel projects are connected automatically.</p></div>
        <span>{repositories.filter((repository) => repository.imported).length} monitored</span>
      </section>
      <div className="repository-toolbar">
        <label className="owner-select"><Github size={18} /><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All GitHub owners</option>{owners.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <div className="search-box repository-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repositories..." /></div>
      </div>
      {error && <Toast message={error} tone="error" onClose={() => setError("")} />}
      <section className="repository-list">
        {loading ? <LoadingState /> : visible.map((repository) => (
          <article className="repository-row" key={repository.id}>
            <button className="repository-main" onClick={() => void openRepository(repository)}>
              {repository.ownerAvatar ? <img src={repository.ownerAvatar} alt="" /> : <Github />}
              <div>
                <strong>{repository.name} {repository.private && <Lock size={13} />}</strong>
                <p>{repository.description || repository.fullName}</p>
                <small>{repository.language || "Repository"} · Updated {formatRelative(repository.updatedAt)}</small>
              </div>
            </button>
            <div className="repository-link-state">
              {repository.vercelProject ? <span className="vercel-linked"><Rocket size={13} /> {repository.vercelProject.name}</span> : <span>No Vercel project</span>}
            </div>
            <button
              className={repository.imported ? "import-button imported" : "import-button"}
              disabled={repository.imported || importing === repository.fullName}
              onClick={async () => {
                setImporting(repository.fullName);
                setError("");
                try {
                  const result = await client.importRepository(repository);
                  setRepositories((current) => current.map((item) => item.fullName === repository.fullName ? result.repository : item));
                  await onChanged();
                  await openRepository(result.repository);
                } catch (requestError) {
                  setError(requestError instanceof Error ? requestError.message : "Repository import failed");
                } finally {
                  setImporting("");
                }
              }}
            >
              {repository.imported
                ? repository.vercelProject ? "Monitoring" : "Imported"
                : importing === repository.fullName ? "Importing..." : "Import"}
            </button>
          </article>
        ))}
        {!loading && !visible.length && <Empty label="No repositories match this search" />}
      </section>
      {selected && (
        <RepositoryDrawer
          repository={selected}
          activity={activity}
          loading={activityLoading}
          pollInterval={status?.repositories.find((item) => item.github_repository.toLowerCase() === selected.fullName.toLowerCase())?.poll_interval_seconds || 2}
          onIntervalChange={async (seconds) => {
            await client.repositorySettings(selected.fullName, seconds);
            await onChanged();
          }}
          onRefresh={() => void openRepository(selected, true)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function RepositoryDrawer({
  repository,
  activity,
  loading,
  pollInterval,
  onIntervalChange,
  onRefresh,
  onClose,
}: {
  repository: GitHubRepository;
  activity: RepositoryActivity | null;
  loading: boolean;
  pollInterval: number;
  onIntervalChange: (seconds: number) => Promise<void>;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [intervalValue, setIntervalValue] = useState(pollInterval);
  const [savingInterval, setSavingInterval] = useState(false);

  useEffect(() => {
    setIntervalValue(pollInterval);
  }, [pollInterval]);

  useEffect(() => {
    const timer = window.setInterval(onRefresh, Math.max(2, intervalValue) * 1000);
    return () => window.clearInterval(timer);
  }, [intervalValue, onRefresh]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer repository-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-top">
          <div><span className="badge new">repository</span><h2>{repository.fullName}</h2><p>{repository.description || "GitHub repository activity"}</p></div>
          <button className="close-button" onClick={onClose}><X /></button>
        </div>
        <div className="repository-drawer-actions">
          <a href={repository.url} target="_blank" rel="noreferrer"><Github size={15} /> Open GitHub</a>
          <button onClick={onRefresh}><RefreshCw size={15} /> Refresh</button>
          <label className="poll-control"><SlidersHorizontal size={14} /><input type="number" min={2} max={3600} value={intervalValue} onChange={(event) => setIntervalValue(Math.max(2, Number(event.target.value) || 2))} /><span>sec</span></label>
          <button disabled={savingInterval} onClick={async () => {
            setSavingInterval(true);
            await onIntervalChange(intervalValue);
            setSavingInterval(false);
          }}>{savingInterval ? "Saving..." : "Save interval"}</button>
        </div>
        {loading ? <LoadingState /> : activity && (
          <>
            <section className="repo-status-strip">
              <div><GitBranch /><strong>{activity.commits.length}</strong><span>recent commits</span></div>
              <div><Rocket /><strong>{activity.deployments.length}</strong><span>deployments</span></div>
              <div><SquareTerminal /><strong>{activity.workflows?.length || 0}</strong><span>commit workflows</span></div>
            </section>
            <DetailSection title="Commit-trigger workflows">
              {activity.workflows?.length ? <div className="workflow-list">{activity.workflows.map((workflow) => (
                <div className="workflow-row" key={`${workflow.commit_sha}-${workflow.created_at}`}>
                  <span className={`workflow-state ${workflow.status}`}>{workflow.status.replaceAll("_", " ")}</span>
                  <div><strong>{workflow.commit_message || "Commit detected"}</strong><p>{workflow.commit_sha.slice(0, 8)} · {formatRelative(workflow.updated_at)}</p>{workflow.error && <small>{workflow.error}</small>}</div>
                  {workflow.pull_request_url
                    ? <a href={workflow.pull_request_url} target="_blank" rel="noreferrer" title="Open draft pull request"><ExternalLink size={15} /></a>
                    : workflow.commit_url && <a href={workflow.commit_url} target="_blank" rel="noreferrer" title="Open commit"><GitCommit size={15} /></a>}
                </div>
              ))}</div> : <p className="muted">The current commit is the monitoring baseline. The next pushed commit will create a workflow run automatically.</p>}
            </DetailSection>
            <DetailSection title="Recent GitHub activity">
              <div className="commit-list">{activity.commits.map((commit) => (
                <a href={commit.url} target="_blank" rel="noreferrer" className="commit-row" key={commit.sha}>
                  <code>{commit.sha.slice(0, 7)}</code><div><strong>{commit.message}</strong><p>{commit.author} · {formatRelative(commit.createdAt)}</p></div><ExternalLink size={14} />
                </a>
              ))}</div>
            </DetailSection>
            <DetailSection title={activity.repository.vercelProject ? `Vercel deployments · ${activity.repository.vercelProject.name}` : "Vercel deployments"}>
              {activity.deployments.length ? <div className="repo-deployments">{activity.deployments.map((deployment) => (
                <div className="repo-deployment" key={deployment.id}>
                  <span className={`deployment-state ${deployment.state?.toLowerCase()}`}>{deployment.state}</span>
                  <div><strong>{deployment.commitMessage || deployment.name}</strong><p>{deployment.commitSha?.slice(0, 8) || "No commit"} · {formatRelative(deployment.createdAt)}</p></div>
                  {deployment.url && <a href={deployment.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>}
                </div>
              ))}</div> : <p className="muted">No accessible Vercel project is linked. Open Connections and enable Vercel project access; team deployments are not exposed by the current identity-only token.</p>}
            </DetailSection>
            <DetailSection title="Latest deployment logs">
              {activity.latestLogs.length ? <pre className="live-log">{activity.latestLogs.map((log) => `${log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : "--:--:--"}  ${log.text}`).join("\n")}</pre> : <p className="muted">No deployment logs are accessible yet. Connect a Vercel access token with permission to the team that owns this repository.</p>}
            </DetailSection>
          </>
        )}
      </aside>
    </div>
  );
}

function formatRelative(value?: string | null) {
  if (!value) return "recently";
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

function IncidentList({ incidents, onSelect }: { incidents: Incident[]; onSelect: (item: Incident) => void }) {
  const [query, setQuery] = useState("");
  const filtered = incidents.filter((item) =>
    `${item.title} ${item.service} ${item.root_cause_type}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = Object.entries(filtered.reduce<Record<string, Incident[]>>((result, incident) => {
    const repository = incident.repository || "Unmapped repository";
    (result[repository] ||= []).push(incident);
    return result;
  }, {}));
  return (
    <div className="page-content">
      <div className="list-toolbar">
        <div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search incidents, services, patterns..." /></div>
        <span>{filtered.length} records</span>
      </div>
      <div className="incident-repository-groups">
        {groups.map(([repository, items]) => (
          <article className="panel incident-list-panel" key={repository}>
            <div className="repository-group-title"><Github size={17} /><div><strong>{repository}</strong><span>{items.length} incident{items.length === 1 ? "" : "s"} across {new Set(items.map((item) => item.commit_sha || item.deployment_id)).size} commits/deployments</span></div></div>
            {items.map((incident) => <IncidentRow key={incident.id} incident={incident} onClick={() => onSelect(incident)} expanded />)}
          </article>
        ))}
        {!groups.length && <Empty label="No incidents match this search" />}
      </div>
    </div>
  );
}

function Connections({
  client,
  status,
  onChanged,
}: {
  client: ReturnType<typeof api>;
  status: IntegrationStatus | null;
  onChanged: () => Promise<void>;
}) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; teamId: string | null; scope: string }[]>([]);
  const [repository, setRepository] = useState("");
  const [projectId, setProjectId] = useState("");
  const [renderKey, setRenderKey] = useState("");
  const [showRenderKeyForm, setShowRenderKeyForm] = useState(false);
  const [renderMessage, setRenderMessage] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [showVercelTokenForm, setShowVercelTokenForm] = useState(false);
  const [updatingVercelToken, setUpdatingVercelToken] = useState(false);
  const [vercelTokenMessage, setVercelTokenMessage] = useState("");
  const [teamAccessLimited, setTeamAccessLimited] = useState(false);
  const [guideProvider, setGuideProvider] = useState<"vercel" | "render" | null>(null);
  const [error, setError] = useState("");
  const connected = (provider: string) => status?.connections.some((item) => item.provider === provider);

  async function loadOptions() {
    try {
      const [repoResult, projectResult, matchResult] = await Promise.all([
        client.githubRepositories(),
        client.vercelProjects(),
        client.rematchRepositories(),
      ]);
      setRepositories(repoResult.repositories);
      setProjects(projectResult.projects);
      setTeamAccessLimited(projectResult.teamAccessLimited || matchResult.teamAccessLimited);
      setRepository(repoResult.repositories[0]?.fullName || "");
      setProjectId(projectResult.projects[0]?.id || "");
      if (matchResult.matches.length) await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load provider projects");
    }
  }

  useEffect(() => {
    if (connected("github") && connected("vercel")) void loadOptions();
  }, [status?.connections.length]);

  return (
    <div className="page-content connections-page">
      <section className="connections-intro">
        <div><p className="eyebrow">ACCOUNT ACCESS</p><h3>Connected Accounts</h3><p>Providers only expose data authorized by the signed-in user. Tokens are encrypted separately for every account.</p></div>
      </section>
      <section className="connections-layout">
        <aside><h3>Connected</h3><p>Manage identity, deployment, and source providers used by RecallOps.</p></aside>
        <div className="connection-catalog">
          <ConnectionRow icon={<Github />} name="GitHub" detail="Source repositories and commits" connected={Boolean(connected("github"))} locked />
          <ConnectionRow
            icon={<Rocket />}
            name="Vercel"
            detail={connected("vercel") ? "Deployment projects and build logs" : "Connect deployment projects"}
            connected={Boolean(connected("vercel"))}
            onGuide={() => setGuideProvider("vercel")}
            onConnect={async () => {
              const authorization = await client.startVercel();
              window.location.assign(authorization.url);
            }}
            onDisconnect={async () => {
              await client.disconnectProvider("vercel");
              await onChanged();
            }}
          >
            {connected("vercel") && (
              <button className="inline-token-action" onClick={() => {
                setShowVercelTokenForm((current) => !current);
                setVercelTokenMessage("");
              }}>
                <RefreshCw size={13} /> {showVercelTokenForm ? "Cancel token update" : "Update access token"}
              </button>
            )}
          </ConnectionRow>
          {connected("vercel") && (!projects.length || showVercelTokenForm) && (
            <div className="permission-fallback">
              <strong>{projects.length ? "Replace the Vercel access token" : "Vercel identity is connected, but project REST access is unavailable."}</strong>
              <p>{projects.length ? "Paste a new token to rotate credentials and refresh accessible projects." : "Use a personal Vercel access token to enable project, deployment, and log APIs for this account."}</p>
              <div><input type="password" value={vercelToken} onChange={(event) => setVercelToken(event.target.value)} placeholder="Vercel access token" /><button disabled={updatingVercelToken || vercelToken.length < 20} onClick={async () => {
                setUpdatingVercelToken(true);
                setVercelTokenMessage("");
                try {
                  const result = await client.connectVercelToken(vercelToken);
                  setVercelToken("");
                  await onChanged();
                  await loadOptions();
                  setShowVercelTokenForm(false);
                  setVercelTokenMessage(`Token updated. ${result.projects} projects found and ${result.matches} repositories matched.`);
                } catch (requestError) {
                  setError(requestError instanceof Error ? requestError.message : "Vercel token connection failed");
                } finally {
                  setUpdatingVercelToken(false);
                }
              }}>{updatingVercelToken ? "Verifying..." : projects.length ? "Update token" : "Enable project access"}</button></div>
              {vercelTokenMessage && <p className="token-success">{vercelTokenMessage}</p>}
            </div>
          )}
          <ConnectionRow
            icon={<Server />}
            name="Render"
            detail={connected("render") ? "Render API account connected" : "API key connection"}
            connected={Boolean(connected("render"))}
            onGuide={() => setGuideProvider("render")}
            onDisconnect={async () => {
              await client.disconnectProvider("render");
              await onChanged();
            }}
          >
            {connected("render") && (
              <button className="inline-token-action" onClick={() => {
                setShowRenderKeyForm((current) => !current);
                setRenderMessage("");
              }}>
                <RefreshCw size={13} /> {showRenderKeyForm ? "Cancel API key update" : "Update API key"}
              </button>
            )}
            {(!connected("render") || showRenderKeyForm) && (
              <div className="render-connect-form">
                <input type="password" value={renderKey} onChange={(event) => setRenderKey(event.target.value)} placeholder="Render API key" />
                <button disabled={renderKey.length < 20} onClick={async () => {
                  try {
                    const result = await client.connectRender(renderKey);
                    setRenderKey("");
                    setShowRenderKeyForm(false);
                    setRenderMessage(`${result.services} services found and ${result.matches} repositories matched.`);
                    await onChanged();
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "Render connection failed");
                  }
                }}>{connected("render") ? "Update" : "Connect"}</button>
              </div>
            )}
            {renderMessage && <p className="token-success">{renderMessage}</p>}
          </ConnectionRow>
        </div>
      </section>
      {connected("github") && connected("vercel") && (
        <article className="panel mapping-panel">
          <div className="panel-heading"><div><p className="eyebrow">LIVE TRACKING</p><h3>Map a Vercel project to its GitHub repository</h3></div></div>
          {teamAccessLimited && <p className="permission-note">Vercel did not grant team-list access. Personal projects remain available; team projects require the corresponding REST permission in your Vercel App.</p>}
          <div className="form-row">
            <label>Vercel project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => <option value={project.id} key={`${project.teamId}-${project.id}`}>{project.scope} / {project.name}</option>)}
            </select></label>
            <label>GitHub repository<select value={repository} onChange={(event) => setRepository(event.target.value)}>
              {repositories.map((repo) => <option value={repo.fullName} key={repo.fullName}>{repo.fullName}</option>)}
            </select></label>
          </div>
          <button className="download-button" disabled={!projectId || !repository} onClick={async () => {
            const project = projects.find((item) => item.id === projectId);
            if (!project) return;
            await client.trackProject({
              vercelProjectId: project.id,
              vercelProjectName: project.name,
              vercelTeamId: project.teamId,
              githubRepository: repository,
            });
            await onChanged();
          }}>Track project continuously</button>
          <div className="trend-list">
            {status?.projects.map((project) => <div className="trend-item" key={project.id}><span>LIVE</span><div><strong>{project.vercel_project_name}</strong><p>{project.github_repository}</p></div></div>)}
          </div>
        </article>
      )}
      {connected("github") && connected("render") && (
        <article className="panel mapping-panel">
          <div className="panel-heading"><div><p className="eyebrow">RENDER TRACKING</p><h3>Matched Render services</h3></div></div>
          {status?.renderServices.length ? (
            <div className="trend-list">
              {status.renderServices.map((service) => (
                <div className="trend-item" key={service.id}>
                  <span>LIVE</span>
                  <div><strong>{service.render_service_name}</strong><p>{service.github_repository}</p></div>
                </div>
              ))}
            </div>
          ) : <p className="muted">No Render service repository matched an imported GitHub repository yet.</p>}
        </article>
      )}
      {guideProvider && (
        <ProviderCredentialGuide
          provider={guideProvider}
          onClose={() => setGuideProvider(null)}
        />
      )}
      {error && <Toast message={error} tone="error" onClose={() => setError("")} />}
    </div>
  );
}

function ConnectionRow({
  icon,
  name,
  detail,
  connected,
  locked = false,
  onConnect,
  onDisconnect,
  onGuide,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  connected: boolean;
  locked?: boolean;
  onConnect?: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onGuide?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <article className="connection-row">
      <span className="connection-icon">{icon}</span>
      <div><strong>{name}</strong><p>{detail}</p>{children}</div>
      <span className={`connection-status ${connected ? "connected" : ""}`}>{connected ? "Connected" : "Not connected"}</span>
      <div className="connection-actions">
        {onGuide && <button className="guide-action" title={`${name} setup guide`} onClick={onGuide}>Guide</button>}
        {!locked && (connected
          ? <button className="icon-action" title={`Disconnect ${name}`} onClick={() => void onDisconnect?.()}>-</button>
          : onConnect && <button className="icon-action add" title={`Connect ${name}`} onClick={() => void onConnect()}>+</button>)}
      </div>
    </article>
  );
}

function ProviderCredentialGuide({
  provider,
  onClose,
}: {
  provider: "vercel" | "render";
  onClose: () => void;
}) {
  const isVercel = provider === "vercel";
  const settingsUrl = isVercel
    ? "https://vercel.com/account/settings/tokens"
    : "https://dashboard.render.com/u/settings#api-keys";
  const docsUrl = isVercel
    ? "https://vercel.com/docs/rest-api"
    : "https://render.com/docs/api";
  return (
    <div className="modal-backdrop provider-backdrop" onMouseDown={onClose}>
      <section className="credential-guide" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-button" title="Close guide" onClick={onClose}><X size={18} /></button>
        <div className="access-guide-heading">
          <span>{isVercel ? <Rocket /> : <Server />}</span>
          <div>
            <p className="eyebrow">CREDENTIAL GUIDE</p>
            <h2>Get a {isVercel ? "Vercel access token" : "Render API key"}</h2>
            <p>
              Use the account that owns, or has access to, the deployment projects you want RecallOps to monitor.
            </p>
          </div>
        </div>
        <ol className="access-steps">
          <li><span>1</span><div><strong>Open {isVercel ? "token settings" : "Account Settings"}</strong><p>Sign in to the correct {isVercel ? "Vercel account or team member account" : "Render account and workspace"}.</p></div></li>
          <li><span>2</span><div><strong>Create a new {isVercel ? "access token" : "API key"}</strong><p>Name it RecallOps. Choose an expiration you can rotate safely. Render displays the full key only once.</p></div></li>
          <li><span>3</span><div><strong>Paste it on Connections</strong><p>RecallOps verifies it, encrypts it with authenticated encryption, and never displays the saved credential.</p></div></li>
          <li><span>4</span><div><strong>Confirm project access</strong><p>{isVercel ? "The token owner must belong to the team that owns the deployment. Personal tokens cannot reveal teams the user cannot access." : "The key must belong to an account with access to the services, deploys, and logs you want monitored."}</p></div></li>
        </ol>
        <div className="credential-guide-links">
          <a href={settingsUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open {isVercel ? "Vercel token settings" : "Render API key settings"}</a>
          <a href={docsUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Read official API guide</a>
        </div>
        <div className="credential-safety"><ShieldCheck size={15} /><span>Never commit tokens to Git, send them in screenshots, or share them between users.</span></div>
      </section>
    </div>
  );
}

function ProviderOnboarding({
  client,
  onConnected,
  onSkip,
}: {
  client: ReturnType<typeof api>;
  onConnected: () => Promise<void>;
  onSkip: () => void;
}) {
  const [renderKey, setRenderKey] = useState("");
  const [showRender, setShowRender] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop provider-backdrop">
      <section className="provider-onboarding">
        <div><p className="eyebrow">GITHUB CONNECTED</p><h2>Where do you deploy?</h2><p>Connect a deployment provider now so RecallOps can match repositories, fetch build logs, and detect failures.</p></div>
        <div className="provider-options">
          <button onClick={async () => {
            try {
              const authorization = await client.startVercel();
              window.location.assign(authorization.url);
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : "Vercel connection failed");
            }
          }}><span><Rocket /></span><div><strong>Connect Vercel</strong><small>Projects, deployments, and build logs</small></div><ArrowRight /></button>
          <button onClick={() => setShowRender(!showRender)}><span><Server /></span><div><strong>Connect Render</strong><small>Services and deploy activity via API key</small></div><ArrowRight /></button>
        </div>
        {showRender && <div className="provider-render-form"><input type="password" value={renderKey} onChange={(event) => setRenderKey(event.target.value)} placeholder="Paste Render API key" /><button disabled={renderKey.length < 20} onClick={async () => {
          try {
            await client.connectRender(renderKey);
            await onConnected();
            onSkip();
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Render connection failed");
          }
        }}>Connect Render</button></div>}
        {error && <p className="form-error">{error}</p>}
        <button className="skip-provider" onClick={onSkip}>Skip for now</button>
      </section>
    </div>
  );
}

function VercelProjectAccessGuide({
  client,
  onEnabled,
  onLater,
}: {
  client: ReturnType<typeof api>;
  onEnabled: () => Promise<void>;
  onLater: () => void;
}) {
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop provider-backdrop">
      <section className="project-access-guide">
        <div className="access-guide-heading">
          <span><Rocket /></span>
          <div><p className="eyebrow">ONE MORE CONNECTION STEP</p><h2>Enable Vercel project access</h2><p>Your Vercel identity is connected, but Vercel has not granted access to team projects, deployments, or build logs.</p></div>
        </div>
        <ol className="access-steps">
          <li><span>1</span><div><strong>Open Vercel Access Tokens</strong><p>Sign in to the same Vercel account that owns or belongs to the deployment team.</p></div></li>
          <li><span>2</span><div><strong>Create a token</strong><p>Name it “RecallOps” and choose a suitable expiration date.</p></div></li>
          <li><span>3</span><div><strong>Paste it below</strong><p>The token is encrypted server-side and stored separately for your account.</p></div></li>
        </ol>
        <a className="vercel-token-link" href="https://vercel.com/account/settings/tokens" target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Open Vercel token settings
        </a>
        <label>Vercel access token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the token created in Vercel" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={connecting || token.length < 20} onClick={async () => {
          setConnecting(true);
          setError("");
          try {
            const result = await client.connectVercelToken(token);
            if (!result.projects) {
              setError("Token verified, but no Vercel projects were visible. Confirm this account belongs to the team that owns the deployment.");
              return;
            }
            await onEnabled();
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Could not enable Vercel project access");
          } finally {
            setConnecting(false);
          }
        }}><ShieldCheck size={17} /> {connecting ? "Verifying project access..." : "Verify and enable access"}</button>
        <button className="skip-provider" onClick={onLater}>Remind me later</button>
        <p className="access-security"><Lock size={13} /> RecallOps never sends this token to the browser again after submission.</p>
      </section>
    </div>
  );
}

function AccountPage({ user, status }: { user: User; status: IntegrationStatus | null }) {
  return (
    <div className="page-content account-page">
      <section className="account-identity">
        <div className="account-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
        <div><p className="eyebrow">RECALLOPS ACCOUNT</p><h3>{user.name}</h3><p>{user.email}</p></div>
      </section>
      <section className="account-grid">
        <article className="panel"><p className="eyebrow">ROLE</p><h3>{user.role}</h3><p>Authenticated with Firebase GitHub sign-in.</p></article>
        <article className="panel"><p className="eyebrow">MONITORING</p><h3>{status?.repositories.length || 0} repositories</h3><p>{status?.projects.length || 0} deployment projects mapped.</p></article>
        <article className="panel"><p className="eyebrow">CONNECTED PROVIDERS</p><h3>{status?.connections.length || 0} accounts</h3><p>{status?.connections.map((item) => item.provider).join(", ") || "GitHub connection pending"}</p></article>
      </section>
      <article className="panel account-details">
        <div className="panel-heading"><div><p className="eyebrow">ACCESS SUMMARY</p><h3>Provider accounts</h3></div></div>
        {status?.connections.map((connection) => (
          <div className="account-detail-row" key={connection.provider}><strong>{connection.provider}</strong><span>{connection.account_name}</span><small>{connection.updated_at ? `Updated ${formatRelative(connection.updated_at)}` : "Connected"}</small></div>
        ))}
      </article>
    </div>
  );
}

function ProviderHealthPage({
  client,
  resources,
  incidents,
  onChanged,
  onImportRepository,
}: {
  client: ReturnType<typeof api>;
  resources: ProviderHealthResource[];
  incidents: Incident[];
  onChanged: () => Promise<void>;
  onImportRepository: () => void;
}) {
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const failedStatuses = new Set([
    "ERROR",
    "CANCELED",
    "FAILED",
    "BUILD_FAILED",
    "UPDATE_FAILED",
    "DEACTIVATED",
  ]);
  const rows = resources.filter((resource) => resource.resourceId);
  const failed = rows.filter((resource) =>
    failedStatuses.has(resource.latestDeployment?.status?.toUpperCase() || ""),
  );
  const healthy = rows.filter((resource) => {
    const status = resource.latestDeployment?.status?.toUpperCase() || "";
    return status && !failedStatuses.has(status);
  });

  async function run(resource: ProviderHealthResource) {
    const key = `${resource.provider}:${resource.resourceId}`;
    setWorking(key);
    setError("");
    setNotice("");
    try {
      if (!resource.tracked) {
        const result = await client.trackProviderResource(resource);
        setNotice(result.inspectionError
          ? `${resource.resourceName} is monitored. Inspection will retry automatically.`
          : `${resource.resourceName} is monitored. Failure inspection completed.`);
      } else {
        await client.inspectProvider(resource.provider);
        setNotice(`${resource.resourceName} was inspected. Any failed deployment was sent for remediation.`);
      }
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Deployment inspection failed");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="page-content health-page">
      <section className="health-summary">
        <div><p className="eyebrow">LIVE PROVIDER STATUS</p><h3>Deployment health</h3><p>Vercel and Render resources are checked against their latest deployment. Failed tracked deployments enter the DeepSeek remediation and draft-PR workflow.</p></div>
        <div className="health-counts">
          <span><strong>{rows.length}</strong> projects</span>
          <span className="healthy"><strong>{healthy.length}</strong> healthy</span>
          <span className="failed"><strong>{failed.length}</strong> failed</span>
        </div>
      </section>
      <section className="provider-health-list">
        {rows.map((resource) => {
          const deployment = resource.latestDeployment;
          const isFailed = failedStatuses.has(deployment?.status?.toUpperCase() || "");
          const incident = incidents.find((item) => item.deployment_id === deployment?.id);
          const key = `${resource.provider}:${resource.resourceId}`;
          const actionLabel = !resource.repository
            ? "Repository unavailable"
            : !resource.repositoryImported
              ? "Import repository"
              : !resource.tracked
                ? "Monitor and fix"
                : isFailed && !incident?.pull_request_url
                  ? "Fix now"
                  : "Inspect now";
          return (
            <article className="provider-health-row" key={key}>
              <span className={`health-provider ${resource.provider}`}>{resource.provider === "vercel" ? <Rocket /> : <Server />}</span>
              <div className="health-resource">
                <div><strong>{resource.resourceName}</strong><span>{resource.provider}</span></div>
                <p>{resource.repository || "No GitHub repository metadata exposed"}</p>
                {deployment && <small>{deployment.commitSha?.slice(0, 9) || "No commit"} · {deployment.createdAt ? formatRelative(deployment.createdAt) : "Unknown deployment time"}</small>}
              </div>
              <div className="health-deployment-state">
                <span className={isFailed ? "failed" : deployment ? "healthy" : "unknown"}>{deployment?.status || "No deployment"}</span>
                <small>{incident?.pull_request_url ? "Draft PR created" : incident?.fix_summary ? "Fix generated" : isFailed ? "Needs remediation" : resource.tracked ? "Monitoring" : "Not tracked"}</small>
              </div>
              {incident?.pull_request_url ? (
                <a className="health-pr-link" href={incident.pull_request_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open PR</a>
              ) : (
                <button
                  className="health-action"
                  disabled={!resource.repository || working === key}
                  onClick={resource.repositoryImported ? () => void run(resource) : onImportRepository}
                >
                  {working === key ? <RefreshCw className="spin" size={14} /> : isFailed ? <Wrench size={14} /> : <Activity size={14} />}
                  {working === key ? "Inspecting..." : actionLabel}
                </button>
              )}
            </article>
          );
        })}
        {!rows.length && <Empty label="Connect Vercel or Render to load deployment health" />}
      </section>
      {notice && <Toast message={notice} tone="success" onClose={() => setNotice("")} />}
      {error && <Toast message={error} tone="error" onClose={() => setError("")} />}
    </div>
  );
}

function DeploymentPage({
  deployments,
  configured,
  importedCount,
  onSync,
}: {
  deployments: Deployment[];
  configured: boolean;
  importedCount: number;
  onSync: () => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="page-content">
      <section className="handoff-hero">
        <div>
          <p className="eyebrow">LIVE DEPLOYMENT PROVIDERS</p>
          <h3>Commit-aware deployment remediation</h3>
          <p>
            Fetch failed production deployments, read the triggering commit through GitHub MCP,
            and generate a reviewable source fix.
          </p>
        </div>
        <button
          className="analyze-button"
          disabled={syncing || !configured}
          onClick={async () => {
            setSyncing(true);
            setError("");
            try {
              await onSync();
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : "Deployment sync failed");
            } finally {
              setSyncing(false);
            }
          }}
        >
          <RefreshCw size={17} /> {syncing ? "Inspecting failures..." : "Sync deployment providers"}
        </button>
      </section>
      {!configured && (
        <div className="setup-notice">
          <Rocket size={18} />
          <div><strong>{importedCount ? "Repositories imported, deployment provider mapping pending" : "Import a repository to begin"}</strong><p>{importedCount ? "Connect Vercel or Render from Connected Accounts to fetch deployment logs and failures." : "Choose a GitHub repository first. RecallOps links matching deployment services when access is available."}</p></div>
        </div>
      )}
      {error && <Toast message={error} tone="error" onClose={() => setError("")} />}
      <article className="panel incident-list-panel deployment-list">
        {deployments.length ? deployments.map((deployment) => (
          <div className="deployment-record" key={deployment.id}>
          <div className="deployment-row">
            <span className="severity-dot sev-1" />
            <div>
              <strong>{deployment.raw_payload.repository || deployment.service}</strong>
              <p>{deployment.message || "Deployment failed"} · {deployment.service}</p>
            </div>
            <code>{deployment.commit_sha?.slice(0, 10) || "No commit"}</code>
            <span className="status open">{deployment.status}</span>
            <time>{new Date(deployment.created_at).toLocaleString()}</time>
          </div>
          {deployment.raw_payload.logs && <details className="deployment-logs"><summary>View captured build logs</summary><pre>{deployment.raw_payload.logs}</pre></details>}
          </div>
        )) : <Empty label="No deployment failures have been synchronized" />}
      </article>
    </div>
  );
}

function IncidentRow({ incident, onClick, expanded = false }: { incident: Incident; onClick: () => void; expanded?: boolean }) {
  return (
    <button className={`incident-row ${expanded ? "expanded" : ""}`} onClick={onClick}>
      <span className={`severity-dot ${incident.severity.toLowerCase()}`} />
      <div className="incident-main"><strong>{incident.title}</strong><p>{incident.service} / {incident.error_category}{incident.commit_sha ? ` / ${incident.commit_sha.slice(0, 8)}` : ""}</p></div>
      {expanded && <p className="row-diagnosis">{incident.diagnosis}</p>}
      <span className={`badge ${incident.novelty}`}>{incident.novelty}</span>
      <span className={`status ${incident.status}`}>{incident.status}</span>
      <time>{new Date(incident.created_at).toLocaleDateString()}</time>
      <ArrowRight size={16} />
    </button>
  );
}

function Handoff({ incidents, analytics, onSelect }: { incidents: Incident[]; analytics: Analytics | null; onSelect: (item: Incident) => void }) {
  const open = incidents.filter((item) => item.status === "open");
  return (
    <div className="page-content handoff-page">
      <section className="handoff-hero">
        <div><p className="eyebrow">SHIFT BRIEF / GENERATED FROM MEMORY</p><h3>{open.length ? `${open.length} incident${open.length > 1 ? "s" : ""} need attention` : "The queue is clear"}</h3><p>Context, prior attempts, and proven next steps are gathered here for the incoming engineer.</p></div>
        <ShieldCheck size={48} />
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">ACTIVE</p><h3>Open investigations</h3></div></div>
          {open.length ? open.map((item) => <IncidentRow key={item.id} incident={item} onClick={() => onSelect(item)} />) : <Empty label="No open incidents" />}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">WATCH LIST</p><h3>Recurring risks</h3></div></div>
          <div className="trend-list">
            {analytics?.trends.slice(0, 5).map((trend) => <div className="trend-item" key={trend.pattern}><span>{trend.count}x</span><div><strong>{trend.service}</strong><p>{trend.recommendation}</p></div></div>)}
          </div>
        </article>
      </section>
    </div>
  );
}

function AnalyzeModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        title: form.get("title"),
        description: form.get("description"),
        error_logs: form.get("logs"),
        service_hint: form.get("service") || null,
        severity_hint: form.get("severity") || null,
        source: "manual",
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analysis failed");
      setLoading(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <button className="close-button" onClick={onClose}><X /></button>
        <div className="modal-heading"><span><BrainCircuit /></span><div><p className="eyebrow">LANGGRAPH WORKFLOW</p><h2>Analyze a new incident</h2><p>The agent will classify, search memory, diagnose, and record this event.</p></div></div>
        <form onSubmit={submit}>
          <label>Incident title<input name="title" required minLength={3} placeholder="Checkout requests returning 500 errors" /></label>
          <div className="form-row">
            <label>Service hint<input name="service" placeholder="checkout-service" /></label>
            <label>Severity<select name="severity"><option value="">Auto-detect</option><option>SEV-1</option><option>SEV-2</option><option>SEV-3</option></select></label>
          </div>
          <label>What is happening?<textarea name="description" required minLength={5} rows={4} placeholder="Describe symptoms, affected users, and recent changes..." /></label>
          <label>Error logs<textarea name="logs" rows={5} className="code-input" placeholder="Paste the relevant log excerpt..." /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={loading}>{loading ? "Searching incident memory..." : "Run memory analysis"}<Sparkles size={17} /></button>
        </form>
      </section>
    </div>
  );
}

function IncidentDrawer({
  incident,
  onClose,
  onDownload,
  onCreateDraftPr,
}: {
  incident: Incident;
  onClose: () => void;
  onDownload: () => Promise<void>;
  onCreateDraftPr: () => Promise<void>;
}) {
  const [downloading, setDownloading] = useState(false);
  const [creatingPr, setCreatingPr] = useState(false);
  const [repairError, setRepairError] = useState("");
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-top"><div><span className={`badge ${incident.novelty}`}>{incident.novelty} incident</span><h2>{incident.title}</h2><p>{incident.service} / {incident.severity} / {new Date(incident.created_at).toLocaleString()}</p></div><button className="close-button" onClick={onClose}><X /></button></div>
        {incident.commit_sha && (
          <DetailSection title="Failed deployment source">
            <div className="source-metadata">
              <span><GitCommit size={15} /> {incident.commit_sha}</span>
              <span>{incident.repository}</span>
              <span>{incident.file_path}</span>
            </div>
          </DetailSection>
        )}
        <section className="diagnosis-card"><div className="section-icon"><BrainCircuit /></div><div><p className="eyebrow">AGENT DIAGNOSIS</p><p>{incident.diagnosis}</p></div></section>
        <DetailSection title="Root cause"><p>{incident.root_cause}</p></DetailSection>
        <DetailSection title="Impact"><p>{incident.impact}</p></DetailSection>
        <DetailSection title="Retrieved memory">
          {incident.retrieved_memories.length ? incident.retrieved_memories.map((memory) => (
            <div className="memory-match" key={memory.incident.id}><strong>{Math.round(memory.similarity * 100)}%</strong><div><b>{memory.incident.title}</b><p>{memory.incident.root_cause}</p></div></div>
          )) : <p className="muted">No close historical match. This is a genuinely new pattern.</p>}
        </DetailSection>
        <DetailSection title="Recommended resolution">
          <ol>{incident.resolution_steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </DetailSection>
        <DetailSection title="Action items">
          <ul>{incident.action_items.map((item) => <li key={item}><CheckCircle2 size={15} />{item}</li>)}</ul>
        </DetailSection>
        {incident.error_logs && <DetailSection title="Error evidence"><pre>{incident.error_logs}</pre></DetailSection>}
        {incident.code_snippet && <DetailSection title="Failing code snippet"><pre>{incident.code_snippet}</pre></DetailSection>}
        {incident.remediation_error && (
          <DetailSection title="Agent action required">
            <div className="setup-notice">
              <AlertTriangle size={18} />
              <div>
                <strong>Automatic repair is currently blocked</strong>
                <p>{incident.remediation_error}</p>
              </div>
            </div>
          </DetailSection>
        )}
        {incident.fix_diff && (
          <DetailSection title="Proposed code fix">
            <p>{incident.fix_summary}</p>
            <p className="muted">{incident.fix_rationale}</p>
            <pre>{incident.fix_diff}</pre>
            {incident.pull_request_url ? (
              <a className="pr-link" href={incident.pull_request_url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Open draft pull request
              </a>
            ) : (
              <button
                className="download-button"
                disabled={creatingPr}
                onClick={async () => {
                  setCreatingPr(true);
                  setRepairError("");
                  try {
                    await onCreateDraftPr();
                  } catch (requestError) {
                    setRepairError(requestError instanceof Error ? requestError.message : "Could not create draft PR");
                  } finally {
                    setCreatingPr(false);
                  }
                }}
              >
                <Wrench size={17} /> {creatingPr ? "Creating draft PR..." : "Approve and create draft PR"}
              </button>
            )}
            {repairError && <p className="form-error">{repairError}</p>}
          </DetailSection>
        )}
        <button className="download-button" disabled={downloading} onClick={async () => { setDownloading(true); await onDownload(); setDownloading(false); }}>
          <Download size={17} /> {downloading ? "Preparing PDF..." : "Download structured PDF"}
        </button>
      </aside>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h3>{title}</h3>{children}</section>;
}

function LoadingState() {
  return <div className="loading-state"><BrainCircuit /><p>Reconstructing incident memory...</p></div>;
}

function Empty({ label }: { label: string }) {
  return <div className="empty"><CheckCircle2 /><p>{label}</p></div>;
}

export default App;
