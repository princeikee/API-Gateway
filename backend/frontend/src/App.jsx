import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Copy,
  Database,
  Download,
  Edit,
  Eye,
  EyeOff,
  Gauge,
  GitBranch,
  Globe,
  HardDrive,
  Key,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Percent,
  Plus,
  ScrollText,
  Server,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { Chart, Filler, LineController, LineElement, LinearScale, PointElement, CategoryScale, Tooltip } from "chart.js";
import React, { useEffect, useMemo, useRef, useState } from "react";

Chart.register(LineController, LineElement, LinearScale, PointElement, CategoryScale, Tooltip, Filler);

const initialServices = [
  { id: "user-service", name: "User Service", url: "http://localhost:3001", health: "healthy", latency: 23, requests: 0, errors: 0 },
  { id: "payment-service", name: "Payment Service", url: "http://localhost:3002", health: "healthy", latency: 45, requests: 0, errors: 0 },
  { id: "analytics-service", name: "Analytics Service", url: "http://localhost:3003", health: "healthy", latency: 67, requests: 0, errors: 0 },
  { id: "notification-service", name: "Notification Service", url: "http://localhost:3004", health: "warning", latency: 120, requests: 0, errors: 0 },
  { id: "search-service", name: "Search Service", url: "http://localhost:3005", health: "healthy", latency: 89, requests: 0, errors: 0 },
  { id: "file-service", name: "File Service", url: "http://localhost:3006", health: "healthy", latency: 34, requests: 0, errors: 0 },
];

const initialRoutes = [
  { id: "route-0", path: "/api/users/*", service: "user-service", methods: ["GET", "POST", "PUT", "DELETE"], auth: true, rateLimit: true, cache: false, requests: 54218, avgLatency: 39, status: "active" },
  { id: "route-1", path: "/api/payments/*", service: "payment-service", methods: ["POST", "GET"], auth: true, rateLimit: true, cache: false, requests: 40182, avgLatency: 52, status: "active" },
  { id: "route-2", path: "/api/analytics/*", service: "analytics-service", methods: ["GET"], auth: true, rateLimit: false, cache: true, requests: 69241, avgLatency: 61, status: "active" },
  { id: "route-3", path: "/api/notifications/*", service: "notification-service", methods: ["POST", "GET"], auth: true, rateLimit: true, cache: false, requests: 28743, avgLatency: 118, status: "active" },
  { id: "route-4", path: "/api/search/*", service: "search-service", methods: ["GET"], auth: false, rateLimit: true, cache: true, requests: 77309, avgLatency: 82, status: "active" },
  { id: "route-5", path: "/api/files/*", service: "file-service", methods: ["GET", "POST"], auth: true, rateLimit: false, cache: true, requests: 35127, avgLatency: 44, status: "active" },
];

const authMethods = [
  { type: "jwt", name: "JWT Authentication", enabled: true, config: "RS256, 1h expiry" },
  { type: "apikey", name: "API Key", enabled: true, config: "X-API-Key header" },
  { type: "oauth2", name: "OAuth 2.0", enabled: false, config: "Custom provider scopes" },
];

const apiKeys = [
  { key: "ak_live_51H8m...", name: "Production Key", created: "2024-01-10", lastUsed: "2 mins ago", requests: 2847293 },
  { key: "ak_test_9K2n...", name: "Staging Key", created: "2024-01-12", lastUsed: "1 hour ago", requests: 45231 },
  { key: "ak_dev_3M7p...", name: "Development", created: "2024-01-14", lastUsed: "3 days ago", requests: 8934 },
];

const demoRateLimits = [
  { name: "Premium Tier", rpm: 10000, burst: 1000, current: 2341 },
  { name: "Standard Tier", rpm: 1000, burst: 100, current: 567 },
  { name: "Basic Tier", rpm: 100, burst: 10, current: 89 },
  { name: "Anonymous", rpm: 10, burst: 5, current: 3 },
];

const demoCacheRules = [
  { path: "/api/search/*", ttl: 300, type: "public", size: "1.2 GB" },
  { path: "/api/analytics/dashboard", ttl: 60, type: "private", size: "456 MB" },
  { path: "/api/files/*", ttl: 3600, type: "public", size: "892 MB" },
  { path: "/api/users/profile", ttl: 0, type: "no-cache", size: "-" },
];

const demoCacheMetrics = { cacheSize: "2.4 GB", cacheHitRate: 87.3, avgTtl: "5m 42s" };

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "services", label: "Services", icon: Server },
  { id: "routes", label: "Routes", icon: GitBranch },
  { id: "auth", label: "Authentication", icon: Key },
  { id: "rate-limits", label: "Rate Limits", icon: Gauge },
  { id: "cache", label: "Cache", icon: Database },
  { id: "logs", label: "Logs", icon: ScrollText },
];

const paths = ["/api/users/profile", "/api/users/settings", "/api/payments/charge", "/api/analytics/dashboard", "/api/search/query", "/api/files/upload"];
const methods = ["GET", "POST", "PUT"];
const AUTH_STORAGE_KEY = "api-gateway-admin-token";
const ADMIN_STORAGE_KEY = "api-gateway-admin-user";
const APP_MODE_STORAGE_KEY = "api-gateway-app-mode";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const routeRankClasses = [
  { text: "text-accent-cyan", bg: "bg-accent-cyan", soft: "bg-accent-cyan/10" },
  { text: "text-accent-purple", bg: "bg-accent-purple", soft: "bg-accent-purple/10" },
  { text: "text-accent-emerald", bg: "bg-accent-emerald", soft: "bg-accent-emerald/10" },
  { text: "text-yellow-400", bg: "bg-yellow-400", soft: "bg-yellow-400/10" },
  { text: "text-accent-rose", bg: "bg-accent-rose", soft: "bg-accent-rose/10" },
];

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredAdmin() {
  try {
    const stored = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    return null;
  }
}

function App() {
  const [mode, setMode] = useState(() => window.localStorage.getItem(APP_MODE_STORAGE_KEY) || "demo");

  function handleModeChange(nextMode) {
    setMode(nextMode);
    window.localStorage.setItem(APP_MODE_STORAGE_KEY, nextMode);
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <ModeSwitch mode={mode} onChange={handleModeChange} />
      {mode === "demo" ? <GatewayDemoApp /> : <RealGatewayApp />}
    </div>
  );
}

