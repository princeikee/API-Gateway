import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";

dotenv.config({ path: ".env.backend" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1h";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const startedAt = Date.now();
const configPath = process.env.GATEWAY_CONFIG_PATH || path.join(process.cwd(), "data", "gateway-config.json");

const systemRoutes = [
  { id: "route-health", path: "/api/health", service: "gateway-backend", methods: ["GET"], auth: false, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-login", path: "/api/auth/login", service: "gateway-backend", methods: ["POST"], auth: false, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-me", path: "/api/auth/me", service: "gateway-backend", methods: ["GET"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-state", path: "/api/gateway/state", service: "gateway-backend", methods: ["GET"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-services", path: "/api/services", service: "gateway-backend", methods: ["GET", "POST"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-routes", path: "/api/routes", service: "gateway-backend", methods: ["GET", "POST"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-api-keys", path: "/api/api-keys", service: "gateway-backend", methods: ["GET", "POST", "DELETE"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-rate-limits", path: "/api/rate-limits", service: "gateway-backend", methods: ["GET", "POST", "DELETE"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
  { id: "route-cache-rules", path: "/api/cache-rules", service: "gateway-backend", methods: ["GET", "POST", "DELETE"], auth: true, rateLimit: false, cache: false, requests: 0, avgLatency: 0, errors: 0, status: "active", kind: "system" },
];

const authMethods = [
  { type: "jwt", name: "JWT Authentication", enabled: true, config: `HS256, ${jwtExpiresIn} expiry, secret from backend env` },
  { type: "apikey", name: "API Key", enabled: true, config: "X-API-Key header for protected gateway routes" },
];

const capabilities = {
  services: { create: true, update: false, delete: false },
  routes: { create: true, update: false, delete: false },
  apiKeys: { create: true, update: false, delete: true },
  rateLimits: { create: true, update: false, delete: true },
  cacheRules: { create: true, update: false, delete: true },
};
const logs = [];
const recentRequests = [];
const trafficByHour = new Map();
const routeRuntime = new Map(systemRoutes.map((route) => [route.id, { requests: 0, errors: 0, avgLatency: 0 }]));
const serviceRuntime = new Map();
const rateLimitBuckets = new Map();
const responseCache = new Map();
const cacheStats = { hits: 0, misses: 0 };
let gatewayConfig = { services: [], routes: [], apiKeys: [], rateLimits: [], cacheRules: [] };

await loadConfig();

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashApiKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

function generateApiKeySecret() {
  return `gw_live_${randomBytes(24).toString("base64url")}`;
}

function maskApiKey(value) {
  return `${value.slice(0, 12)}...${value.slice(-4)}`;
}

function publicApiKey(apiKey) {
  return {
    id: apiKey.id,
    key: apiKey.maskedKey,
    name: apiKey.name,
    created: apiKey.createdAt?.slice(0, 10) || "",
    createdAt: apiKey.createdAt,
    lastUsed: apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : "Never",
    lastUsedAt: apiKey.lastUsedAt || null,
    requests: apiKey.requests || 0,
  };
}

function publicRateLimit(rule) {
  const current = getRateLimitCurrentUsage(rule.id);
  return {
    id: rule.id,
    name: rule.name,
    routeId: rule.routeId,
    path: rule.path,
    rpm: rule.maxRequests,
    maxRequests: rule.maxRequests,
    windowSeconds: rule.windowSeconds,
    current,
    status: rule.status || "active",
    createdAt: rule.createdAt,
  };
}

function publicCacheRule(rule) {
  const stats = getCacheRuleStats(rule.id);
  return {
    id: rule.id,
    name: rule.name,
    routeId: rule.routeId,
    path: rule.path,
    ttl: rule.ttlSeconds,
    ttlSeconds: rule.ttlSeconds,
    type: rule.type,
    size: formatBytes(stats.sizeBytes),
    entries: stats.entries,
    status: rule.status || "active",
    createdAt: rule.createdAt,
  };
}

function createApiKey(input = {}) {
  const name = String(input.name || "Gateway API Key").trim();
  const secret = generateApiKeySecret();
  const apiKey = {
    id: createId("key"),
    name,
    prefix: secret.slice(0, 12),
    maskedKey: maskApiKey(secret),
    hash: hashApiKey(secret),
    requests: 0,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  return { apiKey, secret };
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  return `${minutes >= 10 ? Math.round(minutes) : minutes.toFixed(1)}m`;
}

function sanitizeRateLimit(input = {}) {
  const routeId = String(input.routeId || "").trim();
  const route = gatewayConfig.routes.find((item) => item.id === routeId);
  const maxRequests = Number(input.maxRequests || input.rpm || 60);
  const windowSeconds = Number(input.windowSeconds || 60);
  const name = String(input.name || `${route?.path || "Route"} limit`).trim();

  if (!route) throw new Error("Rate limit must reference an existing gateway route");
  if (!Number.isFinite(maxRequests) || maxRequests < 1) throw new Error("Max requests must be at least 1");
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1) throw new Error("Window must be at least 1 second");

  return {
    id: input.id || createId("limit"),
    name,
    routeId,
    path: route.path,
    maxRequests: Math.floor(maxRequests),
    windowSeconds: Math.floor(windowSeconds),
    status: input.status || "active",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function sanitizeCacheRule(input = {}) {
  const routeId = String(input.routeId || "").trim();
  const route = gatewayConfig.routes.find((item) => item.id === routeId);
  const ttlSeconds = Number(input.ttlSeconds || input.ttl || 300);
  const type = String(input.type || "public").trim().toLowerCase();
  const name = String(input.name || `${route?.path || "Route"} cache`).trim();

  if (!route) throw new Error("Cache rule must reference an existing gateway route");
  if (!route.methods.includes("GET")) throw new Error("Only GET routes can be cached");
  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) throw new Error("TTL must be at least 1 second");
  if (!["public", "private"].includes(type)) throw new Error("Cache type must be public or private");

  return {
    id: input.id || createId("cache"),
    name,
    routeId,
    path: route.path,
    ttlSeconds: Math.floor(ttlSeconds),
    type,
    status: input.status || "active",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function getRateLimitRule(route) {
  return gatewayConfig.rateLimits.find((rule) => rule.status === "active" && rule.routeId === route.id);
}

function getCacheRule(route) {
  return gatewayConfig.cacheRules.find((rule) => rule.status === "active" && rule.routeId === route.id);
}

function getRateLimitClient(req, authResult) {
  if (authResult?.type === "apikey") return `key:${authResult.id}`;
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `ip:${forwardedFor || req.ip || req.socket.remoteAddress || "unknown"}`;
}

function getRateLimitCurrentUsage(ruleId) {
  const now = Date.now();
  let max = 0;
  for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
      continue;
    }
    if (bucket.ruleId === ruleId) max = Math.max(max, bucket.count);
  }
  return max;
}

function checkRateLimit(route, req, authResult) {
  const rule = getRateLimitRule(route);
  if (!rule) return { allowed: true };

  const now = Date.now();
  const client = getRateLimitClient(req, authResult);
  const bucketKey = `${rule.id}:${client}`;
  const existing = rateLimitBuckets.get(bucketKey);
  const windowMs = rule.windowSeconds * 1000;
  const bucket = !existing || existing.resetAt <= now
    ? { ruleId: rule.id, count: 0, resetAt: now + windowMs }
    : existing;

  bucket.count += 1;
  rateLimitBuckets.set(bucketKey, bucket);

  if (bucket.count > rule.maxRequests) {
    return {
      allowed: false,
      rule,
      current: bucket.count,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, rule, current: bucket.count };
}

function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
}

function getCacheRuleStats(ruleId) {
  cleanupExpiredCache();
  let entries = 0;
  let sizeBytes = 0;
  for (const entry of responseCache.values()) {
    if (entry.ruleId === ruleId) {
      entries += 1;
      sizeBytes += entry.sizeBytes || 0;
    }
  }
  return { entries, sizeBytes };
}

function buildCacheMetrics() {
  cleanupExpiredCache();
  let sizeBytes = 0;
  let totalTtl = 0;
  let entries = 0;
  const now = Date.now();

  for (const entry of responseCache.values()) {
    entries += 1;
    sizeBytes += entry.sizeBytes || 0;
    totalTtl += Math.max(0, Math.ceil((entry.expiresAt - now) / 1000));
  }

  const attempts = cacheStats.hits + cacheStats.misses;
  return {
    cacheSize: formatBytes(sizeBytes),
    cacheHitRate: attempts ? Number(((cacheStats.hits / attempts) * 100).toFixed(1)) : 0,
    avgTtl: entries ? formatDuration(totalTtl / entries) : "0s",
  };
}

function makeCacheKey(rule, method, incomingPath, queryString) {
  return `${rule.id}:${method}:${incomingPath}?${queryString || ""}`;
}

function getCachedResponse(cacheKey) {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return entry;
}

function storeCachedResponse(rule, cacheKey, response) {
  responseCache.set(cacheKey, {
    ruleId: rule.id,
    status: response.status,
    headers: response.headers,
    body: response.body,
    sizeBytes: response.body.byteLength,
    createdAt: Date.now(),
    expiresAt: Date.now() + (rule.ttlSeconds * 1000),
  });
}

async function authenticateGatewayRequest(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme === "Bearer" && token) {
    try {
      jwt.verify(token, jwtSecret);
      return { type: "jwt" };
    } catch {
      // Fall through so clients can still use X-API-Key for gateway routes.
    }
  }

  const rawApiKey = req.headers["x-api-key"];
  const apiKeyValue = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
  if (!apiKeyValue) return null;

  const apiKey = gatewayConfig.apiKeys.find((item) => item.hash === hashApiKey(String(apiKeyValue)));
  if (!apiKey) return null;

  apiKey.requests = (apiKey.requests || 0) + 1;
  apiKey.lastUsedAt = new Date().toISOString();
  await saveConfig();
  return { type: "apikey", id: apiKey.id };
}

async function loadConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    gatewayConfig = {
      services: Array.isArray(parsed.services) ? parsed.services : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
      rateLimits: Array.isArray(parsed.rateLimits) ? parsed.rateLimits : [],
      cacheRules: Array.isArray(parsed.cacheRules) ? parsed.cacheRules : [],
    };
  } catch {
    gatewayConfig = { services: [], routes: [], apiKeys: [], rateLimits: [], cacheRules: [] };
    await saveConfig();
  }

  gatewayConfig.routes.forEach((route) => {
    if (!routeRuntime.has(route.id)) routeRuntime.set(route.id, { requests: 0, errors: 0, avgLatency: 0 });
  });
  gatewayConfig.services.forEach((service) => {
    if (!serviceRuntime.has(service.id)) serviceRuntime.set(service.id, { requests: 0, errors: 0, latency: 0 });
  });
}

async function saveConfig() {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(gatewayConfig, null, 2)}\n`);
}

function writeLog(level, service, message, metadata = {}) {
  const entry = {
    id: createId("log"),
    time: new Date().toLocaleTimeString(),
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...metadata,
  };
  logs.unshift(entry);
  logs.splice(80);
  return entry;
}

function allRoutes() {
  return [...systemRoutes, ...gatewayConfig.routes];
}

function findTrackedRoute(method, requestPath) {
  return allRoutes().find((route) => route.path === requestPath && route.methods.includes(method));
}

function recordRuntime(current, status, duration) {
  current.requests += 1;
  current.errors += status >= 400 ? 1 : 0;
  current.avgLatency = current.avgLatency
    ? Math.round((current.avgLatency * (current.requests - 1) + duration) / current.requests)
    : Math.round(duration);
}

function recordRequest(method, requestPath, status, duration, cached = false, routeId = null, serviceId = null) {
  const trackedRoute = routeId ? allRoutes().find((route) => route.id === routeId) : findTrackedRoute(method, requestPath);

  if (trackedRoute) {
    const runtime = routeRuntime.get(trackedRoute.id) || { requests: 0, errors: 0, avgLatency: 0 };
    recordRuntime(runtime, status, duration);
    routeRuntime.set(trackedRoute.id, runtime);
  }

  if (serviceId) {
    const runtime = serviceRuntime.get(serviceId) || { requests: 0, errors: 0, latency: 0 };
    runtime.requests += 1;
    runtime.errors += status >= 400 ? 1 : 0;
    runtime.latency = runtime.latency
      ? Math.round((runtime.latency * (runtime.requests - 1) + duration) / runtime.requests)
      : Math.round(duration);
    serviceRuntime.set(serviceId, runtime);
  }

  const hourLabel = `${new Date().getHours()}:00`;
  trafficByHour.set(hourLabel, (trafficByHour.get(hourLabel) || 0) + 1);

  recentRequests.unshift({
    id: createId("req"),
    method,
    path: requestPath,
    status,
    duration,
    cached,
    time: new Date().toLocaleTimeString(),
  });
  recentRequests.splice(12);
}

function routeWithRuntime(route) {
  const runtime = routeRuntime.get(route.id) || { requests: 0, errors: 0, avgLatency: 0 };
  return { ...route, ...runtime };
}

function buildServices() {
  const systemRequests = systemRoutes.reduce((sum, route) => sum + (routeRuntime.get(route.id)?.requests || 0), 0);
  const systemErrors = systemRoutes.reduce((sum, route) => sum + (routeRuntime.get(route.id)?.errors || 0), 0);
  const systemLatency = averageLatency(systemRoutes.map(routeWithRuntime));
  const systemService = {
    id: "gateway-backend",
    name: "Gateway Backend",
    url: `http://localhost:${port}`,
    kind: "system",
    health: systemErrors ? "warning" : "healthy",
    latency: systemLatency,
    requests: systemRequests,
    errors: systemErrors,
    lastChecked: new Date().toISOString(),
  };

  return [
    systemService,
    ...gatewayConfig.services.map((service) => {
      const runtime = serviceRuntime.get(service.id) || { requests: 0, errors: 0, latency: 0 };
      return {
        ...service,
        kind: "gateway",
        health: runtime.errors ? "warning" : "healthy",
        latency: runtime.latency,
        requests: runtime.requests,
        errors: runtime.errors,
        lastChecked: new Date().toISOString(),
      };
    }),
  ];
}

function averageLatency(routes) {
  const activeRoutes = routes.filter((route) => route.requests > 0);
  if (!activeRoutes.length) return 0;
  return Math.round(activeRoutes.reduce((sum, route) => sum + route.avgLatency, 0) / activeRoutes.length);
}

function totalRequests(routes) {
  return routes.reduce((sum, route) => sum + route.requests, 0);
}

function errorRate(routes) {
  const requests = totalRequests(routes);
  if (!requests) return 0;
  const errors = routes.reduce((sum, route) => sum + route.errors, 0);
  return Number(((errors / requests) * 100).toFixed(2));
}

function buildTrafficSeries() {
  const currentHour = new Date().getHours();
  return Array.from({ length: 24 }, (_, offset) => {
    const hour = (currentHour - 23 + offset + 24) % 24;
    const label = `${hour}:00`;
    return { label, requests: trafficByHour.get(label) || 0 };
  });
}

function buildGatewayState() {
  const routes = allRoutes().map(routeWithRuntime);
  const gatewayRoutes = gatewayConfig.routes.map(routeWithRuntime);
  const requests = totalRequests(gatewayRoutes);
  const errors = gatewayRoutes.reduce((sum, route) => sum + route.errors, 0);
  const cacheMetrics = buildCacheMetrics();

  return {
    environment: {
      mode: "real",
      configFile: path.basename(configPath),
      startedAt: new Date(startedAt).toISOString(),
    },
    capabilities,
    metrics: {
      totalRequests: requests,
      avgResponse: averageLatency(gatewayRoutes),
      successRate: requests ? Number((((requests - errors) / requests) * 100).toFixed(2)) : 100,
      errorRate: errorRate(gatewayRoutes),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      ...cacheMetrics,
    },
    services: buildServices(),
    routes,
    authMethods,
    apiKeys: gatewayConfig.apiKeys.map(publicApiKey),
    rateLimits: gatewayConfig.rateLimits.map(publicRateLimit),
    cacheRules: gatewayConfig.cacheRules.map(publicCacheRule),
    trafficSeries: buildTrafficSeries(),
    recentRequests,
    logs,
  };
}

function sanitizeService(input) {
  const name = String(input.name || "").trim();
  const url = String(input.url || "").trim().replace(/\/+$/, "");
  const timeoutMs = Number(input.timeoutMs || 10000);

  if (!name) throw new Error("Service name is required");
  if (!url || !/^https?:\/\//i.test(url)) throw new Error("Service URL must start with http:// or https://");

  return {
    id: input.id || createId("service"),
    name,
    url,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function sanitizeRoute(input) {
  const pathValue = String(input.path || "").trim();
  const service = String(input.service || input.serviceId || "").trim();
  const methods = Array.isArray(input.methods) && input.methods.length
    ? input.methods.map((method) => String(method).toUpperCase())
    : ["GET"];

  if (!pathValue.startsWith("/")) throw new Error("Route path must start with /");
  if (!pathValue.includes("*")) throw new Error("Route path must include * for the forwarded segment, for example /users/*");
  if (!service || !gatewayConfig.services.some((item) => item.id === service)) throw new Error("Route must reference an existing service");

  return {
    id: input.id || createId("route"),
    path: pathValue,
    service,
    methods: [...new Set(methods)],
    auth: Boolean(input.auth),
    rateLimit: false,
    cache: false,
    status: input.status || "active",
    kind: "gateway",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function matchGatewayRoute(method, incomingPath) {
  return gatewayConfig.routes.find((route) => {
    if (route.status !== "active" || !route.methods.includes(method)) return false;
    const [prefix] = route.path.split("*");
    return incomingPath.startsWith(prefix);
  });
}

function buildTargetUrl(route, service, incomingPath, queryString) {
  const [prefix] = route.path.split("*");
  const forwardedSegment = incomingPath.slice(prefix.length);
  const targetPath = forwardedSegment.startsWith("/") ? forwardedSegment : `/${forwardedSegment}`;
  return `${service.url}${targetPath}${queryString ? `?${queryString}` : ""}`;
}

async function proxyGatewayRequest(req, res) {
  const start = performance.now();
  const incomingPath = req.path === "/" ? "/" : req.path;
  const route = matchGatewayRoute(req.method, incomingPath);

  if (!route) {
    recordRequest(req.method, `/gateway${incomingPath}`, 404, Math.round(performance.now() - start), false);
    return res.status(404).json({ message: `No gateway route matches ${req.method} /gateway${incomingPath}` });
  }

  const service = gatewayConfig.services.find((item) => item.id === route.service);
  if (!service) {
    recordRequest(req.method, `/gateway${incomingPath}`, 502, Math.round(performance.now() - start), false, route.id);
    return res.status(502).json({ message: "Route service is not configured" });
  }

  let authResult = null;
  if (route.auth) {
    authResult = await authenticateGatewayRequest(req);
    if (!authResult) {
      recordRequest(req.method, `/gateway${incomingPath}`, 401, Math.round(performance.now() - start), false, route.id, service.id);
      return res.status(401).json({ message: "Gateway route requires a valid bearer token or X-API-Key" });
    }
  }

  const limitResult = checkRateLimit(route, req, authResult);
  if (!limitResult.allowed) {
    const duration = Math.round(performance.now() - start);
    recordRequest(req.method, `/gateway${incomingPath}`, 429, duration, false, route.id, service.id);
    res.setHeader("Retry-After", String(limitResult.retryAfter));
    writeLog("WARN", service.name, `${req.method} /gateway${incomingPath} rate limited by ${limitResult.rule.name}`);
    return res.status(429).json({
      message: "Rate limit exceeded",
      limit: limitResult.rule.maxRequests,
      windowSeconds: limitResult.rule.windowSeconds,
      retryAfter: limitResult.retryAfter,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), service.timeoutMs || 10000);
  const queryString = req.url.split("?")[1] || "";
  const targetUrl = buildTargetUrl(route, service, incomingPath, queryString);
  const cacheRule = req.method === "GET" ? getCacheRule(route) : null;
  const cacheKey = cacheRule ? makeCacheKey(cacheRule, req.method, incomingPath, queryString) : null;

  if (cacheRule) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      cacheStats.hits += 1;
      const duration = Math.round(performance.now() - start);
      recordRequest(req.method, `/gateway${incomingPath}`, cached.status, duration, true, route.id, service.id);
      writeLog("INFO", service.name, `${req.method} ${targetUrl} -> ${cached.status} cache hit in ${duration}ms`);
      Object.entries(cached.headers).forEach(([key, value]) => res.setHeader(key, value));
      res.setHeader("x-cache", "HIT");
      res.setHeader("x-cache-rule", cacheRule.name);
      clearTimeout(timeout);
      return res.status(cached.status).send(Buffer.from(cached.body));
    }
    cacheStats.misses += 1;
  }

  try {
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.set("x-forwarded-by", "mini-api-gateway");

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
      signal: controller.signal,
    });

    const responseHeaders = {};

    upstream.headers.forEach((value, key) => {
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    const body = Buffer.from(await upstream.arrayBuffer());

    if (cacheRule && upstream.ok) {
      storeCachedResponse(cacheRule, cacheKey, { status: upstream.status, headers: responseHeaders, body });
      responseHeaders["x-cache"] = "MISS";
      responseHeaders["x-cache-rule"] = cacheRule.name;
    }

    const duration = Math.round(performance.now() - start);
    recordRequest(req.method, `/gateway${incomingPath}`, upstream.status, duration, false, route.id, service.id);
    writeLog(upstream.ok ? "INFO" : "ERROR", service.name, `${req.method} ${targetUrl} -> ${upstream.status} in ${duration}ms`);

    Object.entries(responseHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(upstream.status).send(body);
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const status = err.name === "AbortError" ? 504 : 502;
    recordRequest(req.method, `/gateway${incomingPath}`, status, duration, false, route.id, service.id);
    writeLog("ERROR", service.name, `${req.method} ${targetUrl} failed: ${err.message}`);
    return res.status(status).json({ message: err.name === "AbortError" ? "Upstream request timed out" : "Upstream request failed" });
  } finally {
    clearTimeout(timeout);
  }
}

writeLog("INFO", "Gateway", "Backend server initialized");

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/gateway")) return next();
  const start = performance.now();
  res.on("finish", () => {
    if (req.path === "/api/gateway/state") return;
    const duration = Math.round(performance.now() - start);
    writeLog(res.statusCode >= 400 ? "ERROR" : "INFO", "Gateway", `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  return next();
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    req.admin = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mini-api-gateway-backend" });
});

app.post("/api/auth/login", (req, res) => {
  if (!adminEmail || !adminPassword || !jwtSecret) {
    return res.status(500).json({ message: "Admin auth environment is not configured" });
  }

  const { email, password } = req.body || {};

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const admin = { email: adminEmail, role: "admin" };
  const token = jwt.sign(admin, jwtSecret, { expiresIn: jwtExpiresIn });
  writeLog("INFO", "Auth", `Admin login succeeded for ${adminEmail}`);

  return res.json({ token, admin });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

app.get("/api/gateway/state", requireAuth, (_req, res) => {
  res.json(buildGatewayState());
});

app.get("/api/services", requireAuth, (_req, res) => {
  res.json({ services: buildServices() });
});

app.post("/api/services", requireAuth, async (req, res) => {
  try {
    const service = sanitizeService(req.body || {});
    gatewayConfig.services.push(service);
    serviceRuntime.set(service.id, { requests: 0, errors: 0, latency: 0 });
    await saveConfig();
    writeLog("INFO", "Gateway", `Service added: ${service.name}`);
    return res.status(201).json({ service });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.get("/api/routes", requireAuth, (_req, res) => {
  res.json({ routes: allRoutes().map(routeWithRuntime) });
});

app.post("/api/routes", requireAuth, async (req, res) => {
  try {
    const route = sanitizeRoute(req.body || {});
    gatewayConfig.routes.push(route);
    routeRuntime.set(route.id, { requests: 0, errors: 0, avgLatency: 0 });
    await saveConfig();
    writeLog("INFO", "Gateway", `Route added: ${route.path}`);
    return res.status(201).json({ route: routeWithRuntime(route) });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.get("/api/api-keys", requireAuth, (_req, res) => {
  res.json({ apiKeys: gatewayConfig.apiKeys.map(publicApiKey) });
});

app.post("/api/api-keys", requireAuth, async (req, res) => {
  try {
    const { apiKey, secret } = createApiKey(req.body || {});
    gatewayConfig.apiKeys.push(apiKey);
    await saveConfig();
    writeLog("INFO", "Auth", `API key created: ${apiKey.name}`);
    return res.status(201).json({ apiKey: publicApiKey(apiKey), secret });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.delete("/api/api-keys/:id", requireAuth, async (req, res) => {
  const before = gatewayConfig.apiKeys.length;
  gatewayConfig.apiKeys = gatewayConfig.apiKeys.filter((apiKey) => apiKey.id !== req.params.id);

  if (gatewayConfig.apiKeys.length === before) {
    return res.status(404).json({ message: "API key not found" });
  }

  await saveConfig();
  writeLog("INFO", "Auth", `API key deleted: ${req.params.id}`);
  return res.status(204).send();
});

app.get("/api/rate-limits", requireAuth, (_req, res) => {
  res.json({ rateLimits: gatewayConfig.rateLimits.map(publicRateLimit) });
});

app.post("/api/rate-limits", requireAuth, async (req, res) => {
  try {
    const rule = sanitizeRateLimit(req.body || {});
    gatewayConfig.rateLimits.push(rule);
    await saveConfig();
    writeLog("INFO", "Gateway", `Rate limit added: ${rule.name}`);
    return res.status(201).json({ rateLimit: publicRateLimit(rule) });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.delete("/api/rate-limits/:id", requireAuth, async (req, res) => {
  const before = gatewayConfig.rateLimits.length;
  gatewayConfig.rateLimits = gatewayConfig.rateLimits.filter((rule) => rule.id !== req.params.id);

  if (gatewayConfig.rateLimits.length === before) {
    return res.status(404).json({ message: "Rate limit not found" });
  }

  for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
    if (bucket.ruleId === req.params.id) rateLimitBuckets.delete(bucketKey);
  }

  await saveConfig();
  writeLog("INFO", "Gateway", `Rate limit deleted: ${req.params.id}`);
  return res.status(204).send();
});

app.get("/api/cache-rules", requireAuth, (_req, res) => {
  res.json({ cacheRules: gatewayConfig.cacheRules.map(publicCacheRule) });
});

app.post("/api/cache-rules", requireAuth, async (req, res) => {
  try {
    const rule = sanitizeCacheRule(req.body || {});
    gatewayConfig.cacheRules.push(rule);
    await saveConfig();
    writeLog("INFO", "Gateway", `Cache rule added: ${rule.name}`);
    return res.status(201).json({ cacheRule: publicCacheRule(rule) });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.delete("/api/cache-rules/:id", requireAuth, async (req, res) => {
  const before = gatewayConfig.cacheRules.length;
  gatewayConfig.cacheRules = gatewayConfig.cacheRules.filter((rule) => rule.id !== req.params.id);

  if (gatewayConfig.cacheRules.length === before) {
    return res.status(404).json({ message: "Cache rule not found" });
  }

  for (const [cacheKey, entry] of responseCache.entries()) {
    if (entry.ruleId === req.params.id) responseCache.delete(cacheKey);
  }

  await saveConfig();
  writeLog("INFO", "Gateway", `Cache rule deleted: ${req.params.id}`);
  return res.status(204).send();
});

app.use("/gateway", proxyGatewayRequest);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
