// Mini API Gateway Simulation
// This demonstrates backend architecture concepts in the frontend

class APIGateway {
    constructor() {
        this.services = new Map();
        this.routes = new Map();
        this.cache = new Map();
        this.rateLimiters = new Map();
        this.authTokens = new Set();
        this.logs = [];
        this.requestCount = 0;
        this.startTime = Date.now();
        
        this.init();
    }

    init() {
        this.setupDefaultServices();
        this.setupDefaultRoutes();
        this.setupAuth();
        this.startMetricsCollection();
        this.simulateTraffic();
    }

    // Service Management
    setupDefaultServices() {
        const services = [
            { id: 'user-service', name: 'User Service', url: 'http://localhost:3001', health: 'healthy', latency: 23 },
            { id: 'payment-service', name: 'Payment Service', url: 'http://localhost:3002', health: 'healthy', latency: 45 },
            { id: 'analytics-service', name: 'Analytics Service', url: 'http://localhost:3003', health: 'healthy', latency: 67 },
            { id: 'notification-service', name: 'Notification Service', url: 'http://localhost:3004', health: 'warning', latency: 120 },
            { id: 'search-service', name: 'Search Service', url: 'http://localhost:3005', health: 'healthy', latency: 89 },
            { id: 'file-service', name: 'File Service', url: 'http://localhost:3006', health: 'healthy', latency: 34 }
        ];

        services.forEach(service => {
            this.services.set(service.id, {
                ...service,
                requests: 0,
                errors: 0,
                lastChecked: Date.now()
            });
        });
    }

    // Route Configuration
    setupDefaultRoutes() {
        const routes = [
            { path: '/api/users/*', service: 'user-service', methods: ['GET', 'POST', 'PUT', 'DELETE'], auth: true, rateLimit: true, cache: false },
            { path: '/api/payments/*', service: 'payment-service', methods: ['POST', 'GET'], auth: true, rateLimit: true, cache: false },
            { path: '/api/analytics/*', service: 'analytics-service', methods: ['GET'], auth: true, rateLimit: false, cache: true },
            { path: '/api/notifications/*', service: 'notification-service', methods: ['POST', 'GET'], auth: true, rateLimit: true, cache: false },
            { path: '/api/search/*', service: 'search-service', methods: ['GET'], auth: false, rateLimit: true, cache: true },
            { path: '/api/files/*', service: 'file-service', methods: ['GET', 'POST'], auth: true, rateLimit: false, cache: true }
        ];

        routes.forEach((route, index) => {
            this.routes.set(`route-${index}`, {
                ...route,
                id: `route-${index}`,
                requests: Math.floor(Math.random() * 50000) + 10000,
                avgLatency: Math.floor(Math.random() * 100) + 20,
                status: 'active'
            });
        });
    }

    // Authentication Setup
    setupAuth() {
        // JWT, API Key, OAuth2 configurations
        this.authMethods = [
            { type: 'jwt', name: 'JWT Authentication', enabled: true, config: { algorithm: 'RS256', expiry: '1h' } },
            { type: 'apikey', name: 'API Key', enabled: true, config: { header: 'X-API-Key', prefix: 'ak_' } },
            { type: 'oauth2', name: 'OAuth 2.0', enabled: false, config: { provider: 'custom', scopes: ['read', 'write'] } }
        ];

        // Generate sample API keys
        this.apiKeys = [
            { key: 'ak_live_51H8m...', name: 'Production Key', created: '2024-01-10', lastUsed: '2 mins ago', requests: 2847293 },
            { key: 'ak_test_9K2n...', name: 'Staging Key', created: '2024-01-12', lastUsed: '1 hour ago', requests: 45231 },
            { key: 'ak_dev_3M7p...', name: 'Development', created: '2024-01-14', lastUsed: '3 days ago', requests: 8934 }
        ];
    }