function ModeSwitch({ mode, onChange }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/50 backdrop-blur">
      <button
        type="button"
        onClick={() => onChange("demo")}
        className={`min-h-10 rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 ${mode === "demo" ? "bg-accent-cyan text-slate-950" : "text-slate-400 hover:text-slate-100"}`}
      >
        Demo
      </button>
      <button
        type="button"
        onClick={() => onChange("real")}
        className={`min-h-10 rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 ${mode === "real" ? "bg-accent-cyan text-slate-950" : "text-slate-400 hover:text-slate-100"}`}
      >
        Real
      </button>
    </div>
  );
}

function RealGatewayApp() {
  const [token, setToken] = useState(() => window.localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [admin, setAdmin] = useState(readStoredAdmin);

  function handleAuthenticated(nextToken, nextAdmin) {
    setToken(nextToken);
    setAdmin(nextAdmin);
    window.localStorage.setItem(AUTH_STORAGE_KEY, nextToken);
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(nextAdmin || {}));
  }

  function handleLogout() {
    setToken("");
    setAdmin(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
  }

  if (!token) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  return <RealDashboard token={token} admin={admin} onLogout={handleLogout} />;
}

function LoginScreen({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("loading");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.token) {
        throw new Error(payload.message || "Login failed. Check the admin email and password.");
      }

      onAuthenticated(payload.token, payload.admin || decodeJwtPayload(payload.token));
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Auth API is not running yet. Start the backend login endpoint, then try again." : err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/40 lg:grid-cols-[1fr_420px]">
        <div className="hidden border-r border-slate-800 bg-slate-950 p-8 lg:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-cyan text-slate-950">
                <Shield className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="max-w-md text-3xl font-semibold leading-tight">Admin access for the real API gateway.</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
                This side is wired for one administrator account, server-side environment credentials, and JWT-protected dashboard access.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <LoginSignal icon={Lock} label="Env credentials" />
              <LoginSignal icon={KeyRound} label="JWT session" />
              <LoginSignal icon={LayoutDashboard} label="Protected app" />
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-medium text-accent-cyan">Real gateway</p>
            <h2 className="mt-2 text-2xl font-semibold">Admin login</h2>
            <p className="mt-2 text-sm text-slate-400">Use the single admin account configured on the backend.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="control-input w-full pl-11"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="control-input w-full pl-11 pr-12"
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-rose-100" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function LoginSignal({ icon: Icon, label }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <Icon className="mb-3 h-5 w-5 text-accent-cyan" aria-hidden="true" />
      <p className="text-xs text-slate-300">{label}</p>
    </div>
  );
}