    // Middleware: Authentication
    async authenticate(request) {
        this.log('DEBUG', 'Auth', 'Checking authentication');
        
        const authHeader = request.headers?.authorization;
        const apiKey = request.headers?.['x-api-key'];

        if (!authHeader && !apiKey) {
            throw new Error('Unauthorized: No credentials provided');
        }

        // Simulate JWT validation
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            if (!this.authTokens.has(token) && token.length < 20) {
                throw new Error('Unauthorized: Invalid token');
            }
            return { type: 'jwt', user: 'user-123', scopes: ['read', 'write'] };
        }

        // Simulate API Key validation
        if (apiKey) {
            const keyExists = this.apiKeys.some(k => apiKey.startsWith(k.key.slice(0, 10)));
            if (!keyExists && apiKey.length < 10) {
                throw new Error('Unauthorized: Invalid API key');
            }
            return { type: 'apikey', tier: 'premium' };
        }

        throw new Error('Unauthorized: Invalid authentication method');
    }

    // Middleware: Rate Limiting
    checkRateLimit(clientId, route) {
        const key = `${clientId}:${route}`;
        const now = Date.now();
        const windowMs = 60000; // 1 minute
        const maxRequests = route.rateLimit ? 1000 : 10000;

        if (!this.rateLimiters.has(key)) {
            this.rateLimiters.set(key, { count: 1, resetTime: now + windowMs });
            return { allowed: true, remaining: maxRequests - 1 };
        }

        const limiter = this.rateLimiters.get(key);
        
        if (now > limiter.resetTime) {
            limiter.count = 1;
            limiter.resetTime = now + windowMs;
            return { allowed: true, remaining: maxRequests - 1 };
        }

        if (limiter.count >= maxRequests) {
            this.log('WARN', 'RateLimit', `Rate limit exceeded for ${clientId}`);
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil((limiter.resetTime - now) / 1000)}s`);
        }

        limiter.count++;
        return { allowed: true, remaining: maxRequests - limiter.count };
    }

    // Middleware: Caching
    getCacheKey(request) {
        return `${request.method}:${request.path}:${JSON.stringify(request.query || {})}`;
    }

    async getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        this.log('DEBUG', 'Cache', `Cache hit for ${key}`);
        return cached.data;
    }

    async setCache(key, data, ttlSeconds = 300) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + (ttlSeconds * 1000),
            created: Date.now()
        });
        this.log('DEBUG', 'Cache', `Cached response for ${key}`);
    }

    // Middleware: Logging
    log(level, service, message, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service,
            message,
            ...metadata,
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.logs.unshift(entry);
        if (this.logs.length > 1000) this.logs.pop();
        
        // Update UI if on logs tab
        if (document.getElementById('tab-logs').classList.contains('hidden') === false) {
            this.renderLogs();
        }
        
        return entry;
    }

    // Core: Route Request
    async routeRequest(request) {
        const startTime = performance.now();
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            this.log('INFO', 'Gateway', `Incoming request ${request.method} ${request.path}`, { requestId });

            // Find matching route
            const route = this.findRoute(request.path);
            if (!route) {
                throw new Error(`No route found for ${request.path}`);
            }

            // Get service
            const service = this.services.get(route.service);
            if (!service) {
                throw new Error(`Service ${route.service} not found`);
            }

            // Authentication
            let authInfo = null;
            if (route.auth) {
                authInfo = await this.authenticate(request);
            }

            // Rate Limiting
            const clientId = authInfo?.user || request.headers?.['x-forwarded-for'] || 'anonymous';
            this.checkRateLimit(clientId, route.id);

            // Check cache for GET requests
            if (route.cache && request.method === 'GET') {
                const cacheKey = this.getCacheKey(request);
                const cached = await this.getFromCache(cacheKey);
                if (cached) {
                    const duration = performance.now() - startTime;
                    this.updateMetrics(service, duration, true);
                    return {
                        status: 200,
                        data: cached,
                        headers: { 'X-Cache': 'HIT', 'X-Request-ID': requestId },
                        cached: true
                    };
                }
            }

            // Forward to service (simulated)
            const response = await this.forwardToService(service, request);
            
            // Cache successful GET responses
            if (route.cache && request.method === 'GET' && response.status === 200) {
                const cacheKey = this.getCacheKey(request);
                await this.setCache(cacheKey, response.data);
            }

            const duration = performance.now() - startTime;
            this.updateMetrics(service, duration, false);

            this.log('INFO', service.name, `Request completed in ${duration.toFixed(2)}ms`, {
                requestId,
                duration,
                status: response.status
            });

            return {
                status: response.status,
                data: response.data,
                headers: { 'X-Cache': 'MISS', 'X-Request-ID': requestId },
                duration
            };

        } catch (error) {
            const duration = performance.now() - startTime;
            this.log('ERROR', 'Gateway', error.message, { requestId, stack: error.stack });
            
            return {
                status: error.message.includes('Unauthorized') ? 401 : 
                       error.message.includes('Rate limit') ? 429 : 500,
                error: error.message,
                requestId
            };
        }
    }

    findRoute(path) {
        for (const [id, route] of this.routes) {
            const pattern = route.path.replace('*', '.*');
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(path)) {
                return route;
            }
        }
        return null;
    }

    async forwardToService(service, request) {
        // Simulate network latency
        const latency = service.latency + Math.random() * 20;
        await new Promise(r => setTimeout(r, latency));

        // Simulate occasional errors
        if (Math.random() < 0.01) {
            service.errors++;
            throw new Error(`Service ${service.name} returned 503`);
        }

        service.requests++;
        
        // Generate mock response
        return {
            status: 200,
            data: {
                service: service.name,
                path: request.path,
                method: request.method,
                timestamp: new Date().toISOString()
            }
        };
    }

    updateMetrics(service, duration, fromCache) {
        this.requestCount++;
        
        // Update service metrics
        const existing = this.services.get(service.id);
        existing.latency = (existing.latency * 0.9) + (duration * 0.1);
        
        // Update global metrics
        this.updateDashboardMetrics();
    }

    updateDashboardMetrics() {
        const totalRequests = document.getElementById('total-requests');
        if (totalRequests) {
            const count = 2847293 + this.requestCount;
            totalRequests.textContent = count.toLocaleString();
        }
    }

    startMetricsCollection() {
        setInterval(() => {
            // Simulate metric fluctuations
            const avgResponse = document.getElementById('avg-response');
            if (avgResponse) {
                const base = 45;
                const variation = Math.sin(Date.now() / 10000) * 10 + Math.random() * 5;
                avgResponse.textContent = `${Math.round(base + variation)}ms`;
            }
        }, 2000);
    }

    simulateTraffic() {
        const paths = [
            '/api/users/profile',
            '/api/users/settings',
            '/api/payments/charge',
            '/api/analytics/dashboard',
            '/api/search/query',
            '/api/files/upload'
        ];

        const methods = ['GET', 'POST', 'PUT'];

        setInterval(async () => {
            if (Math.random() > 0.7) { // 30% chance to generate request
                const request = {
                    method: methods[Math.floor(Math.random() * methods.length)],
                    path: paths[Math.floor(Math.random() * paths.length)],
                    headers: {
                        authorization: 'Bearer eyJhbGciOiJSUzI1NiIs...',
                        'x-api-key': 'ak_live_51H8m...'
                    },
                    query: {}
                };

                const response = await this.routeRequest(request);
                
                // Add to recent requests UI
                this.addRecentRequest(request, response);
            }
        }, 1500);
    }

    addRecentRequest(request, response) {
        const container = document.getElementById('recent-requests');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800';
        
        const statusColor = response.status < 300 ? 'text-accent-emerald' : 
                           response.status < 400 ? 'text-accent-cyan' : 'text-accent-rose';
        const methodColor = request.method === 'GET' ? 'text-accent-cyan' :
                           request.method === 'POST' ? 'text-accent-emerald' :
                           request.method === 'PUT' ? 'text-accent-purple' : 'text-accent-rose';

        entry.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="font-mono text-xs ${methodColor} w-12">${request.method}</span>
                <span class="text-sm text-slate-300 truncate max-w-xs">${request.path}</span>
                ${response.cached ? '<span class="px-2 py-0.5 rounded text-xs bg-accent-purple/20 text-accent-purple">CACHE</span>' : ''}
            </div>
            <div class="flex items-center gap-4">
                <span class="font-mono text-xs ${statusColor}">${response.status}</span>
                <span class="text-xs text-slate-500">${response.duration ? response.duration.toFixed(0) + 'ms' : '-'}</span>
                <span class="text-xs text-slate-500">${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        container.insertBefore(entry, container.firstChild);
        if (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    // UI Rendering Methods
    renderServices() {
        const container = document.getElementById('services-grid');
        if (!container) return;

        container.innerHTML = Array.from(this.services.values()).map(service => {
            const healthColor = service.health === 'healthy' ? 'text-accent-emerald' :
                              service.health === 'warning' ? 'text-yellow-500' : 'text-accent-rose';
            const healthBg = service.health === 'healthy' ? 'bg-accent-emerald/10' :
                            service.health === 'warning' ? 'bg-yellow-500/10' : 'bg-accent-rose/10';

            return `
                <div class="glass-panel rounded-xl p-6 hover:border-accent-cyan/30 transition-all cursor-pointer">
                    <div class="flex items-start justify-between mb-4">
                        <div class="p-3 rounded-lg bg-slate-800">
                            <i data-lucide="server" class="w-6 h-6 text-accent-cyan"></i>
                        </div>
                        <span class="px-3 py-1 rounded-full ${healthBg} ${healthColor} text-xs font-medium capitalize">
                            ${service.health}
                        </span>
                    </div>
                    <h4 class="font-semibold mb-1">${service.name}</h4>
                    <p class="text-sm text-slate-400 mb-4">${service.url}</p>
                    <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                        <div>
                            <p class="text-xs text-slate-500">Requests</p>
                            <p class="text-sm font-medium">${service.requests.toLocaleString()}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500">Latency</p>
                            <p class="text-sm font-medium">${Math.round(service.latency)}ms</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }

    renderRoutes() {
        const tbody = document.getElementById('routes-table');
        if (!tbody) return;

        tbody.innerHTML = Array.from(this.routes.values()).map(route => {
            const service = this.services.get(route.service);
            return `
                <tr class="hover:bg-slate-800/50 transition-colors">
                    <td class="px-6 py-4">
                        <code class="text-accent-cyan text-sm">${route.path}</code>
                    </td>
                    <td class="px-6 py-4 text-sm">${service?.name || route.service}</td>
                    <td class="px-6 py-4">
                        <div class="flex gap-1">
                            ${route.methods.map(m => `<span class="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">${m}</span>`).join('')}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-accent-emerald"></span>
                            <span class="text-sm text-accent-emerald">Active</span>
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm">${route.avgLatency}ms</td>
                    <td class="px-6 py-4">
                        <button class="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all">
                            <i data-lucide="more-vertical" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    }

    renderServiceHealth() {
        const container = document.getElementById('service-health');
        if (!container) return;

        container.innerHTML = Array.from(this.services.values()).slice(0, 5).map(service => {
            const healthPercent = service.health === 'healthy' ? 98 + Math.random() * 2 :
                                 service.health === 'warning' ? 85 + Math.random() * 10 : 70;
            const barColor = service.health === 'healthy' ? 'bg-accent-emerald' :
                            service.health === 'warning' ? 'bg-yellow-500' : 'bg-accent-rose';

            return `
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm">${service.name}</span>
                        <span class="text-sm ${healthPercent > 95 ? 'text-accent-emerald' : 'text-yellow-500'}">${healthPercent.toFixed(1)}%</span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div class="h-full ${barColor} rounded-full transition-all duration-500" style="width: ${healthPercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAuth() {
        const methodsContainer = document.getElementById('auth-methods');
        if (methodsContainer) {
            methodsContainer.innerHTML = this.authMethods.map(method => `
                <div class="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                    <div class="flex items-center gap-4">
                        <div class="p-2 rounded-lg ${method.enabled ? 'bg-accent-cyan/10' : 'bg-slate-800'}">
                            <i data-lucide="${method.type === 'jwt' ? 'key-round' : method.type === 'apikey' ? 'key' : 'globe'}" 
                               class="w-5 h-5 ${method.enabled ? 'text-accent-cyan' : 'text-slate-500'}"></i>
                        </div>
                        <div>
                            <p class="font-medium">${method.name}</p>
                            <p class="text-sm text-slate-400">${method.enabled ? 'Enabled' : 'Disabled'}</p>
                        </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" ${method.enabled ? 'checked' : ''} class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-cyan"></div>
                    </label>
                </div>
            `).join('');
        }

        const keysContainer = document.getElementById('api-keys');
        if (keysContainer) {
            keysContainer.innerHTML = this.apiKeys.map(key => `
                <div class="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium">${key.name}</span>
                        <span class="text-xs text-slate-500">${key.lastUsed}</span>
                    </div>
                    <code class="text-sm text-accent-cyan font-mono">${key.key}</code>
                    <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                        <span class="text-xs text-slate-400">${key.requests.toLocaleString()} requests</span>
                        <div class="flex gap-2">
                            <button class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100">
                                <i data-lucide="copy" class="w-4 h-4"></i>
                            </button>
                            <button class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-accent-rose">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        lucide.createIcons();
    }

    renderRateLimits() {
        const container = document.getElementById('rate-limits-list');
        if (!container) return;

        const limits = [
            { name: 'Premium Tier', rpm: 10000, burst: 1000, current: 2341 },
            { name: 'Standard Tier', rpm: 1000, burst: 100, current: 567 },
            { name: 'Basic Tier', rpm: 100, burst: 10, current: 89 },
            { name: 'Anonymous', rpm: 10, burst: 5, current: 3 }
        ];

        container.innerHTML = limits.map(limit => {
            const percent = (limit.current / limit.rpm) * 100;
            return `
                <div class="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div class="flex-1">
                        <h4 class="font-medium mb-1">${limit.name}</h4>
                        <p class="text-sm text-slate-400">${limit.rpm.toLocaleString()} requests/min • ${limit.burst} burst</p>
                    </div>
                    <div class="w-48">
                        <div class="flex items-center justify-between text-xs mb-1">
                            <span class="text-slate-400">Usage</span>
                            <span class="${percent > 80 ? 'text-accent-rose' : 'text-accent-emerald'}">${percent.toFixed(1)}%</span>
                        </div>
                        <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div class="h-full ${percent > 80 ? 'bg-accent-rose' : 'bg-accent-cyan'} rounded-full transition-all" style="width: ${Math.min(percent, 100)}%"></div>
                        </div>
                    </div>
                    <button class="ml-6 p-2 rounded-lg hover:bg-slate-700 text-slate-400">
                        <i data-lucide="settings" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }

    renderCacheRules() {
        const container = document.getElementById('cache-rules');
        if (!container) return;

        const rules = [
            { path: '/api/search/*', ttl: 300, type: 'public', size: '1.2 GB' },
            { path: '/api/analytics/dashboard', ttl: 60, type: 'private', size: '456 MB' },
            { path: '/api/files/*', ttl: 3600, type: 'public', size: '892 MB' },
            { path: '/api/users/profile', ttl: 0, type: 'no-cache', size: '-' }
        ];

        container.innerHTML = rules.map(rule => `
            <div class="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                <div class="flex items-center gap-4">
                    <div class="p-2 rounded-lg ${rule.ttl === 0 ? 'bg-accent-rose/10' : 'bg-accent-cyan/10'}">
                        <i data-lucide="${rule.ttl === 0 ? 'x-circle' : 'check-circle'}" 
                           class="w-5 h-5 ${rule.ttl === 0 ? 'text-accent-rose' : 'text-accent-cyan'}"></i>
                    </div>
                    <div>
                        <code class="text-sm text-accent-cyan">${rule.path}</code>
                        <div class="flex items-center gap-3 mt-1">
                            <span class="text-xs text-slate-400">TTL: ${rule.ttl === 0 ? 'No cache' : rule.ttl + 's'}</span>
                            <span class="text-xs text-slate-400">Type: ${rule.type}</span>
                            ${rule.size !== '-' ? `<span class="text-xs text-slate-400">Size: ${rule.size}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button class="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-accent-rose">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `).join('');

        lucide.createIcons();
    }

    renderLogs() {
        const container = document.getElementById('logs-container');
        if (!container) return;

        const levelColors = {
            'ERROR': 'text-accent-rose',
            'WARN': 'text-yellow-500',
            'INFO': 'text-accent-cyan',
            'DEBUG': 'text-slate-500'
        };

        container.innerHTML = this.logs.slice(0, 50).map(log => `
            <div class="log-entry flex items-start gap-4 py-2 border-b border-slate-900/50 last:border-0 hover:bg-slate-900/30 px-2 -mx-2 rounded">
                <span class="text-slate-500 text-xs whitespace-nowrap">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="text-xs font-bold ${levelColors[log.level] || 'text-slate-400'} w-12">${log.level}</span>
                <span class="text-accent-purple text-xs w-24">${log.service}</span>
                <span class="text-slate-300 text-xs flex-1">${log.message}</span>
            </div>
        `).join('');
    }

    renderTopRoutes() {
        const container = document.getElementById('top-routes');
        if (!container) return;

        const sortedRoutes = Array.from(this.routes.values())
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 5);

        const maxRequests = sortedRoutes[0]?.requests || 1;

        container.innerHTML = sortedRoutes.map((route, index) => {
            const percent = (route.requests / maxRequests) * 100;
            const colors = ['accent-cyan', 'accent-purple', 'accent-emerald', 'yellow-500', 'accent-rose'];
            const color = colors[index] || 'slate-400';

            return `
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-3">
                            <span class="w-6 h-6 rounded-full bg-${color}/10 text-${color} text-xs flex items-center justify-center font-bold">
                                ${index + 1}
                            </span>
                            <code class="text-sm text-slate-300">${route.path}</code>
                        </div>
                        <span class="text-sm text-slate-400">${route.requests.toLocaleString()}</span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-800 overflow-hidden ml-9">
                        <div class="h-full bg-${color} rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    initChart() {
        const ctx = document.getElementById('trafficChart');
        if (!ctx) return;

        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
        const data = labels.map(() => Math.floor(Math.random() * 50000) + 30000);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Requests',
                    data,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: { color: '#94a3b8', maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: { color: '#94a3b8' }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
}

// Initialize Gateway
const gateway = new APIGateway();

// UI Functions
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'services': 'Services',
        'routes': 'Routes',
        'auth': 'Authentication',
        'rate-limits': 'Rate Limits',
        'cache': 'Cache',
        'logs': 'Logs'
    };
    document.getElementById('page-title').textContent = titles[tabName];
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-accent-cyan/10', 'text-accent-cyan', 'border', 'border-accent-cyan/20');
        btn.classList.add('text-slate-400');
    });
    event.currentTarget.classList.remove('text-slate-400');
    event.currentTarget.classList.add('bg-accent-cyan/10', 'text-accent-cyan', 'border', 'border-accent-cyan/20');
    
    // Render tab-specific content
    if (tabName === 'services') gateway.renderServices();
    if (tabName === 'routes') gateway.renderRoutes();
    if (tabName === 'auth') gateway.renderAuth();
    if (tabName === 'rate-limits') gateway.renderRateLimits();
    if (tabName === 'cache') gateway.renderCacheRules();
    if (tabName === 'logs') gateway.renderLogs();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    gateway.initChart();
    gateway.renderServiceHealth();
    gateway.renderTopRoutes();
    
    // Refresh service health periodically
    setInterval(() => gateway.renderServiceHealth(), 5000);
    setInterval(() => gateway.renderTopRoutes(), 10000);
});

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const colors = {
        info: 'bg-accent-cyan',
        success: 'bg-accent-emerald',
        error: 'bg-accent-rose',
        warning: 'bg-yellow-500'
    };
    
    toast.className = `${colors[type]} text-slate-950 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}" class="w-5 h-5"></i>
        <span class="font-medium">${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 100);
    
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}