function RealDashboard({ token, admin, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [gatewayState, setGatewayState] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [newApiKey, setNewApiKey] = useState(null);
  const [apiKeySecrets, setApiKeySecrets] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const claims = useMemo(() => admin || decodeJwtPayload(token), [admin, token]);

  useEffect(() => {
    let ignore = false;

    async function loadGatewayState() {
      try {
        const response = await fetch(`${API_BASE_URL}/gateway/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          onLogout();
          return;
        }

        if (!response.ok) {
          throw new Error(payload.message || "Unable to load gateway data.");
        }

        if (!ignore) {
          setGatewayState(payload);
          setError("");
          setStatus("ready");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message === "Failed to fetch" ? "Backend API is not reachable. Start the backend server and refresh." : err.message);
          setStatus("error");
        }
      }
    }

    loadGatewayState();
    const refreshTimer = window.setInterval(loadGatewayState, 10000);

    return () => {
      ignore = true;
      window.clearInterval(refreshTimer);
    };
  }, [token, onLogout, refreshKey]);

  async function postProtected(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Request failed");
    setRefreshKey((key) => key + 1);
    return payload;
  }

  async function deleteProtected(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "Request failed");
    }
    setRefreshKey((key) => key + 1);
  }

  async function handleCreateService(values) {
    await postProtected("/services", values);
    setModal(null);
  }

  async function handleCreateRoute(values) {
    await postProtected("/routes", values);
    setModal(null);
  }

  async function handleCreateApiKey(values) {
    const payload = await postProtected("/api-keys", values);
    if (payload.apiKey?.id && payload.secret) {
      setApiKeySecrets((items) => ({ ...items, [payload.apiKey.id]: payload.secret }));
    }
    setNewApiKey(payload);
    setModal(null);
  }

  async function handleDeleteApiKey(id) {
    await deleteProtected(`/api-keys/${id}`);
  }

  async function handleCreateRateLimit(values) {
    await postProtected("/rate-limits", values);
    setModal(null);
  }

  async function handleDeleteRateLimit(id) {
    await deleteProtected(`/rate-limits/${id}`);
  }

  async function handleCreateCacheRule(values) {
    await postProtected("/cache-rules", values);
    setModal(null);
  }

  async function handleDeleteCacheRule(id) {
    await deleteProtected(`/cache-rules/${id}`);
  }

  const pageTitle = tabs.find((tab) => tab.id === activeTab)?.label || "Dashboard";
  const serviceById = useMemo(() => Object.fromEntries((gatewayState?.services || []).map((service) => [service.id, service])), [gatewayState]);
  const capabilities = gatewayState?.capabilities || {};

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <Sidebar activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setMobileNavOpen(false); }} isOpen={mobileNavOpen} modeLabel="Real Gateway" footerText="Config-backed runtime" />
      {mobileNavOpen && <button className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="min-h-dvh lg:pl-64">
        <Header title={pageTitle} onMenu={() => setMobileNavOpen(true)} adminEmail={claims?.email} onLogout={onLogout} environmentLabel="Real" />
        <div className="p-4 pb-24 sm:p-6 lg:p-8">
          {status === "loading" && <LoadingPanel />}
          {status === "error" && <ErrorPanel message={error} />}
          {gatewayState && (
            <>
              {activeTab === "dashboard" && (
                <Dashboard
                  avgResponse={gatewayState.metrics.avgResponse}
                  totalRequests={gatewayState.metrics.totalRequests}
                  successRate={gatewayState.metrics.successRate}
                  errorRate={gatewayState.metrics.errorRate}
                  services={gatewayState.services}
                  recentRequests={gatewayState.recentRequests}
                  routes={gatewayState.routes}
                  trafficSeries={gatewayState.trafficSeries}
                  isReal
                />
              )}
              {activeTab === "services" && <Services services={gatewayState.services} onAddService={capabilities.services?.create ? () => setModal("service") : null} />}
              {activeTab === "routes" && <Routes routes={gatewayState.routes} serviceById={serviceById} onAddRoute={capabilities.routes?.create ? () => setModal("route") : null} />}
              {activeTab === "auth" && (
                <Authentication
                  methods={gatewayState.authMethods}
                  keys={gatewayState.apiKeys}
                  keySecrets={apiKeySecrets}
                  onGenerateKey={capabilities.apiKeys?.create ? () => setModal("api-key") : null}
                  onDeleteKey={capabilities.apiKeys?.delete ? handleDeleteApiKey : null}
                />
              )}
              {activeTab === "rate-limits" && (
                <RateLimits
                  limits={gatewayState.rateLimits}
                  routes={gatewayState.routes.filter((route) => route.kind !== "system")}
                  onAddLimit={capabilities.rateLimits?.create ? () => setModal("rate-limit") : null}
                  onDeleteLimit={capabilities.rateLimits?.delete ? handleDeleteRateLimit : null}
                />
              )}
              {activeTab === "cache" && (
                <Cache
                  rules={gatewayState.cacheRules}
                  metrics={gatewayState.metrics}
                  routes={gatewayState.routes.filter((route) => route.kind !== "system" && route.methods.includes("GET"))}
                  onAddRule={capabilities.cacheRules?.create ? () => setModal("cache-rule") : null}
                  onDeleteRule={capabilities.cacheRules?.delete ? handleDeleteCacheRule : null}
                />
              )}
              {activeTab === "logs" && <Logs logs={gatewayState.logs} />}
            </>
          )}
        </div>
      </main>

      {modal === "service" && (
        <ServiceModal onClose={() => setModal(null)} onSubmit={handleCreateService} />
      )}
      {modal === "route" && (
        <RouteModal
          services={(gatewayState?.services || []).filter((service) => service.kind !== "system")}
          onClose={() => setModal(null)}
          onSubmit={handleCreateRoute}
        />
      )}
      {modal === "api-key" && (
        <ApiKeyModal onClose={() => setModal(null)} onSubmit={handleCreateApiKey} />
      )}
      {modal === "rate-limit" && (
        <RateLimitModal
          routes={(gatewayState?.routes || []).filter((route) => route.kind !== "system")}
          onClose={() => setModal(null)}
          onSubmit={handleCreateRateLimit}
        />
      )}
      {modal === "cache-rule" && (
        <CacheRuleModal
          routes={(gatewayState?.routes || []).filter((route) => route.kind !== "system" && route.methods.includes("GET"))}
          onClose={() => setModal(null)}
          onSubmit={handleCreateCacheRule}
        />
      )}
      {newApiKey && (
        <ApiKeySecretModal apiKey={newApiKey.apiKey} secret={newApiKey.secret} onClose={() => setNewApiKey(null)} />
      )}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="glass-panel rounded-lg p-8 text-sm text-slate-300">
      Loading real gateway data...
    </div>
  );
}

function ErrorPanel({ message }) {
  return (
    <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 p-5 text-sm text-rose-100" role="alert">
      {message}
    </div>
  );
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function buildGatewayUrl(path) {
  const fallbackApiBase = typeof window !== "undefined" ? `${window.location.origin}/api` : "/api";
  const apiBase = (API_BASE_URL || fallbackApiBase).replace(/\/+$/, "");
  const gatewayBase = apiBase.replace(/\/api$/i, "");
  return `${gatewayBase}/gateway${path}`;
}

function GatewayDemoApp() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [services, setServices] = useState(initialServices);
  const [routes, setRoutes] = useState(initialRoutes);
  const [recentRequests, setRecentRequests] = useState([]);
  const [logs, setLogs] = useState(seedLogs);
  const [requestCount, setRequestCount] = useState(0);
  const [avgResponse, setAvgResponse] = useState(45);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const serviceById = useMemo(() => Object.fromEntries(services.map((service) => [service.id, service])), [services]);
  const totalRequests = 2847293 + requestCount;

  useEffect(() => {
    const responseTimer = window.setInterval(() => {
      const variation = Math.sin(Date.now() / 10000) * 10 + Math.random() * 5;
      setAvgResponse(Math.round(45 + variation));
    }, 2000);

    const trafficTimer = window.setInterval(() => {
      if (Math.random() <= 0.7) return;
      const request = {
        method: methods[Math.floor(Math.random() * methods.length)],
        path: paths[Math.floor(Math.random() * paths.length)],
      };
      const response = makeResponse(request);
      const route = findRoute(request.path, routes);

      setRequestCount((count) => count + 1);
      setRecentRequests((requests) => [{ ...request, ...response, id: createId("request") }, ...requests].slice(0, 10));
      setLogs((items) => [
        makeLog(response.status >= 400 ? "ERROR" : "INFO", route ? serviceById[route.service]?.name || "Gateway" : "Gateway", response.status >= 400 ? "Request failed" : `Request completed in ${response.duration}ms`),
        ...items,
      ].slice(0, 80));

      if (!route) return;

      setRoutes((items) => items.map((item) => (item.id === route.id ? { ...item, requests: item.requests + 1, avgLatency: Math.round((item.avgLatency * 0.9) + (response.duration * 0.1)) } : item)));
      setServices((items) => items.map((item) => (item.id === route.service ? { ...item, requests: item.requests + 1, latency: Math.round((item.latency * 0.9) + (response.duration * 0.1)), errors: item.errors + (response.status >= 400 ? 1 : 0) } : item)));
    }, 1500);

    return () => {
      window.clearInterval(responseTimer);
      window.clearInterval(trafficTimer);
    };
  }, [routes, serviceById]);

  const pageTitle = tabs.find((tab) => tab.id === activeTab)?.label || "Dashboard";

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <Sidebar activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setMobileNavOpen(false); }} isOpen={mobileNavOpen} modeLabel="Demo Gateway" footerText="Demo runtime simulation" />
      {mobileNavOpen && <button className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="min-h-dvh lg:pl-64">
        <Header title={pageTitle} onMenu={() => setMobileNavOpen(true)} environmentLabel="Demo" />
        <div className="p-4 sm:p-6 lg:p-8">
          {activeTab === "dashboard" && (
            <Dashboard
              avgResponse={avgResponse}
              totalRequests={totalRequests}
              services={services}
              recentRequests={recentRequests}
              routes={routes}
            />
          )}
          {activeTab === "services" && <Services services={services} />}
          {activeTab === "routes" && <Routes routes={routes} serviceById={serviceById} />}
          {activeTab === "auth" && <Authentication />}
          {activeTab === "rate-limits" && <RateLimits limits={demoRateLimits} />}
          {activeTab === "cache" && <Cache rules={demoCacheRules} metrics={demoCacheMetrics} demo />}
          {activeTab === "logs" && <Logs logs={logs} />}
        </div>
      </main>
    </div>
  );
}

function Sidebar({ activeTab, onChange, isOpen, modeLabel = "Enterprise Edition", footerText = "Gateway Online" }) {
  return (
    <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="p-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan">
            <Shield className="h-5 w-5 text-slate-950" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold">API Gateway</h1>
            <p className="text-xs text-slate-400">{modeLabel}</p>
          </div>
        </div>

        <nav className="space-y-2" aria-label="Primary navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-medium transition focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 ${
                  selected ? "border border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-800 p-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-emerald" />
          <span className="text-sm text-slate-400">Gateway Online</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">{footerText}</p>
      </div>
    </aside>
  );
}

function Header({ title, onMenu, adminEmail = "Admin", onLogout, environmentLabel = "Demo", onNotifications, notificationsCount = 0 }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="icon-button lg:hidden" onClick={onMenu} aria-label="Open navigation">
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="truncate text-xl font-semibold">{title}</h2>
          <span className="hidden rounded-full border border-accent-emerald/20 bg-accent-emerald/10 px-3 py-1 text-xs font-medium text-accent-emerald sm:inline-flex">
            {environmentLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {onNotifications && (
            <button type="button" className="icon-button relative" onClick={onNotifications} aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden="true" />
              {notificationsCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-rose" />}
            </button>
          )}
          <div className="hidden min-h-11 items-center gap-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium sm:flex">
            <span className="h-8 w-8 rounded-full bg-accent-purple" />
            <span className="max-w-48 truncate">{adminEmail || "Admin"}</span>
          </div>
          {onLogout && (
            <button type="button" className="icon-button" onClick={onLogout} aria-label="Logout">
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Dashboard({ avgResponse, totalRequests, successRate = 99.97, errorRate = 0.03, services, recentRequests, routes, trafficSeries, isReal = false }) {
  const labels = isReal
    ? ["Runtime total", "Measured server-side", "From status codes", "From live requests"]
    : ["+12.5%", "-8.2%", "Protected traffic", "Live backend"];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} iconClass="bg-accent-cyan/10 text-accent-cyan" label="Total Requests" value={totalRequests.toLocaleString()} trend={labels[0]} trendIcon={isReal ? null : TrendingUp} trendClass={isReal ? "text-slate-400" : "text-accent-emerald"} />
        <MetricCard icon={Zap} iconClass="bg-accent-purple/10 text-accent-purple" label="Avg Response Time" value={`${avgResponse}ms`} trend={labels[1]} trendIcon={isReal ? null : TrendingDown} trendClass={isReal ? "text-slate-400" : "text-accent-emerald"} />
        <MetricCard icon={CheckCircle} iconClass="bg-accent-emerald/10 text-accent-emerald" label="Success Rate" value={`${successRate}%`} trend={labels[2]} trendClass="text-slate-400" />
        <MetricCard icon={AlertTriangle} iconClass="bg-accent-rose/10 text-accent-rose" label="Error Rate" value={`${errorRate}%`} trend={labels[3]} trendIcon={isReal ? null : TrendingUp} trendClass={isReal ? "text-slate-400" : "text-accent-rose"} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <TrafficChart series={trafficSeries} />
        <ServiceHealth services={services} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentRequests requests={recentRequests} />
        <TopRoutes routes={routes} />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, iconClass, label, value, trend, trendIcon: TrendIcon, trendClass }) {
  return (
    <article className="glass-panel rounded-lg p-5 transition hover:-translate-y-0.5 hover:border-accent-cyan/30">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-lg p-3 ${iconClass}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className={`flex items-center gap-1 text-xs ${trendClass}`}>
          {TrendIcon && <TrendIcon className="h-3 w-3" aria-hidden="true" />}
          {trend}
        </span>
      </div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </article>
  );
}

function TrafficChart({ series }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const labels = series?.length ? series.map((point) => point.label) : Array.from({ length: 24 }, (_, index) => `${index}:00`);
    const data = series?.length ? series.map((point) => point.requests) : labels.map(() => Math.floor(Math.random() * 50000) + 30000);
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Requests",
          data,
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
        }],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(51, 65, 85, 0.3)" }, ticks: { color: "#94a3b8", maxTicksLimit: 8 } },
          y: { grid: { color: "rgba(51, 65, 85, 0.3)" }, ticks: { color: "#94a3b8" } },
        },
        interaction: { intersect: false, mode: "index" },
      },
    });

    return () => chart.destroy();
  }, [series]);

  return (
    <section className="glass-panel rounded-lg p-5 xl:col-span-2">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Traffic Overview</h3>
          <p className="text-sm text-slate-400">Real-time request volume</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
          24H
        </div>
      </div>
      <div className="h-64">
        <canvas ref={canvasRef} aria-label="Traffic overview line chart" />
      </div>
    </section>
  );
}

function ServiceHealth({ services }) {
  return (
    <section className="glass-panel rounded-lg p-5">
      <h3 className="mb-6 font-semibold">Service Health</h3>
      <div className="space-y-4">
        {services.slice(0, 5).map((service) => {
          const total = Math.max(service.requests || 0, 1);
          const errorPercent = ((service.errors || 0) / total) * 100;
          const healthPercent = service.healthScore ?? Math.max(70, Math.min(99.9, 100 - errorPercent));
          const barClass = service.health === "healthy" ? "bg-accent-emerald" : service.health === "warning" ? "bg-yellow-400" : "bg-accent-rose";
          return (
            <div key={service.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate text-sm">{service.name}</span>
                <span className={`text-sm ${healthPercent > 95 ? "text-accent-emerald" : "text-yellow-400"}`}>{healthPercent.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${healthPercent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentRequests({ requests }) {
  return (
    <section className="glass-panel rounded-lg p-5">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold">Recent Requests</h3>
      </div>
      <div className="space-y-3">
        {!requests.length && <EmptyState title="No requests yet" text="Requests will appear here after the backend handles traffic." />}
        {requests.map((request) => (
          <div key={request.id} className="animate-slide-in rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`w-12 shrink-0 font-mono text-xs ${methodClass(request.method)}`}>{request.method}</span>
                <span className="truncate text-sm text-slate-300">{request.path}</span>
                {request.cached && <span className="rounded bg-accent-purple/20 px-2 py-0.5 text-xs text-accent-purple">CACHE</span>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className={`font-mono text-xs ${request.status < 300 ? "text-accent-emerald" : "text-accent-rose"}`}>{request.status}</span>
                <span className="text-xs text-slate-500">{request.duration ? `${request.duration}ms` : "-"}</span>
                <span className="text-xs text-slate-500">{request.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopRoutes({ routes }) {
  const sortedRoutes = [...routes].sort((a, b) => b.requests - a.requests).slice(0, 5);
  const maxRequests = sortedRoutes[0]?.requests || 1;
  return (
    <section className="glass-panel rounded-lg p-5">
      <h3 className="mb-6 font-semibold">Top Routes</h3>
      <div className="space-y-4">
        {!sortedRoutes.length && <EmptyState title="No routes registered" text="Backend routes will appear after they are added to the server." />}
        {sortedRoutes.map((route, index) => {
          const percent = (route.requests / maxRequests) * 100;
          const colors = routeRankClasses[index] || routeRankClasses[routeRankClasses.length - 1];
          return (
            <div key={route.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colors.soft} ${colors.text}`}>
                    {index + 1}
                  </span>
                  <code className="truncate text-sm text-slate-300">{route.path}</code>
                </div>
                <span className="shrink-0 text-sm text-slate-400">{route.requests.toLocaleString()}</span>
              </div>
              <div className="ml-9 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full transition-all duration-500 ${colors.bg}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Services({ services, onAddService }) {
  const [query, setQuery] = useState("");
  const filteredServices = useMemo(() => services.filter((service) => {
    const text = `${service.name} ${service.url} ${service.health}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [services, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {onAddService ? (
          <div className="flex flex-wrap gap-3">
            <PrimaryButton icon={Plus} onClick={onAddService}>Add Service</PrimaryButton>
          </div>
        ) : <div />}
        <label className="sr-only" htmlFor="service-search">Search services</label>
        <input id="service-search" type="search" placeholder="Search services..." className="control-input w-full lg:w-72" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {!services.length && <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No services registered" text="Add a backend service before creating gateway routes." /></div>}
        {!!services.length && !filteredServices.length && <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No services match" text="Try a different service name, URL, or status." /></div>}
        {filteredServices.map((service) => {
          const health = healthClasses(service.health);
          return (
            <article key={service.id} className="glass-panel rounded-lg p-5 transition hover:border-accent-cyan/30">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="rounded-lg bg-slate-800 p-3 text-accent-cyan">
                  <Server className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${health.bg} ${health.text}`}>
                  {service.health}
                </span>
              </div>
              <h4 className="font-semibold">{service.name}</h4>
              <p className="mt-1 break-all text-sm text-slate-400">{service.url}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                <Stat label="Requests" value={service.requests.toLocaleString()} />
                <Stat label="Latency" value={`${Math.round(service.latency)}ms`} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Routes({ routes, serviceById, onAddRoute }) {
  return (
    <section className="glass-panel overflow-hidden rounded-lg">
      <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">Route Configuration</h3>
        {onAddRoute && <PrimaryButton onClick={onAddRoute}>New Route</PrimaryButton>}
      </div>
      {!routes.length && <div className="p-5"><EmptyState title="No routes configured" text="Create a gateway route after adding an upstream service." /></div>}
      {!!routes.length && (
        <div className="space-y-3 p-4 md:hidden">
          {routes.map((route) => (
            <article key={route.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <code className="break-all text-sm text-accent-cyan">{route.path}</code>
                <RouteStatus status={route.status} />
              </div>
              <div className="space-y-3 text-sm">
                <RouteGatewayUrl path={route.path} />
                <div>
                  <p className="text-xs text-slate-500">Service</p>
                  <p className="mt-1 text-slate-300">{serviceById[route.service]?.name || route.service}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Methods</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {route.methods.map((method) => <span key={method} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{method}</span>)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                  <Stat label="Latency" value={`${route.avgLatency}ms`} />
                  <Stat label="Requests" value={route.requests.toLocaleString()} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!!routes.length && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[840px]">
          <thead className="bg-slate-900/50">
            <tr>
              {["Route", "Gateway URL", "Service", "Methods", "Status", "Latency"].map((heading) => (
                <th key={heading} className="px-5 py-4 text-left text-sm font-medium text-slate-400">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {routes.map((route) => (
              <tr key={route.id} className="transition hover:bg-slate-800/50">
                <td className="px-5 py-4"><code className="text-sm text-accent-cyan">{route.path}</code></td>
                <td className="px-5 py-4"><RouteGatewayUrl path={route.path} compact /></td>
                <td className="px-5 py-4 text-sm">{serviceById[route.service]?.name || route.service}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {route.methods.map((method) => <span key={method} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{method}</span>)}
                  </div>
                </td>
                <td className="px-5 py-4"><RouteStatus status={route.status} /></td>
                <td className="px-5 py-4 text-sm">{route.avgLatency}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}

function RouteGatewayUrl({ path, compact = false }) {
  const [copied, setCopied] = useState(false);
  const url = buildGatewayUrl(path);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={compact ? "max-w-xs" : ""}>
      {!compact && <p className="text-xs text-slate-500">Gateway URL</p>}
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <code className="min-w-0 truncate rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">{url}</code>
        <button type="button" className="icon-button min-h-9 min-w-9 shrink-0" onClick={handleCopy} aria-label={`Copy ${url}`}>
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {copied && <p className="mt-1 text-xs text-accent-emerald">Copied</p>}
    </div>
  );
}

function RouteStatus({ status = "active" }) {
  const active = status === "active";
  return (
    <span className={`inline-flex items-center gap-2 text-sm capitalize ${active ? "text-accent-emerald" : "text-yellow-400"}`}>
      <span className={`h-2 w-2 rounded-full ${active ? "bg-accent-emerald" : "bg-yellow-400"}`} />
      {status}
    </span>
  );
}

function Authentication({ methods = authMethods, keys = apiKeys, keySecrets = {}, onGenerateKey, onDeleteKey }) {
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  async function handleCopyKey(item) {
    const value = keySecrets[item.id] || item.key;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKeyId(item.id || item.key);
      window.setTimeout(() => setCopiedKeyId(null), 1400);
    } catch {
      setCopiedKeyId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="glass-panel rounded-lg p-5">
        <h3 className="mb-6 font-semibold">Authentication Methods</h3>
        <div className="space-y-4">
          {methods.map((method) => {
            const Icon = method.type === "jwt" ? KeyRound : method.type === "apikey" ? Key : Globe;
            return (
              <div key={method.type} className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`rounded-lg p-2 ${method.enabled ? "bg-accent-cyan/10 text-accent-cyan" : "bg-slate-800 text-slate-500"}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{method.name}</p>
                    <p className="text-sm text-slate-400">{method.enabled ? method.config : "Disabled"}</p>
                  </div>
                </div>
                <Toggle checked={method.enabled} disabled />
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel rounded-lg p-5">
        <h3 className="mb-6 font-semibold">API Keys</h3>
        <div className="space-y-4">
          {!keys.length && <EmptyState title="No API keys configured" text="Generate a key to let clients call protected gateway routes with X-API-Key." />}
          {keys.map((item) => (
            <div key={item.id || item.key} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-slate-500">{item.lastUsed}</span>
              </div>
              <code className="break-all text-sm text-accent-cyan">{item.key}</code>
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                <div>
                  <span className="text-xs text-slate-400">{item.requests.toLocaleString()} requests</span>
                  {copiedKeyId === (item.id || item.key) && <p className="mt-1 text-xs text-accent-emerald">Copied</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="icon-button min-h-9 min-w-9" onClick={() => handleCopyKey(item)} aria-label={`Copy ${item.name}`}>
                    <Copy className="h-4 w-4" />
                  </button>
                  {onDeleteKey && (
                    <button type="button" className="icon-button min-h-9 min-w-9 hover:text-accent-rose" onClick={() => onDeleteKey(item.id)} aria-label={`Delete ${item.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {onGenerateKey && (
          <button type="button" onClick={onGenerateKey} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 px-4 py-3 text-slate-400 transition hover:border-accent-cyan hover:text-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/50">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Generate New API Key
          </button>
        )}
      </section>
    </div>
  );
}

function RateLimits({ limits = [], routes = [], onAddLimit, onDeleteLimit }) {
  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Route Rate Limits</h3>
            <p className="mt-1 text-sm text-slate-400">Throttle gateway traffic per route and client.</p>
          </div>
          {onAddLimit && <PrimaryButton icon={Plus} onClick={onAddLimit}>Add Rule</PrimaryButton>}
        </div>
        <div className="divide-y divide-slate-800">
          {!limits.length && (
            <div className="p-5">
              <EmptyState
                title="No rate limits configured"
                text={routes.length ? "Add a rule to throttle one of your gateway routes." : "Create a gateway route before adding rate limits."}
              />
            </div>
          )}
          {limits.map((limit) => {
            const maxRequests = limit.maxRequests || limit.rpm || 1;
            const windowSeconds = limit.windowSeconds || 60;
            const percent = (limit.current / maxRequests) * 100;
            const high = percent > 80;
            return (
              <div key={limit.id || limit.name} className="flex flex-col gap-4 p-5 transition hover:bg-slate-800/30 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium">{limit.name}</h4>
                  <p className="mt-1 break-all text-sm text-slate-400">{limit.path || "All routes"}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {maxRequests.toLocaleString()} requests per {formatWindow(windowSeconds)}
                  </p>
                </div>
                <div className="w-full lg:w-64">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Usage</span>
                    <span className={high ? "text-accent-rose" : "text-accent-emerald"}>{limit.current.toLocaleString()} / {maxRequests.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${high ? "bg-accent-rose" : "bg-accent-cyan"}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                </div>
                {onDeleteLimit && (
                  <button type="button" className="icon-button hover:text-accent-rose" onClick={() => onDeleteLimit(limit.id)} aria-label={`Delete ${limit.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Cache({ rules = [], metrics = {}, routes = [], onAddRule, onDeleteRule }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard icon={HardDrive} iconClass="bg-accent-purple/10 text-accent-purple" label="Cache Size" value={metrics.cacheSize ?? "0 B"} trend="Live cache memory" trendClass="text-slate-500" />
        <MetricCard icon={Percent} iconClass="bg-accent-cyan/10 text-accent-cyan" label="Hit Rate" value={`${metrics.cacheHitRate ?? 0}%`} trend="Hits vs misses" trendClass="text-slate-500" />
        <MetricCard icon={Clock} iconClass="bg-accent-emerald/10 text-accent-emerald" label="Avg TTL" value={metrics.avgTtl ?? "0s"} trend="Active entries" trendClass="text-slate-500" />
      </div>

      <section className="glass-panel rounded-lg p-5">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Cache Rules</h3>
            <p className="mt-1 text-sm text-slate-400">Real rules from the backend config. Only GET gateway routes can be cached.</p>
          </div>
          {onAddRule && <PrimaryButton icon={Plus} onClick={onAddRule}>Add Rule</PrimaryButton>}
        </div>

        <div className="space-y-4">
          {!rules.length && (
            <EmptyState
              title="No cache rules configured"
              text={routes.length ? "Add a cache rule to start caching GET route responses." : "Create a GET gateway route before adding cache rules."}
            />
          )}

          {rules.map((rule) => {
            const ttl = rule.ttlSeconds ?? rule.ttl ?? 0;
            const enabled = rule.status !== "disabled" && ttl > 0;
            const key = rule.id || rule.path;

            return (
              <div key={key} className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className={`rounded-lg p-2 ${enabled ? "bg-accent-cyan/10 text-accent-cyan" : "bg-accent-rose/10 text-accent-rose"}`}>
                    {enabled ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium">{rule.name || "Cache rule"}</p>
                    <code className="mt-1 block break-all text-sm text-accent-cyan">{rule.path}</code>
                    <p className="mt-1 text-xs text-slate-400">
                      TTL: {ttl}s · Type: {rule.type || "public"} · Entries: {rule.entries ?? 0} · Size: {rule.size ?? "0 B"}
                    </p>
                  </div>
                </div>

                {onDeleteRule && rule.id && (
                  <button type="button" className="icon-button hover:text-accent-rose" onClick={() => onDeleteRule(rule.id)} aria-label={`Delete ${rule.name || rule.path}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Logs({ logs = [], onExport }) {
  const [level, setLevel] = useState("All Levels");
  const [service, setService] = useState("All Services");
  const [query, setQuery] = useState("");
  const levels = useMemo(() => ["All Levels", ...Array.from(new Set(logs.map((log) => log.level))).sort()], [logs]);
  const services = useMemo(() => ["All Services", ...Array.from(new Set(logs.map((log) => log.service))).sort()], [logs]);
  const visibleLogs = useMemo(() => logs.filter((log) => {
    const matchesLevel = level === "All Levels" || log.level === level;
    const matchesService = service === "All Services" || log.service === service;
    const text = `${log.time} ${log.level} ${log.service} ${log.message}`.toLowerCase();
    return matchesLevel && matchesService && text.includes(query.toLowerCase());
  }).slice(0, 50), [logs, level, service, query]);

  return (
    <section className="glass-panel overflow-hidden rounded-lg">
      <div className="flex flex-col gap-3 border-b border-slate-800 p-4 xl:flex-row xl:items-center">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[160px_180px_1fr]">
          <select className="control-input" aria-label="Log level" value={level} onChange={(event) => setLevel(event.target.value)}>
            {levels.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="control-input" aria-label="Service" value={service} onChange={(event) => setService(event.target.value)}>
            {services.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input type="search" placeholder="Search logs..." className="control-input" aria-label="Search logs" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {onExport && <SecondaryButton icon={Download} onClick={onExport}>Export</SecondaryButton>}
      </div>
      <div className="bg-slate-950 p-4 font-mono text-sm">
        {!visibleLogs.length && <div className="rounded px-2 py-2 text-xs text-slate-500">No logs recorded yet.</div>}
        <div className="space-y-2 md:hidden">
          {visibleLogs.map((log) => (
            <article key={log.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className={`font-bold ${logLevelClass(log.level)}`}>{log.level}</span>
                <span className="text-slate-500">{log.time}</span>
              </div>
              <p className="text-accent-purple">{log.service}</p>
              <p className="mt-2 break-words text-slate-300">{log.message}</p>
            </article>
          ))}
        </div>
        <div className="hidden min-w-0 space-y-1 md:block">
          {visibleLogs.map((log) => (
            <div key={log.id} className="grid grid-cols-[88px_64px_128px_minmax(0,1fr)] gap-4 rounded px-2 py-2 text-xs transition hover:bg-slate-900/60">
              <span className="text-slate-500">{log.time}</span>
              <span className={`font-bold ${logLevelClass(log.level)}`}>{log.level}</span>
              <span className="truncate text-accent-purple">{log.service}</span>
              <span className="break-words text-slate-300">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <section className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function ServiceModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await onSubmit({ name, url, timeoutMs });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <ModalShell title="Add Service" onClose={onClose}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Service name</span>
          <input className="control-input w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="Users API" required />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Base URL</span>
          <input className="control-input w-full" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://localhost:3001" required />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Timeout ms</span>
          <input className="control-input w-full" type="number" min="1000" value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))} />
        </label>
        {error && <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={status === "loading"}>{status === "loading" ? "Saving..." : "Save service"}</PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}

function RouteModal({ services, onClose, onSubmit }) {
  const [path, setPath] = useState("/users/*");
  const [service, setService] = useState(services[0]?.id || "");
  const [methods, setMethods] = useState(["GET"]);
  const [auth, setAuth] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function toggleMethod(method) {
    setMethods((items) => items.includes(method) ? items.filter((item) => item !== method) : [...items, method]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await onSubmit({ path, service, methods, auth });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <ModalShell title="New Route" onClose={onClose}>
      {!services.length ? (
        <EmptyState title="Add a service first" text="A route needs an upstream service before it can forward traffic." />
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Gateway path</span>
            <input className="control-input w-full" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/users/*" required />
            <p className="mt-2 text-xs text-slate-500">Requests hit `/gateway/users/...`; `*` becomes the forwarded upstream path.</p>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Upstream service</span>
            <select className="control-input w-full" value={service} onChange={(event) => setService(event.target.value)} required>
              {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">Allowed methods</legend>
            <div className="flex flex-wrap gap-2">
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                <label key={method} className={`flex min-h-10 cursor-pointer items-center rounded-lg border px-3 text-sm ${methods.includes(method) ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan" : "border-slate-700 text-slate-400"}`}>
                  <input type="checkbox" checked={methods.includes(method)} onChange={() => toggleMethod(method)} className="sr-only" />
                  {method}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <input type="checkbox" checked={auth} onChange={(event) => setAuth(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
            <span className="text-sm text-slate-300">Require auth for this gateway route</span>
          </label>
          {error && <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton disabled={status === "loading" || !methods.length}>{status === "loading" ? "Saving..." : "Save route"}</PrimaryButton>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function RateLimitModal({ routes, onClose, onSubmit }) {
  const [routeId, setRouteId] = useState(routes[0]?.id || "");
  const [name, setName] = useState(routes[0] ? `${routes[0].path} limit` : "");
  const [maxRequests, setMaxRequests] = useState(5);
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function handleRouteChange(nextRouteId) {
    setRouteId(nextRouteId);
    const route = routes.find((item) => item.id === nextRouteId);
    if (route) setName(`${route.path} limit`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await onSubmit({ routeId, name, maxRequests, windowSeconds });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <ModalShell title="Add Rate Limit" onClose={onClose}>
      {!routes.length ? (
        <EmptyState title="Create a route first" text="Rate limits attach to gateway routes, so add a route before creating a rule." />
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Gateway route</span>
            <select className="control-input w-full" value={routeId} onChange={(event) => handleRouteChange(event.target.value)} required>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.path}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Rule name</span>
            <input className="control-input w-full" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Max requests</span>
              <input className="control-input w-full" type="number" min="1" value={maxRequests} onChange={(event) => setMaxRequests(Number(event.target.value))} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Window seconds</span>
              <input className="control-input w-full" type="number" min="1" value={windowSeconds} onChange={(event) => setWindowSeconds(Number(event.target.value))} required />
            </label>
          </div>
          <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
            Example: 5 requests per 60 seconds returns 429 after the sixth request from the same client.
          </p>
          {error && <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton disabled={status === "loading"}>{status === "loading" ? "Saving..." : "Save rule"}</PrimaryButton>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function CacheRuleModal({ routes, onClose, onSubmit }) {
  const [routeId, setRouteId] = useState(routes[0]?.id || "");
  const [name, setName] = useState(routes[0] ? `${routes[0].path} cache` : "");
  const [ttlSeconds, setTtlSeconds] = useState(300);
  const [type, setType] = useState("public");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function handleRouteChange(nextRouteId) {
    setRouteId(nextRouteId);
    const route = routes.find((item) => item.id === nextRouteId);
    if (route) setName(`${route.path} cache`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await onSubmit({ routeId, name, ttlSeconds, type });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <ModalShell title="Add Cache Rule" onClose={onClose}>
      {!routes.length ? (
        <EmptyState title="Create a GET route first" text="Cache rules only attach to GET gateway routes." />
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">GET route</span>
            <select className="control-input w-full" value={routeId} onChange={(event) => handleRouteChange(event.target.value)} required>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.path}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Rule name</span>
            <input className="control-input w-full" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">TTL seconds</span>
              <input className="control-input w-full" type="number" min="1" value={ttlSeconds} onChange={(event) => setTtlSeconds(Number(event.target.value))} required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Cache type</span>
              <select className="control-input w-full" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </label>
          </div>

          <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
            Cached responses only count after a matching request passes through /gateway. Until then, entries and size can stay at 0.
          </p>

          {error && <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton disabled={status === "loading"}>{status === "loading" ? "Saving..." : "Save rule"}</PrimaryButton>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function ApiKeyModal({ onClose, onSubmit }) {
  const [name, setName] = useState("Portfolio Demo Key");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await onSubmit({ name });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <ModalShell title="Generate API Key" onClose={onClose}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Key name</span>
          <input className="control-input w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="Production Client Key" required />
        </label>
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
          The full key is shown once after creation. After that, only the masked key is stored and displayed.
        </p>
        {error && <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={status === "loading"}>{status === "loading" ? "Generating..." : "Generate key"}</PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}

function ApiKeySecretModal({ apiKey, secret, onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ModalShell title="API Key Created" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-slate-400">Save this key now. You will not be able to view the full value again.</p>
          <p className="mt-2 text-sm font-medium text-slate-200">{apiKey?.name}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <code className="block break-all text-sm text-accent-cyan">{secret}</code>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
          Use it on protected gateway routes with the header <code className="text-slate-200">X-API-Key</code>.
        </div>
        <div className="flex justify-end gap-3">
          <SecondaryButton icon={Copy} onClick={handleCopy}>{copied ? "Copied" : "Copy key"}</SecondaryButton>
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

function PrimaryButton({ children, icon: Icon, onClick, disabled = false }) {
  return (
    <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

function SecondaryButton({ children, icon: Icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50">
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function Toggle({ checked, disabled = false }) {
  return (
    <label className="relative inline-flex min-h-11 min-w-11 items-center justify-center">
      <span className="sr-only">Toggle setting</span>
      <input type="checkbox" defaultChecked={checked} disabled={disabled} className="peer sr-only" />
      <span className="relative block h-6 w-11 rounded-full bg-slate-700 transition peer-checked:bg-accent-cyan peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-cyan/50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition peer-checked:after:translate-x-full" />
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function methodClass(method) {
  if (method === "GET") return "text-accent-cyan";
  if (method === "POST") return "text-accent-emerald";
  if (method === "PUT") return "text-accent-purple";
  return "text-accent-rose";
}

function healthClasses(health) {
  if (health === "healthy") return { text: "text-accent-emerald", bg: "bg-accent-emerald/10" };
  if (health === "warning") return { text: "text-yellow-400", bg: "bg-yellow-400/10" };
  return { text: "text-accent-rose", bg: "bg-accent-rose/10" };
}

function logLevelClass(level) {
  if (level === "ERROR") return "text-accent-rose";
  if (level === "WARN") return "text-yellow-400";
  if (level === "INFO") return "text-accent-cyan";
  return "text-slate-500";
}

function formatWindow(seconds) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

function findRoute(path, routes) {
  return routes.find((route) => new RegExp(`^${route.path.replace("*", ".*")}$`).test(path));
}

function makeResponse(request) {
  const cached = request.method === "GET" && Math.random() > 0.6;
  const failed = Math.random() < 0.03;
  return {
    cached,
    duration: cached ? Math.floor(Math.random() * 12) + 6 : Math.floor(Math.random() * 120) + 20,
    status: failed ? 503 : 200,
    time: new Date().toLocaleTimeString(),
  };
}

function makeLog(level, service, message) {
  return {
    id: createId("log"),
    time: new Date().toLocaleTimeString(),
    level,
    service,
    message,
  };
}

const seedLogs = [
  makeLog("INFO", "Gateway", "Incoming traffic simulation started"),
  makeLog("DEBUG", "Cache", "Cache rules loaded"),
  makeLog("INFO", "Auth", "Authentication policies active"),
];

export default App;
