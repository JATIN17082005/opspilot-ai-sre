/**
 * OpsPilot — AI SRE Command Center Dashboard
 * Enterprise-grade dark observability frontend
 */

// Global State
const API_BASE = "";
let currentView = 'overview';
let incidents = [];
let anomalies = [];
let stats = {};
let knowledgeStatus = {};
let selectedIncidentId = null;
let lastInvestigationReport = null;
let sidebarCollapsed = localStorage.getItem('opspilot_sidebar_collapsed') === 'true';

// Filters & Local State
let anomalyFilterOnlyAnomalous = true;
let anomalySortField = 'window';
let anomalySortDesc = true;
let incidentStatusFilter = 'all';
let incidentSeverityFilter = 'all';
let incidentSearchQuery = '';

// Safe HTML Escaping
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Inline SVG Icon Provider (100% offline, zero CDN dependency)
function icon(name, className = "w-4 h-4") {
    const icons = {
        'dashboard': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`,
        'server': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
        'pulse': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>`,
        'alert': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        'book': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
        'brain': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16.01"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>`,
        'check': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        'x': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        'refresh': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
        'chevron-right': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
        'chevron-down': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
        'search': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
        'clock': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        'database': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
        'shield': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
        'tool': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
        'play': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        'info': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };
    return icons[name] || icons['info'];
}

// HTTP API Helpers
async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API Error ${res.status}: ${res.statusText}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        let msg = `API Error ${res.status}`;
        try {
            const err = await res.json();
            if (err.detail) msg = err.detail;
        } catch (_) {}
        throw new Error(msg);
    }
    return res.json();
}

async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        let msg = `API Error ${res.status}`;
        try {
            const err = await res.json();
            if (err.detail) msg = err.detail;
        } catch (_) {}
        throw new Error(msg);
    }
    return res.json();
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const borderCol = type === 'error' ? 'border-rose-700/80 text-rose-300' :
                      type === 'success' ? 'border-emerald-700/80 text-emerald-300' : 'border-sky-700/80 text-sky-300';
    toast.className = `toast ${borderCol}`;
    toast.innerHTML = `
        <span>${type === 'error' ? icon('alert', 'w-4 h-4 text-rose-400') : type === 'success' ? icon('check', 'w-4 h-4 text-emerald-400') : icon('info', 'w-4 h-4 text-sky-400')}</span>
        <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Check Backend & RAG Health
async function checkHealth() {
    try {
        await apiGet('/health');
        const dot = document.getElementById('dot-backend');
        if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]";
    } catch {
        const dot = document.getElementById('dot-backend');
        if (dot) dot.className = "w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]";
    }

    try {
        const rag = await apiGet('/knowledge/status');
        knowledgeStatus = rag;
        const dot = document.getElementById('dot-rag');
        if (dot) {
            dot.className = rag.is_embedded
                ? "w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]"
                : "w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]";
        }
        const modelTag = document.getElementById('sidebar-model-tag');
        if (modelTag) {
            modelTag.textContent = rag.ollama_model || (rag.is_embedded ? 'qwen3.5:2b' : 'TF-IDF Fallback');
        }
    } catch {
        const dot = document.getElementById('dot-rag');
        if (dot) dot.className = "w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]";
    }
}

// Mobile Sidebar Controls
function toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
        closeMobileSidebar();
    } else {
        sidebar.classList.add('mobile-open');
        backdrop.classList.remove('hidden');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.add('hidden');
}

// Navigation & Router
function nav(view, targetIncidentId = null) {
    currentView = view;
    if (targetIncidentId) selectedIncidentId = targetIncidentId;

    // Automatically close mobile drawer when navigating
    closeMobileSidebar();

    // Update Sidebar Active state
    ['overview', 'services', 'anomalies', 'incidents', 'knowledge', 'investigations'].forEach(v => {
        const btn = document.getElementById(`nav-${v}`);
        if (btn) {
            if (v === view) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });

    // Update Top Command Bar titles
    const titles = {
        'overview': { title: 'SRE Overview', desc: 'System reliability posture, anomaly detection metrics, and real-time incident activity.' },
        'services': { title: 'Service Catalog & Topology', desc: 'Distributed microservices health, dependencies, and event distributions.' },
        'anomalies': { title: 'Isolation Forest Anomalies', desc: 'Sliding telemetry windows, feature space evaluation, and unsupervised anomaly scores.' },
        'incidents': { title: 'Correlated Incidents', desc: 'Window-aggregated incident clusters, deterministic root-cause rankings, and lifecycle states.' },
        'knowledge': { title: 'Runbook Knowledge Base', desc: 'RAG vector index, operational runbooks, and retrieval diagnostics.' },
        'investigations': { title: 'Autonomous AI Investigation', desc: 'Local AI agent evidence synthesis, tool audit trails, and grounded root-cause hypotheses.' }
    };

    const info = titles[view] || { title: view, desc: '' };
    const titleEl = document.getElementById('page-title');
    const descEl = document.getElementById('page-desc');
    if (titleEl) titleEl.textContent = info.title;
    if (descEl) descEl.textContent = info.desc;

    return render();
}

// Sidebar Collapse / Expand Toggle for Desktop
function initSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const btn = document.getElementById('btn-toggle-sidebar');
    if (!sidebar || !btn) return;

    function applyCollapse(collapsed) {
        if (collapsed) {
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-16');
            document.querySelectorAll('.sidebar-text').forEach(el => el.classList.add('hidden'));
        } else {
            sidebar.classList.remove('w-16');
            sidebar.classList.add('w-64');
            document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('hidden'));
        }
    }

    applyCollapse(sidebarCollapsed);

    btn.onclick = () => {
        sidebarCollapsed = !sidebarCollapsed;
        localStorage.setItem('opspilot_sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
        applyCollapse(sidebarCollapsed);
    };
}

// Global Refresh Action
async function triggerRefresh() {
    const iconEl = document.getElementById('refresh-icon');
    const textEl = document.getElementById('last-updated-text');
    if (iconEl) iconEl.classList.add('sre-spinner');
    if (textEl) textEl.textContent = 'Syncing...';

    try {
        await checkHealth();
        await render();
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (textEl) textEl.textContent = `Synced ${timeStr}`;
        showToast('Telemetry refreshed successfully', 'success');
    } catch (err) {
        showToast(`Sync failed: ${err.message}`, 'error');
        if (textEl) textEl.textContent = 'Sync Error';
    } finally {
        if (iconEl) iconEl.classList.remove('sre-spinner');
    }
}

// Main Render Dispatcher
let currentRenderEpoch = 0;

async function render() {
    const root = document.getElementById('app-content');
    if (!root) return;
    const epoch = ++currentRenderEpoch;
    root.innerHTML = `
        <div class="flex items-center justify-center h-64 space-x-3 text-slate-400">
            <svg class="w-6 h-6 sre-spinner text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
            </svg>
            <span class="text-sm font-mono tracking-wide">Querying OpsPilot Telemetry...</span>
        </div>
    `;

    try {
        if (currentView === 'overview') await renderOverview(root, epoch);
        else if (currentView === 'services') await renderServices(root, epoch);
        else if (currentView === 'anomalies') await renderAnomalies(root, epoch);
        else if (currentView === 'incidents') await renderIncidents(root, epoch);
        else if (currentView === 'knowledge') await renderKnowledge(root, epoch);
        else if (currentView === 'investigations') await renderInvestigations(root, epoch);
    } catch (err) {
        if (epoch !== currentRenderEpoch) return;
        root.innerHTML = `
            <div class="p-6 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-200 space-y-2 max-w-2xl mx-auto my-8">
                <div class="flex items-center space-x-2 font-semibold">
                    ${icon('alert', 'w-5 h-5 text-rose-400')}
                    <span>Dashboard Render Error</span>
                </div>
                <p class="text-sm text-rose-300 font-mono">${escapeHTML(err.message)}</p>
                <div class="pt-2">
                    <button onclick="triggerRefresh()" class="btn-primary text-xs">Retry Query</button>
                </div>
            </div>
        `;
    }
}

// -------------------------------------------------------------------------------------------------
// VIEW 1: OVERVIEW (SRE COMMAND CENTER)
// -------------------------------------------------------------------------------------------------
async function renderOverview(root, epoch) {
    let statsRes = { total_events: 0, service_counts: {} };
    let incRes = { items: [], total: 0 };
    let anomRes = { anomalies: [], total_analyzed_windows: 0 };

    try { statsRes = await apiGet('/stats'); } catch (e) { console.warn('Stats API error', e); }
    try { incRes = await apiGet('/incidents?size=100'); } catch (e) { console.warn('Incidents API error', e); }
    try {
        anomRes = await apiGet('/anomalies');
    } catch (e) {
        // Cold start fallback: auto-fit if detector not fitted yet
        try {
            await apiPost('/detect/fit', {});
            anomRes = await apiGet('/anomalies');
        } catch (_) {
            anomRes = { anomalies: [], total_analyzed_windows: 0 };
        }
    }

    stats = statsRes;
    incidents = incRes.items || [];
    anomalies = (anomRes.anomalies || []).filter(a => a.is_anomalous);

    // Calculate Global Posture
    const totalIncidents = incRes.total || incidents.length;
    const openIncidents = incidents.filter(i => i.status === 'open');
    const ackIncidents = incidents.filter(i => i.status === 'acknowledged');
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

    const criticalOpen = openIncidents.filter(i => i.severity === 'critical' || i.severity === 'high');
    const isCritical = criticalOpen.length > 0;
    const isDegraded = openIncidents.length > 0 || anomalies.length > 5;

    // Update Top Pill
    const healthPill = document.getElementById('system-health-pill');
    if (healthPill) {
        if (isCritical) {
            healthPill.className = "flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/80 text-xs font-medium text-rose-300";
            healthPill.innerHTML = `<span class="beacon beacon-critical"></span><span id="system-health-label" class="font-semibold tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap">CRITICAL</span>`;
        } else if (isDegraded) {
            healthPill.className = "flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-950/60 border border-amber-800/80 text-xs font-medium text-amber-300";
            healthPill.innerHTML = `<span class="beacon beacon-warning"></span><span id="system-health-label" class="font-semibold tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap">DEGRADED</span>`;
        } else {
            healthPill.className = "flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-xs font-medium text-emerald-300";
            healthPill.innerHTML = `<span class="beacon beacon-healthy"></span><span id="system-health-label" class="font-semibold tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap">OPERATIONAL</span>`;
        }
    }

    // Update badges in sidebar
    const anomBadge = document.getElementById('badge-anomalies-count');
    if (anomBadge) anomBadge.textContent = anomalies.length;
    const incBadge = document.getElementById('badge-incidents-count');
    if (incBadge) incBadge.textContent = openIncidents.length;

    // Metric Calculations
    const maxLatencyAnomaly = anomalies.length ? Math.max(...anomalies.map(a => a.features.avg_latency || 0)).toFixed(1) : '0';
    const totalEvents = stats.total_events || 0;
    const monitoredServicesCount = Object.keys(stats.service_counts || {}).length || 4;

    // Telemetry Timeline SVG Sparkline/Chart
    const timelineSvg = generateTelemetryTimelineSvg(anomalies);

    // Service Event Breakdown bars
    const serviceBars = Object.entries(stats.service_counts || {}).map(([svc, count]) => {
        const pct = totalEvents ? ((count / totalEvents) * 100).toFixed(1) : 0;
        return `
            <div class="space-y-1">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-mono text-slate-300 font-medium">${svc}</span>
                    <span class="text-slate-400 font-mono">${count.toLocaleString()} <span class="text-[10px] text-slate-500">(${pct}%)</span></span>
                </div>
                <div class="w-full bg-navy-800 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Recent Incidents rows
    const recentIncidentsRows = incidents.slice(0, 5).map(inc => {
        const sevClass = inc.severity === 'critical' ? 'badge-critical' :
                         inc.severity === 'high' ? 'badge-high' :
                         inc.severity === 'medium' ? 'badge-medium' : 'badge-low';
        const topCause = inc.root_cause_candidates.length ? inc.root_cause_candidates[0].service : 'Under Triage';
        const durationMin = Math.round((inc.duration_seconds || 0) / 60);

        return `
            <tr class="hover:bg-navy-800/40 transition-colors cursor-pointer" onclick="nav('investigations', '${escapeHTML(inc.id)}')">
                <td class="px-4 py-3 font-mono text-xs text-sky-400 font-medium">${escapeHTML(inc.id.substring(0, 8))}...</td>
                <td class="px-4 py-3"><span class="badge ${sevClass}">${escapeHTML(inc.severity)}</span></td>
                <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono ${inc.status === 'open' ? 'bg-rose-950/50 text-rose-300 border border-rose-800/60' : inc.status === 'acknowledged' ? 'bg-amber-950/50 text-amber-300 border border-amber-800/60' : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/60'}">
                        ${escapeHTML(inc.status)}
                    </span>
                </td>
                <td class="px-4 py-3 text-xs text-slate-300">
                    <span class="font-mono font-medium text-white">${escapeHTML(topCause)}</span>
                </td>
                <td class="px-4 py-3 text-xs text-slate-400 font-mono">${durationMin} min</td>
                <td class="px-4 py-3 text-right">
                    <button class="btn-primary text-xs py-1 px-2.5" onclick="event.stopPropagation(); nav('investigations', '${escapeHTML(inc.id)}')">
                        ${icon('brain', 'w-3.5 h-3.5')}
                        <span>Triage AI</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (epoch && epoch !== currentRenderEpoch) return;

    root.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">

            <!-- 1. Top High-Value Metric KPI Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- System Reliability Card -->
                <div class="surface-card p-4 space-y-2 border-l-4 ${isCritical ? 'border-l-rose-500' : isDegraded ? 'border-l-amber-500' : 'border-l-emerald-500'}">
                    <div class="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
                        <span>System Health</span>
                        ${icon('shield', 'w-4 h-4 text-slate-400')}
                    </div>
                    <div class="flex items-baseline space-x-2">
                        <span class="text-2xl font-bold font-mono tracking-tight text-white">${isCritical ? 'CRITICAL' : isDegraded ? 'DEGRADED' : '99.98%'}</span>
                        <span class="text-xs text-slate-400">${isCritical ? 'Attention Req.' : isDegraded ? 'Latencies Spike' : 'SLO Nominal'}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                        <span>Active Services: <strong class="text-white">${monitoredServicesCount}/4</strong></span>
                        <span class="text-emerald-400 font-mono">Zero Cloud Cost</span>
                    </div>
                </div>

                <!-- Active Incidents Card -->
                <div class="surface-card p-4 space-y-2 border-l-4 border-l-rose-500/80">
                    <div class="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
                        <span>Correlated Incidents</span>
                        ${icon('alert', 'w-4 h-4 text-rose-400')}
                    </div>
                    <div class="flex items-baseline space-x-2">
                        <span class="text-2xl font-bold font-mono tracking-tight text-white">${totalIncidents}</span>
                        <span class="text-xs font-semibold text-rose-400">${openIncidents.length} Open</span>
                    </div>
                    <!-- Severity Breakdown Pill -->
                    <div class="flex items-center space-x-2 text-[11px] pt-1">
                        <span class="text-rose-400 font-mono font-medium">${openIncidents.filter(i => i.severity==='critical').length} Crit</span>
                        <span class="text-slate-600">•</span>
                        <span class="text-amber-400 font-mono font-medium">${openIncidents.filter(i => i.severity==='high').length} High</span>
                        <span class="text-slate-600">•</span>
                        <span class="text-emerald-400 font-mono font-medium">${resolvedIncidents.length} Resolved</span>
                    </div>
                </div>

                <!-- Anomaly Windows Card -->
                <div class="surface-card p-4 space-y-2 border-l-4 border-l-sky-500">
                    <div class="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
                        <span>Anomalous Windows</span>
                        ${icon('pulse', 'w-4 h-4 text-sky-400')}
                    </div>
                    <div class="flex items-baseline space-x-2">
                        <span class="text-2xl font-bold font-mono tracking-tight text-white">${anomalies.length}</span>
                        <span class="text-xs text-sky-400 font-mono">Peak: ${maxLatencyAnomaly}ms</span>
                    </div>
                    <div class="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                        <span>Algorithm: <span class="text-white font-mono">IsolationForest</span></span>
                        <span class="text-slate-400 font-mono">Contam: 10%</span>
                    </div>
                </div>

                <!-- Telemetry Volume Card -->
                <div class="surface-card p-4 space-y-2 border-l-4 border-l-indigo-500">
                    <div class="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-semibold">
                        <span>Recorded Events</span>
                        ${icon('database', 'w-4 h-4 text-indigo-400')}
                    </div>
                    <div class="flex items-baseline space-x-2">
                        <span class="text-2xl font-bold font-mono tracking-tight text-white">${totalEvents.toLocaleString()}</span>
                        <span class="text-xs text-slate-400">JSONL Telemetry</span>
                    </div>
                    <div class="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                        <span>RAG Chunks: <strong class="text-indigo-300 font-mono">${knowledgeStatus.chunks_indexed || 0}</strong></span>
                        <span class="text-slate-400">Embedding: ${knowledgeStatus.is_embedded ? 'Ollama' : 'TF-IDF'}</span>
                    </div>
                </div>
            </div>

            <!-- 2. Mid Section: Telemetry Anomaly Chart + Service Topology -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Telemetry Visualization (2 cols) -->
                <div class="surface-card p-4 sm:p-5 lg:col-span-2 space-y-4">
                    <div class="flex flex-wrap items-center justify-between border-b border-navy-700/60 pb-3 gap-2">
                        <div class="flex items-center space-x-2">
                            ${icon('pulse', 'w-4 h-4 text-sky-400')}
                            <h2 class="text-sm font-semibold text-white tracking-wide">Isolation Forest Anomaly & Latency Timeline</h2>
                        </div>
                        <div class="flex items-center space-x-4 text-xs font-mono">
                            <span class="flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded bg-sky-400 inline-block"></span><span class="text-slate-300">Avg Latency (ms)</span></span>
                            <span class="flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded bg-rose-500 inline-block"></span><span class="text-slate-300">Anomaly Point</span></span>
                        </div>
                    </div>

                    <!-- SVG Chart Container -->
                    <div class="w-full overflow-hidden">
                        ${timelineSvg}
                    </div>
                    <div class="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono pt-1 gap-2">
                        <span>Window Range: Chronological Telemetry Feed</span>
                        <span>Evaluated Feature: Average Latency & Anomaly Score</span>
                    </div>
                </div>

                <!-- Event Distribution by Service (1 col) -->
                <div class="surface-card p-4 sm:p-5 space-y-4">
                    <div class="flex items-center justify-between border-b border-navy-700/60 pb-3">
                        <div class="flex items-center space-x-2">
                            ${icon('server', 'w-4 h-4 text-indigo-400')}
                            <h2 class="text-sm font-semibold text-white tracking-wide">Event Distribution</h2>
                        </div>
                        <span class="text-[11px] font-mono text-slate-400">${monitoredServicesCount} Services</span>
                    </div>
                    <div class="space-y-3 pt-1">
                        ${serviceBars}
                    </div>
                    <div class="p-3 rounded bg-navy-850 border border-navy-700/50 text-xs text-slate-400 mt-4">
                        <div class="text-slate-300 font-semibold mb-1">Architecture Summary</div>
                        <div>Edge Ingress flows through <span class="text-sky-300 font-mono">api-gateway</span> to authenticated backend tiers and persistent store.</div>
                    </div>
                </div>
            </div>

            <!-- 3. Microservice Dependency Topology Graph -->
            <div class="surface-card p-4 sm:p-5 space-y-4">
                <div class="flex flex-wrap items-center justify-between border-b border-navy-700/60 pb-3 gap-2">
                    <div class="flex items-center space-x-2">
                        ${icon('server', 'w-4 h-4 text-emerald-400')}
                        <h2 class="text-sm font-semibold text-white tracking-wide">Microservices Architecture & Dependency Topology</h2>
                    </div>
                    <span class="text-xs text-slate-400">Interactive SRE Graph — Red border indicates active incident</span>
                </div>
                <!-- Interactive SVG Service Graph -->
                <div class="w-full flex justify-center py-2 overflow-x-auto">
                    ${generateTopologySvg(incidents)}
                </div>
            </div>

            <!-- 4. Correlated Incidents Activity Stream -->
            <div class="surface-card p-4 sm:p-5 space-y-4">
                <div class="flex items-center justify-between border-b border-navy-700/60 pb-3">
                    <div class="flex items-center space-x-2">
                        ${icon('alert', 'w-4 h-4 text-rose-400')}
                        <h2 class="text-sm font-semibold text-white tracking-wide">Recent Correlated Incidents</h2>
                    </div>
                    <button onclick="nav('incidents')" class="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1">
                        <span>View All Incidents (${totalIncidents})</span>
                        ${icon('chevron-right', 'w-3 h-3')}
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="sre-table">
                        <thead>
                            <tr>
                                <th>Incident ID</th>
                                <th>Severity</th>
                                <th>Status</th>
                                <th>Deterministic Root Cause</th>
                                <th>Duration</th>
                                <th class="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentIncidentsRows.length ? recentIncidentsRows : `<tr><td colspan="6" class="text-center py-8 text-slate-400">No active incidents detected.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;
}

// Helper: SVG Anomaly Timeline Generator
function generateTelemetryTimelineSvg(anomaliesList) {
    if (!anomaliesList || anomaliesList.length === 0) {
        return `
            <div class="h-44 flex items-center justify-center text-slate-400 font-mono text-xs border border-dashed border-navy-700 rounded-lg">
                No anomalous windows detected in current telemetry.
            </div>
        `;
    }

    const width = 760;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 30, left: 50 };

    // Extract latencies
    const points = anomaliesList.map((a, idx) => ({
        x: idx,
        y: a.features.avg_latency || 0,
        score: a.score || 0,
        time: new Date(a.window).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    const maxVal = Math.max(...points.map(p => p.y), 100);
    const minVal = 0;

    const scaleX = (idx) => padding.left + (idx / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
    const scaleY = (val) => height - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom);

    // Build SVG path
    let pathD = `M ${scaleX(0)} ${scaleY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${scaleX(i)} ${scaleY(points[i].y)}`;
    }

    // Grid lines
    const gridLines = [0.25, 0.5, 0.75, 1.0].map(ratio => {
        const val = Math.round(minVal + (maxVal - minVal) * ratio);
        const y = scaleY(val);
        return `
            <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1e2c44" stroke-dasharray="3,3" />
            <text x="${padding.left - 8}" y="${y + 4}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${val}ms</text>
        `;
    }).join('');

    // Anomaly Dots
    const dots = points.map(p => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);
        return `
            <circle cx="${cx}" cy="${cy}" r="4.5" fill="#f43f5e" stroke="#0a0e17" stroke-width="2">
                <title>Window ${p.time}: ${p.y.toFixed(1)}ms (Anomaly Score: ${p.score.toFixed(3)})</title>
            </circle>
            <text x="${cx}" y="${height - 10}" fill="#64748b" font-size="9" font-family="monospace" text-anchor="middle">${p.time}</text>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-48 select-none">
            <!-- Background Grids -->
            ${gridLines}
            <!-- Latency Area Gradient -->
            <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
                </linearGradient>
            </defs>
            <path d="${pathD} L ${scaleX(points.length - 1)} ${height - padding.bottom} L ${scaleX(0)} ${height - padding.bottom} Z" fill="url(#latencyGradient)" />
            <!-- Latency Stroke -->
            <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Markers -->
            ${dots}
        </svg>
    `;
}

// Helper: SVG Microservice Dependency Topology Generator
function generateTopologySvg(incidentList) {
    const affectedServices = new Set();
    incidentList.filter(i => i.status !== 'resolved').forEach(i => {
        (i.affected_services || []).forEach(s => affectedServices.add(s));
    });

    const isAff = (s) => affectedServices.has(s);

    return `
        <svg viewBox="0 0 740 220" class="w-full max-w-3xl h-56 select-none font-sans">
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
            </defs>

            <!-- Connecting Edges -->
            <!-- api-gateway -> auth-service -->
            <line x1="160" y1="100" x2="300" y2="50" class="topology-edge ${isAff('api-gateway')||isAff('auth-service') ? 'topology-edge-active' : ''}" marker-end="url(#arrow)" />
            <!-- api-gateway -> payment-service -->
            <line x1="160" y1="110" x2="300" y2="150" class="topology-edge ${isAff('api-gateway')||isAff('payment-service') ? 'topology-edge-active' : ''}" marker-end="url(#arrow)" />
            <!-- auth-service -> database -->
            <line x1="440" y1="50" x2="560" y2="90" class="topology-edge ${isAff('auth-service')||isAff('database') ? 'topology-edge-active' : ''}" marker-end="url(#arrow)" />
            <!-- payment-service -> database -->
            <line x1="440" y1="150" x2="560" y2="110" class="topology-edge ${isAff('payment-service')||isAff('database') ? 'topology-edge-active' : ''}" marker-end="url(#arrow)" />
            <!-- direct api-gateway -> database -->
            <path d="M 160 105 Q 360 105 560 100" fill="none" class="topology-edge ${isAff('api-gateway')||isAff('database') ? 'topology-edge-active' : ''}" stroke-dasharray="4,4" marker-end="url(#arrow)" />

            <!-- Node 1: api-gateway -->
            <g class="topology-node" onclick="nav('services')" transform="translate(40, 75)">
                <rect width="120" height="56" rx="8" fill="#101726" stroke="${isAff('api-gateway') ? '#f43f5e' : '#22324e'}" stroke-width="${isAff('api-gateway') ? '2' : '1.5'}" />
                <circle cx="20" cy="28" r="5" fill="${isAff('api-gateway') ? '#f43f5e' : '#10b981'}" />
                <text x="34" y="25" fill="#ffffff" font-size="12" font-weight="600">api-gateway</text>
                <text x="34" y="40" fill="#94a3b8" font-size="10">Edge Ingress</text>
            </g>

            <!-- Node 2: auth-service -->
            <g class="topology-node" onclick="nav('services')" transform="translate(310, 20)">
                <rect width="130" height="56" rx="8" fill="#101726" stroke="${isAff('auth-service') ? '#f43f5e' : '#22324e'}" stroke-width="${isAff('auth-service') ? '2' : '1.5'}" />
                <circle cx="20" cy="28" r="5" fill="${isAff('auth-service') ? '#f43f5e' : '#10b981'}" />
                <text x="34" y="25" fill="#ffffff" font-size="12" font-weight="600">auth-service</text>
                <text x="34" y="40" fill="#94a3b8" font-size="10">Security Tier</text>
            </g>

            <!-- Node 3: payment-service -->
            <g class="topology-node" onclick="nav('services')" transform="translate(310, 125)">
                <rect width="130" height="56" rx="8" fill="#101726" stroke="${isAff('payment-service') ? '#f43f5e' : '#22324e'}" stroke-width="${isAff('payment-service') ? '2' : '1.5'}" />
                <circle cx="20" cy="28" r="5" fill="${isAff('payment-service') ? '#f43f5e' : '#10b981'}" />
                <text x="34" y="25" fill="#ffffff" font-size="12" font-weight="600">payment-service</text>
                <text x="34" y="40" fill="#94a3b8" font-size="10">Transactions</text>
            </g>

            <!-- Node 4: database -->
            <g class="topology-node" onclick="nav('services')" transform="translate(570, 75)">
                <rect width="120" height="56" rx="8" fill="#101726" stroke="${isAff('database') ? '#f43f5e' : '#22324e'}" stroke-width="${isAff('database') ? '2' : '1.5'}" />
                <circle cx="20" cy="28" r="5" fill="${isAff('database') ? '#f43f5e' : '#10b981'}" />
                <text x="34" y="25" fill="#ffffff" font-size="12" font-weight="600">database</text>
                <text x="34" y="40" fill="#94a3b8" font-size="10">PostgreSQL Core</text>
            </g>
        </svg>
    `;
}

// -------------------------------------------------------------------------------------------------
// VIEW 2: SERVICES (TOPOLOGY & SERVICE CATALOG)
// -------------------------------------------------------------------------------------------------
async function renderServices(root, epoch) {
    const [statsRes, incRes] = await Promise.all([
        apiGet('/stats'),
        apiGet('/incidents?size=100')
    ]);

    const activeIncidents = incRes.items.filter(i => i.status !== 'resolved');
    const serviceCounts = statsRes.service_counts || {};

    // Defined microservices metadata
    const serviceCatalog = [
        {
            name: 'api-gateway',
            role: 'Reverse Proxy & Traffic Router',
            tier: 'Edge Ingress',
            upstream: ['Client Requests'],
            downstream: ['auth-service', 'payment-service', 'database'],
            description: 'Handles incoming HTTP traffic, rate limiting, and down-stream dispatching.'
        },
        {
            name: 'auth-service',
            role: 'Authentication & Session Service',
            tier: 'Application',
            upstream: ['api-gateway'],
            downstream: ['database'],
            description: 'Authenticates API tokens and verifies user credentials.'
        },
        {
            name: 'payment-service',
            role: 'Financial Transaction Processor',
            tier: 'Application',
            upstream: ['api-gateway'],
            downstream: ['database'],
            description: 'Processes credit cards and payment gateways with external providers.'
        },
        {
            name: 'database',
            role: 'Primary Relational Data Store',
            tier: 'Persistence',
            upstream: ['api-gateway', 'auth-service', 'payment-service'],
            downstream: [],
            description: 'Stores state, account records, and persistent transaction ledgers.'
        }
    ];

    const cardsHtml = serviceCatalog.map(svc => {
        const eventsCount = serviceCounts[svc.name] || 0;
        const matchingIncidents = activeIncidents.filter(i => (i.affected_services || []).includes(svc.name));
        const isAffected = matchingIncidents.length > 0;

        return `
            <div class="surface-card p-5 space-y-4 border-t-2 ${isAffected ? 'border-t-rose-500' : 'border-t-emerald-500'}">
                <div class="flex items-start justify-between">
                    <div>
                        <div class="flex items-center space-x-2">
                            <span class="beacon ${isAffected ? 'beacon-critical' : 'beacon-healthy'}"></span>
                            <h3 class="text-base font-semibold text-white font-mono">${svc.name}</h3>
                        </div>
                        <p class="text-xs text-slate-400 mt-1">${svc.role}</p>
                    </div>
                    <span class="badge ${isAffected ? 'badge-critical' : 'badge-healthy'}">
                        ${isAffected ? 'INCIDENT' : 'HEALTHY'}
                    </span>
                </div>

                <p class="text-xs text-slate-300 leading-relaxed">${svc.description}</p>

                <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-navy-700/60">
                    <div class="p-2 rounded bg-navy-850">
                        <span class="text-[10px] text-slate-400 block uppercase">Telemetry Events</span>
                        <span class="font-mono text-white font-semibold">${eventsCount.toLocaleString()}</span>
                    </div>
                    <div class="p-2 rounded bg-navy-850">
                        <span class="text-[10px] text-slate-400 block uppercase">Active Alerts</span>
                        <span class="font-mono font-semibold ${isAffected ? 'text-rose-400' : 'text-emerald-400'}">${matchingIncidents.length}</span>
                    </div>
                </div>

                <div class="space-y-1.5 text-xs text-slate-400">
                    <div>
                        <span class="text-slate-400 text-[11px] font-medium">Downstream Dependencies:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${svc.downstream.length ? svc.downstream.map(d => `<span class="badge badge-source">${d}</span>`).join('') : '<span class="text-slate-400 italic text-[11px]">None (Terminal Node)</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (epoch && epoch !== currentRenderEpoch) return;

    root.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-white">Monitored Service Topology</h2>
                    <p class="text-xs text-slate-400">4 microservices instrumented under synthetic telemetry generators.</p>
                </div>
                <button onclick="nav('overview')" class="btn-secondary text-xs">Back to Overview</button>
            </div>

            <!-- Service Catalog Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${cardsHtml}
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------------------------------------
// VIEW 3: ANOMALIES (ISOLATION FOREST DETECTOR)
// -------------------------------------------------------------------------------------------------
async function renderAnomalies(root, epoch) {
    let anomRes = { anomalies: [], total_analyzed_windows: 0 };
    try {
        anomRes = await apiGet('/anomalies');
    } catch (e) {
        try {
            await apiPost('/detect/fit', {});
            anomRes = await apiGet('/anomalies');
        } catch (_) {}
    }

    let allWindows = anomRes.anomalies || [];

    // Filter
    let displayed = anomalyFilterOnlyAnomalous ? allWindows.filter(w => w.is_anomalous) : allWindows;

    // Sort
    displayed.sort((a, b) => {
        let vA = anomalySortField === 'latency' ? (a.features.avg_latency || 0) :
                 anomalySortField === 'score' ? (a.score || 0) : new Date(a.window).getTime();
        let vB = anomalySortField === 'latency' ? (b.features.avg_latency || 0) :
                 anomalySortField === 'score' ? (b.score || 0) : new Date(b.window).getTime();
        return anomalySortDesc ? (vB - vA) : (vA - vB);
    });

    const rows = displayed.map((w, idx) => {
        const isAnom = w.is_anomalous;
        const latency = w.features.avg_latency || 0;
        const errors = w.features.error_count || 0;
        const warns = w.features.warn_count || 0;
        const score = (w.score || 0).toFixed(4);
        const windowDate = new Date(w.window).toLocaleString();

        const latencyColor = latency > 800 ? 'text-rose-400 font-bold' :
                             latency > 300 ? 'text-amber-400 font-semibold' : 'text-slate-300';

        return `
            <tr class="hover:bg-navy-800/40 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-slate-300">${windowDate}</td>
                <td class="px-4 py-3">
                    <span class="badge ${isAnom ? 'badge-critical' : 'badge-healthy'}">
                        ${isAnom ? 'ANOMALOUS' : 'NORMAL'}
                    </span>
                </td>
                <td class="px-4 py-3 font-mono text-xs ${latencyColor}">
                    ${latency.toFixed(1)} ms
                </td>
                <td class="px-4 py-3 font-mono text-xs">
                    <span class="${errors > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}">${errors} err</span> /
                    <span class="${warns > 0 ? 'text-amber-400' : 'text-slate-400'}">${warns} warn</span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-sky-400">${score}</td>
                <td class="px-4 py-3 text-right">
                    <button class="text-xs text-slate-400 hover:text-white font-mono" onclick="toggleFeatureInspect(${idx})">
                        inspect [+/-]
                    </button>
                </td>
            </tr>
            <tr id="inspect-row-${idx}" class="hidden bg-navy-950/80">
                <td colspan="6" class="p-4 border-b border-navy-700">
                    <div class="text-[11px] text-slate-400 font-mono mb-1">Raw Extracted Feature Vector:</div>
                    <pre class="bg-navy-900 p-3 rounded text-xs font-mono text-sky-300 overflow-x-auto border border-navy-700/60">${escapeHTML(JSON.stringify(w.features, null, 2))}</pre>
                </td>
            </tr>
        `;
    }).join('');

    if (epoch && epoch !== currentRenderEpoch) return;

    root.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <!-- Header Toolbar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-lg font-semibold text-white">Isolation Forest Detector (Unsupervised)</h2>
                    <p class="text-xs text-slate-400">Total Analyzed Windows: <span class="font-mono text-white">${anomRes.total_analyzed_windows || allWindows.length}</span> | Anomalies: <span class="font-mono text-rose-400">${allWindows.filter(w=>w.is_anomalous).length}</span></p>
                </div>
                <div class="flex items-center space-x-2">
                    <button id="btn-fit-detector" onclick="fitDetector()" class="btn-secondary text-xs">
                        ${icon('tool', 'w-3.5 h-3.5')}
                        <span>Refit Detector (/detect/fit)</span>
                    </button>
                </div>
            </div>

            <!-- Filter Controls -->
            <div class="surface-card p-4 flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center space-x-2 text-xs">
                    <span class="text-slate-400 font-medium">Filter:</span>
                    <button onclick="toggleAnomFilter(true)" class="tab-pill ${anomalyFilterOnlyAnomalous ? 'active' : ''}">
                        Anomalous Only (${allWindows.filter(w=>w.is_anomalous).length})
                    </button>
                    <button onclick="toggleAnomFilter(false)" class="tab-pill ${!anomalyFilterOnlyAnomalous ? 'active' : ''}">
                        All Windows (${allWindows.length})
                    </button>
                </div>

                <div class="flex items-center space-x-2 text-xs">
                    <span class="text-slate-400 font-medium">Sort By:</span>
                    <select onchange="changeAnomSort(this.value)" class="bg-navy-850 border border-navy-700 text-white rounded px-2.5 py-1 text-xs">
                        <option value="window" ${anomalySortField==='window'?'selected':''}>Window Timestamp</option>
                        <option value="latency" ${anomalySortField==='latency'?'selected':''}>Avg Latency</option>
                        <option value="score" ${anomalySortField==='score'?'selected':''}>Anomaly Score</option>
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div class="surface-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="sre-table">
                        <thead>
                            <tr>
                                <th>Window Timestamp</th>
                                <th>Classification</th>
                                <th>Avg Latency</th>
                                <th>Error / Warn Rates</th>
                                <th>Isolation Score</th>
                                <th class="text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length ? rows : `<tr><td colspan="6" class="text-center py-8 text-slate-400 font-mono text-xs">No records matching active filter.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    window.toggleFeatureInspect = (idx) => {
        const el = document.getElementById(`inspect-row-${idx}`);
        if (el) el.classList.toggle('hidden');
    };

    window.toggleAnomFilter = (onlyAnom) => {
        anomalyFilterOnlyAnomalous = onlyAnom;
        render();
    };

    window.changeAnomSort = (field) => {
        anomalySortField = field;
        render();
    };

    window.fitDetector = async () => {
        const btn = document.getElementById('btn-fit-detector');
        if (btn) btn.disabled = true;
        showToast('Fitting Isolation Forest on telemetry...', 'info');
        try {
            const res = await apiPost('/detect/fit', {});
            showToast(`Detector fitted: ${res.windows_analyzed} windows analyzed`, 'success');
            render();
        } catch (e) {
            showToast(`Fit failed: ${e.message}`, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    };
}

// -------------------------------------------------------------------------------------------------
// VIEW 4: INCIDENTS (CORRELATED INCIDENTS)
// -------------------------------------------------------------------------------------------------
async function renderIncidents(root, epoch) {
    const incRes = await apiGet('/incidents?size=100');
    incidents = incRes.items || [];

    // Apply filters
    let filtered = incidents.filter(i => {
        if (incidentStatusFilter !== 'all' && i.status !== incidentStatusFilter) return false;
        if (incidentSeverityFilter !== 'all' && i.severity !== incidentSeverityFilter) return false;
        if (incidentSearchQuery) {
            const q = incidentSearchQuery.toLowerCase();
            const idMatch = i.id.toLowerCase().includes(q);
            const svcMatch = (i.affected_services || []).some(s => s.toLowerCase().includes(q));
            if (!idMatch && !svcMatch) return false;
        }
        return true;
    });

    const rows = filtered.map(inc => {
        const sevClass = inc.severity === 'critical' ? 'badge-critical' :
                         inc.severity === 'high' ? 'badge-high' :
                         inc.severity === 'medium' ? 'badge-medium' : 'badge-low';
        const topCause = inc.root_cause_candidates.length ? inc.root_cause_candidates[0].service : 'Under Triage';
        const durationMin = Math.round((inc.duration_seconds || 0) / 60);

        return `
            <tr class="hover:bg-navy-800/40 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-sky-400 font-semibold cursor-pointer" onclick="nav('investigations', '${escapeHTML(inc.id)}')">
                    ${escapeHTML(inc.id.substring(0, 8))}...
                </td>
                <td class="px-4 py-3"><span class="badge ${sevClass}">${escapeHTML(inc.severity)}</span></td>
                <td class="px-4 py-3">
                    <select onchange="updateIncidentStatus('${escapeHTML(inc.id)}', this.value)" class="bg-navy-850 border border-navy-700 text-xs rounded px-2 py-1 font-mono text-slate-200">
                        <option value="open" ${inc.status==='open'?'selected':''}>Open</option>
                        <option value="acknowledged" ${inc.status==='acknowledged'?'selected':''}>Acknowledged</option>
                        <option value="resolved" ${inc.status==='resolved'?'selected':''}>Resolved</option>
                    </select>
                </td>
                <td class="px-4 py-3">
                    <span class="font-mono text-xs text-white font-semibold">${escapeHTML(topCause)}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                        ${(inc.affected_services || []).map(s => `<span class="badge badge-source">${s}</span>`).join('')}
                    </div>
                </td>
                <td class="px-4 py-3 text-xs text-slate-400 font-mono">${durationMin} min</td>
                <td class="px-4 py-3 text-right space-x-2">
                    <button class="btn-primary text-xs py-1 px-3" onclick="nav('investigations', '${escapeHTML(inc.id)}')">
                        ${icon('brain', 'w-3.5 h-3.5')}
                        <span>AI Triage</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (epoch && epoch !== currentRenderEpoch) return;

    root.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-lg font-semibold text-white">Correlated Incident Clusters</h2>
                    <p class="text-xs text-slate-400">Total Incidents: <span class="font-mono text-white">${incidents.length}</span> | Filtered: <span class="font-mono text-sky-400">${filtered.length}</span></p>
                </div>
            </div>

            <!-- Filter Controls -->
            <div class="surface-card p-4 flex flex-wrap items-center justify-between gap-4">
                <div class="flex flex-wrap items-center gap-3">
                    <!-- Status Filter -->
                    <div class="flex items-center space-x-1.5 text-xs">
                        <span class="text-slate-400 font-medium">Status:</span>
                        <select onchange="filterIncidents('status', this.value)" class="bg-navy-850 border border-navy-700 text-white rounded px-2.5 py-1 text-xs font-mono">
                            <option value="all" ${incidentStatusFilter==='all'?'selected':''}>All</option>
                            <option value="open" ${incidentStatusFilter==='open'?'selected':''}>Open</option>
                            <option value="acknowledged" ${incidentStatusFilter==='acknowledged'?'selected':''}>Acknowledged</option>
                            <option value="resolved" ${incidentStatusFilter==='resolved'?'selected':''}>Resolved</option>
                        </select>
                    </div>

                    <!-- Severity Filter -->
                    <div class="flex items-center space-x-1.5 text-xs">
                        <span class="text-slate-400 font-medium">Severity:</span>
                        <select onchange="filterIncidents('severity', this.value)" class="bg-navy-850 border border-navy-700 text-white rounded px-2.5 py-1 text-xs font-mono">
                            <option value="all" ${incidentSeverityFilter==='all'?'selected':''}>All</option>
                            <option value="critical" ${incidentSeverityFilter==='critical'?'selected':''}>Critical</option>
                            <option value="high" ${incidentSeverityFilter==='high'?'selected':''}>High</option>
                            <option value="medium" ${incidentSeverityFilter==='medium'?'selected':''}>Medium</option>
                            <option value="low" ${incidentSeverityFilter==='low'?'selected':''}>Low</option>
                        </select>
                    </div>
                </div>

                <!-- Search Input -->
                <div class="relative w-full sm:w-64">
                    <input type="text" placeholder="Search by ID or service..." value="${escapeHTML(incidentSearchQuery)}" oninput="filterIncidents('search', this.value)" class="w-full bg-navy-850 border border-navy-700 text-white text-xs rounded pl-8 pr-3 py-1.5 focus:border-sky-400 focus:outline-none font-mono">
                    <span class="absolute left-2.5 top-2 text-slate-400">${icon('search', 'w-3.5 h-3.5')}</span>
                </div>
            </div>

            <!-- Table -->
            <div class="surface-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="sre-table">
                        <thead>
                            <tr>
                                <th>Incident ID</th>
                                <th>Severity</th>
                                <th>Status</th>
                                <th>Ranked Root Cause</th>
                                <th>Affected Services</th>
                                <th>Duration</th>
                                <th class="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length ? rows : `<tr><td colspan="7" class="text-center py-8 text-slate-400 font-mono text-xs">No incidents matching active query.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    window.filterIncidents = (type, val) => {
        if (type === 'status') incidentStatusFilter = val;
        if (type === 'severity') incidentSeverityFilter = val;
        if (type === 'search') incidentSearchQuery = val;
        render();
    };

    window.updateIncidentStatus = async (id, status) => {
        try {
            await apiPatch(`/incidents/${id}/status`, { status });
            showToast(`Incident ${id.substring(0, 8)} status -> ${status}`, 'success');
            render();
        } catch (e) {
            showToast(`Update failed: ${e.message}`, 'error');
        }
    };
}

// -------------------------------------------------------------------------------------------------
// VIEW 5: KNOWLEDGE BASE (RAG VECTOR SEARCH)
// -------------------------------------------------------------------------------------------------
async function renderKnowledge(root, epoch) {
    const rag = await apiGet('/knowledge/status');
    if (epoch && epoch !== currentRenderEpoch) return;
    knowledgeStatus = rag;

    root.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <!-- Header & Index Status Card -->
            <div class="surface-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="space-y-1">
                    <div class="flex items-center space-x-2">
                        ${icon('book', 'w-5 h-5 text-sky-400')}
                        <h2 class="text-base font-semibold text-white">Operational Runbook Knowledge Base</h2>
                    </div>
                    <p class="text-xs text-slate-400">Indexed standard operating procedures, outage runbooks, and telemetry recovery playbooks.</p>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="p-2.5 rounded bg-navy-850 border border-navy-700/60 text-xs font-mono space-y-1">
                        <div class="flex items-center space-x-2">
                            <span class="text-slate-400">Chunks:</span>
                            <span class="text-white font-bold">${rag.chunks_indexed || 0}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="text-slate-400">Mode:</span>
                            <span class="${rag.is_embedded ? 'text-sky-300' : 'text-amber-300'} font-semibold">${rag.is_embedded ? 'Ollama Semantic' : 'TF-IDF Keyword'}</span>
                        </div>
                    </div>
                    <button id="btn-reindex-rag" onclick="reindexKnowledge()" class="btn-secondary text-xs">
                        ${icon('refresh', 'w-3.5 h-3.5')}
                        <span>Rebuild Index</span>
                    </button>
                </div>
            </div>

            <!-- Search Panel -->
            <div class="surface-card p-4 sm:p-5 space-y-4">
                <h3 class="text-sm font-semibold text-white">Semantic Knowledge Retrieval</h3>
                <div class="flex flex-col sm:flex-row gap-3">
                    <div class="relative flex-1">
                        <input type="text" id="rag-search-input" placeholder="e.g. database connection pool timeout, payment gateway timeout..." class="w-full bg-navy-850 border border-navy-700 text-white text-sm rounded pl-9 pr-3 py-2 focus:border-sky-400 focus:outline-none font-mono">
                        <span class="absolute left-3 top-2.5 text-slate-400">${icon('search', 'w-4 h-4')}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <select id="rag-topk" class="bg-navy-850 border border-navy-700 text-white rounded px-3 py-2 text-xs font-mono">
                            <option value="3">Top 3 Chunks</option>
                            <option value="5">Top 5 Chunks</option>
                            <option value="1">Top 1 Chunk</option>
                        </select>
                        <button onclick="executeKnowledgeSearch()" id="btn-rag-submit" class="btn-primary text-xs py-2 px-4">
                            <span>Execute Search</span>
                        </button>
                    </div>
                </div>

                <div class="flex items-center space-x-2 text-xs text-slate-400">
                    <label class="flex items-center space-x-1.5 cursor-pointer">
                        <input type="checkbox" id="rag-force-keyword" class="rounded bg-navy-850 border-navy-700 text-sky-500">
                        <span>Force Keyword Baseline (TF-IDF fallback)</span>
                    </label>
                </div>

                <!-- Results Output Area -->
                <div id="rag-search-results" class="space-y-3 pt-2">
                    <div class="p-8 text-center text-slate-400 text-xs border border-dashed border-navy-700/60 rounded">
                        Enter a technical query above to retrieve relevant SRE runbook procedures.
                    </div>
                </div>
            </div>
        </div>
    `;

    window.executeKnowledgeSearch = async () => {
        const input = document.getElementById('rag-search-input');
        const topK = parseInt(document.getElementById('rag-topk').value || '3');
        const forceKw = document.getElementById('rag-force-keyword').checked;
        const resDiv = document.getElementById('rag-search-results');
        const btn = document.getElementById('btn-rag-submit');

        const query = input.value.trim();
        if (!query) {
            showToast('Please enter a search query', 'info');
            return;
        }

        btn.disabled = true;
        resDiv.innerHTML = `
            <div class="p-8 flex items-center justify-center space-x-2 text-slate-400 text-xs font-mono">
                <svg class="w-4 h-4 sre-spinner text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                <span>Searching local vector index...</span>
            </div>
        `;

        try {
            const resp = await apiPost('/knowledge/search', {
                query,
                top_k: topK,
                use_keyword_baseline: forceKw
            });

            if (!resp.results || resp.results.length === 0) {
                resDiv.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs border border-navy-700 rounded">No matching runbook sections found for query: "${escapeHTML(query)}"</div>`;
                return;
            }

            resDiv.innerHTML = resp.results.map((r, i) => `
                <div class="surface-raised p-4 space-y-2 border-l-2 border-l-sky-500">
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center space-x-2">
                            <span class="font-mono text-sky-300 font-semibold">${i + 1}. ${escapeHTML(r.title)}</span>
                            <span class="text-slate-400">/</span>
                            <span class="text-slate-300 font-medium">${escapeHTML(r.heading)}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="badge ${r.method==='semantic'?'badge-low':'badge-source'}">${escapeHTML(r.method)}</span>
                            <span class="audit-pill text-slate-300">score: ${r.score.toFixed(3)}</span>
                        </div>
                    </div>
                    <div class="text-xs text-slate-300 font-mono bg-navy-950/80 p-3 rounded leading-relaxed border border-navy-700/40">
                        ${escapeHTML(r.text)}
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                        <span>Chunk ID: ${escapeHTML(r.chunk_id)}</span>
                        <span>File: ${escapeHTML(r.source_path)}</span>
                    </div>
                </div>
            `).join('');

        } catch (e) {
            resDiv.innerHTML = `<div class="p-4 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">Search error: ${escapeHTML(e.message)}</div>`;
        } finally {
            btn.disabled = false;
        }
    };

    window.reindexKnowledge = async () => {
        const btn = document.getElementById('btn-reindex-rag');
        if (btn) btn.disabled = true;
        showToast('Rebuilding vector index...', 'info');
        try {
            const resp = await apiPost('/knowledge/index', {});
            showToast(`Reindex complete: ${resp.chunks_indexed} chunks indexed`, 'success');
            render();
        } catch (e) {
            showToast(`Reindex failed: ${e.message}`, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    };
}

// -------------------------------------------------------------------------------------------------
// VIEW 6: AI INVESTIGATIONS (THE SIGNATURE FEATURE)
// -------------------------------------------------------------------------------------------------
async function renderInvestigations(root, epoch) {
    const incRes = await apiGet('/incidents?size=100');
    incidents = incRes.items || [];

    if (!incidents.length) {
        if (epoch && epoch !== currentRenderEpoch) return;
        root.innerHTML = `
            <div class="surface-card p-8 text-center text-slate-400 space-y-3 max-w-xl mx-auto my-12">
                ${icon('alert', 'w-8 h-8 mx-auto text-amber-400')}
                <h3 class="text-white font-semibold text-base">No Incidents Available to Investigate</h3>
                <p class="text-xs">Run the telemetry simulator or wait for the detector to identify anomalous clusters.</p>
            </div>
        `;
        return;
    }

    // Default selection
    if (!selectedIncidentId || !incidents.find(i => i.id === selectedIncidentId)) {
        selectedIncidentId = incidents[0].id;
    }

    const currentInc = incidents.find(i => i.id === selectedIncidentId) || incidents[0];

    // Left List Items
    const incidentItemsHtml = incidents.map(inc => {
        const isSelected = inc.id === selectedIncidentId;
        const sevClass = inc.severity === 'critical' ? 'badge-critical' :
                         inc.severity === 'high' ? 'badge-high' :
                         inc.severity === 'medium' ? 'badge-medium' : 'badge-low';

        return `
            <div onclick="selectInvestigationIncident('${escapeHTML(inc.id)}')" class="p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-navy-800 border-sky-500 shadow-md' : 'bg-navy-850/60 border-navy-700/60 hover:bg-navy-800/40'}">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="font-mono text-xs font-semibold ${isSelected ? 'text-sky-300' : 'text-slate-200'}">${escapeHTML(inc.id.substring(0, 8))}...</span>
                    <span class="badge ${sevClass}">${escapeHTML(inc.severity)}</span>
                </div>
                <div class="text-[11px] text-slate-400 truncate mb-1">
                    Affects: <span class="text-slate-300 font-mono">${(inc.affected_services || []).join(', ')}</span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span class="capitalize">${escapeHTML(inc.status)}</span>
                    <span>${Math.round((inc.duration_seconds || 0) / 60)} min</span>
                </div>
            </div>
        `;
    }).join('');

    // Deterministic Candidates List
    const deterministicCandidatesHtml = (currentInc.root_cause_candidates || []).map((c, idx) => `
        <div class="surface-raised p-3 text-xs space-y-1">
            <div class="flex items-center justify-between">
                <span class="font-mono font-semibold text-white">#${idx + 1} ${escapeHTML(c.service)}</span>
                <span class="audit-pill text-sky-400">Score: ${c.score.toFixed(2)}</span>
            </div>
            <div class="text-slate-400 text-[11px]">
                Evidence: <span class="text-slate-300">${escapeHTML((c.evidence || []).join(' | '))}</span>
            </div>
        </div>
    `).join('');

    if (epoch && epoch !== currentRenderEpoch) return;

    root.innerHTML = `
        <div class="space-y-6 max-w-7xl mx-auto">
            <!-- Master-Detail Split Pane Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                <!-- Left Column: Incident Selector (4 cols) -->
                <div class="lg:col-span-4 surface-card p-4 space-y-4">
                    <div class="flex items-center justify-between border-b border-navy-700/60 pb-3">
                        <div class="flex items-center space-x-2">
                            ${icon('alert', 'w-4 h-4 text-sky-400')}
                            <h3 class="text-sm font-semibold text-white">Select Incident</h3>
                        </div>
                        <span class="text-xs font-mono text-slate-400">${incidents.length} total</span>
                    </div>

                    <div class="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                        ${incidentItemsHtml}
                    </div>
                </div>

                <!-- Right Column: Active Investigation Console (8 cols) -->
                <div class="lg:col-span-8 space-y-6">

                    <!-- 1. Incident Context Header Card -->
                    <div class="surface-card p-4 sm:p-5 space-y-4 border-l-4 ${currentInc.severity==='critical'?'border-l-rose-500':'border-l-amber-500'}">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div class="flex items-center space-x-2">
                                    <h2 class="text-base font-bold text-white font-mono">Incident ${escapeHTML(currentInc.id)}</h2>
                                    <span class="badge ${currentInc.severity==='critical'?'badge-critical':currentInc.severity==='high'?'badge-high':'badge-medium'}">${escapeHTML(currentInc.severity)}</span>
                                </div>
                                <p class="text-xs text-slate-400 mt-1">First Observed: ${new Date(currentInc.first_observed).toLocaleString()} | Last: ${new Date(currentInc.last_observed).toLocaleString()}</p>
                            </div>

                            <!-- Lifecycle status actions -->
                            <div class="flex items-center space-x-2">
                                <button onclick="updateInvestigationStatus('${escapeHTML(currentInc.id)}', 'acknowledged')" class="btn-secondary text-xs">
                                    Acknowledge
                                </button>
                                <button onclick="updateInvestigationStatus('${escapeHTML(currentInc.id)}', 'resolved')" class="btn-secondary text-xs text-emerald-300 border-emerald-800 hover:border-emerald-600">
                                    Resolve
                                </button>
                            </div>
                        </div>

                        <!-- Affected services & duration -->
                        <div class="flex flex-wrap items-center gap-3 text-xs pt-2 border-t border-navy-700/60">
                            <div>
                                <span class="text-slate-400 font-medium">Affected Services:</span>
                                <span class="font-mono text-white font-semibold ml-1">${(currentInc.affected_services || []).join(', ')}</span>
                            </div>
                            <span class="text-navy-700">|</span>
                            <div>
                                <span class="text-slate-400 font-medium">Duration:</span>
                                <span class="font-mono text-white ml-1">${Math.round((currentInc.duration_seconds || 0) / 60)} minutes</span>
                            </div>
                            <span class="text-navy-700">|</span>
                            <div>
                                <span class="text-slate-400 font-medium">Anomalies:</span>
                                <span class="font-mono text-white ml-1">${currentInc.anomaly_window_count || 0} windows</span>
                            </div>
                        </div>

                        <!-- Deterministic Root Cause Summary -->
                        <div class="space-y-2 pt-2">
                            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Deterministic Correlation Engine Ranking:</div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                ${deterministicCandidatesHtml}
                            </div>
                        </div>
                    </div>

                    <!-- 2. AI Investigation Trigger Console -->
                    <div class="surface-card p-4 sm:p-5 space-y-4">
                        <div class="flex items-center justify-between border-b border-navy-700/60 pb-3">
                            <div class="flex items-center space-x-2">
                                ${icon('brain', 'w-5 h-5 text-sky-400')}
                                <h3 class="text-sm font-semibold text-white">Autonomous AI Investigation Agent</h3>
                            </div>
                            <span class="badge badge-source">qwen3.5:2b (Local)</span>
                        </div>

                        <div class="space-y-3">
                            <label class="text-xs text-slate-300 font-medium block">Investigation Objective / SRE Question:</label>
                            <input type="text" id="investigation-query" value="Analyze this incident, identify the root cause, and cite evidence from telemetry and runbooks." class="w-full bg-navy-850 border border-navy-700 text-white text-xs rounded px-3 py-2.5 focus:border-sky-400 focus:outline-none font-mono">

                            <!-- Preset Query Pills -->
                            <div class="flex flex-wrap gap-2 text-[11px]">
                                <span class="text-slate-400">Presets:</span>
                                <button onclick="setQueryPreset('Deep Root Cause Analysis & Cascade Assessment')" class="tab-pill py-0.5 px-2 text-[11px]">Deep Root Cause</button>
                                <button onclick="setQueryPreset('Identify Downstream Failure Domain and Runbook Playbook')" class="tab-pill py-0.5 px-2 text-[11px]">Remediation Playbook</button>
                                <button onclick="setQueryPreset('Evaluate Payment Service vs Database Outage Probability')" class="tab-pill py-0.5 px-2 text-[11px]">Database vs Payment</button>
                            </div>

                            <div class="pt-2">
                                <button id="btn-run-investigation" onclick="runAIInvestigation('${escapeHTML(currentInc.id)}')" class="btn-primary text-xs py-2 px-5">
                                    ${icon('play', 'w-3.5 h-3.5')}
                                    <span>Launch Autonomous AI Triage</span>
                                </button>
                            </div>
                        </div>

                        <!-- Progress / Live State Indicator -->
                        <div id="investigation-spinner" class="hidden p-6 rounded-lg bg-navy-850 border border-navy-700 space-y-3 text-center">
                            <div class="flex items-center justify-center space-x-2 text-sky-400">
                                <svg class="w-5 h-5 sre-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                                <span class="text-xs font-mono font-semibold tracking-wide">Executing Investigation Agent Workflow...</span>
                            </div>
                            <div class="text-[11px] text-slate-400 font-mono space-y-1">
                                <div>Step 1: Code-controlled tool execution (get_incident, anomalies, dependencies)</div>
                                <div>Step 2: Retrieving semantic runbook context from vector database</div>
                                <div>Step 3: Synthesizing grounded report with structured citation registry...</div>
                            </div>
                        </div>

                        <!-- Investigation Result Area -->
                        <div id="investigation-output" class="space-y-4 ${lastInvestigationReport ? '' : 'hidden'}">
                            ${lastInvestigationReport ? renderReportCard(lastInvestigationReport) : ''}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;

    window.selectInvestigationIncident = (id) => {
        selectedIncidentId = id;
        lastInvestigationReport = null; // reset for new incident
        render();
    };

    window.setQueryPreset = (q) => {
        const input = document.getElementById('investigation-query');
        if (input) input.value = q;
    };

    window.updateInvestigationStatus = async (id, status) => {
        try {
            await apiPatch(`/incidents/${id}/status`, { status });
            showToast(`Incident status updated to ${status}`, 'success');
            render();
        } catch (e) {
            showToast(`Status update failed: ${e.message}`, 'error');
        }
    };

    window.runAIInvestigation = async (incId) => {
        const btn = document.getElementById('btn-run-investigation');
        const spinner = document.getElementById('investigation-spinner');
        const output = document.getElementById('investigation-output');
        const query = document.getElementById('investigation-query').value.trim() || 'Analyze incident.';

        btn.disabled = true;
        spinner.classList.remove('hidden');
        output.classList.add('hidden');
        output.innerHTML = '';

        try {
            const report = await apiPost('/investigations', {
                incident_id: incId,
                question: query
            });

            lastInvestigationReport = report;
            output.innerHTML = renderReportCard(report);
            output.classList.remove('hidden');
            showToast('AI Investigation report generated', 'success');
        } catch (err) {
            output.innerHTML = `
                <div class="p-4 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs space-y-2">
                    <div class="font-bold flex items-center space-x-1">
                        ${icon('alert', 'w-4 h-4 text-rose-400')}
                        <span>AI Investigation Failed</span>
                    </div>
                    <p class="font-mono">${escapeHTML(err.message)}</p>
                </div>
            `;
            output.classList.remove('hidden');
            showToast(`Investigation error: ${err.message}`, 'error');
        } finally {
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    };
}

// Helper: Formatter for the AI Investigation Report
function renderReportCard(report) {
    const isSuccess = report.status === 'success';
    const statusClass = isSuccess ? 'badge-healthy' : 'badge-critical';

    // 1. Observed Facts
    const factsHtml = (report.observed_facts || []).map(f => `
        <li class="flex items-start space-x-2 text-xs text-slate-300">
            <span class="text-emerald-400 shrink-0 mt-0.5">${icon('check', 'w-3.5 h-3.5')}</span>
            <span>${escapeHTML(f)}</span>
        </li>
    `).join('');

    // 2. Ranked Root Cause Hypotheses
    const causesHtml = (report.ranked_root_causes || []).map((rc, i) => `
        <div class="p-3 rounded-lg bg-navy-850 border border-navy-700/70 space-y-1">
            <div class="flex items-center justify-between text-xs">
                <span class="font-mono font-semibold text-white">Hypothesis #${i + 1}</span>
                <span class="audit-pill text-sky-400">Confidence: ${escapeHTML(report.confidence || 'high')}</span>
            </div>
            <p class="text-xs text-slate-300 font-mono">${escapeHTML(rc)}</p>
        </div>
    `).join('');

    // 3. Evidence Citations
    const evidenceHtml = (report.evidence_for || []).map(ev => `
        <div class="p-3 rounded bg-navy-900 border border-navy-700/60 text-xs space-y-1">
            <div class="flex items-center justify-between">
                <span class="badge badge-source">${escapeHTML(ev.source_type)}</span>
                <span class="font-mono text-[11px] text-slate-400">ID: ${escapeHTML(ev.source_id)}</span>
            </div>
            <p class="text-slate-300">${escapeHTML(ev.description)}</p>
        </div>
    `).join('');

    // 4. Recommendations
    const stepsHtml = (report.recommended_steps || []).map((step, i) => `
        <div class="flex items-start space-x-2.5 text-xs text-slate-300">
            <span class="w-5 h-5 rounded-full bg-sky-950 border border-sky-600/60 text-sky-300 font-mono text-[11px] flex items-center justify-center shrink-0 font-bold">${i + 1}</span>
            <span class="pt-0.5">${escapeHTML(step)}</span>
        </div>
    `).join('');

    // 5. Audit Log Rows
    const auditRowsHtml = (report.tool_call_audit || []).map((item, idx) => {
        const isOk = item.status === 'success';
        const dur = typeof item.duration === 'number' ? `${(item.duration * 1000).toFixed(1)}ms` : item.duration;
        return `
            <tr class="hover:bg-navy-800/40 font-mono text-xs">
                <td class="px-3 py-2 text-sky-300 font-semibold">${escapeHTML(item.tool)}</td>
                <td class="px-3 py-2 text-slate-400">${escapeHTML(item.source || 'system')}</td>
                <td class="px-3 py-2">
                    <span class="px-1.5 py-0.2 rounded text-[10px] ${isOk ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}">
                        ${escapeHTML(item.status)}
                    </span>
                </td>
                <td class="px-3 py-2 text-slate-300">${dur}</td>
                <td class="px-3 py-2 text-slate-400 truncate max-w-xs">${escapeHTML(JSON.stringify(item.arguments || {}))}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="surface-card p-4 sm:p-5 space-y-6 border border-sky-500/40 shadow-lg">

            <!-- Report Status Banner -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700/60 pb-4">
                <div class="flex items-center space-x-2">
                    <span class="beacon ${isSuccess ? 'beacon-healthy' : 'beacon-critical'}"></span>
                    <h3 class="text-base font-bold text-white tracking-wide">Investigation Report</h3>
                    <span class="badge ${statusClass}">${escapeHTML(report.status)}</span>
                </div>
                <div class="flex items-center space-x-2 font-mono text-xs text-slate-400">
                    <span>Model: <span class="text-white">${escapeHTML(report.model_identifier)}</span></span>
                    <span class="text-navy-700">|</span>
                    <span>Retrieval: <span class="text-sky-300">${escapeHTML(report.retrieval_mode)}</span></span>
                </div>
            </div>

            <!-- Executive Summary -->
            <div class="p-4 rounded-lg bg-navy-850/80 border border-navy-700 space-y-1.5">
                <div class="text-[11px] font-mono text-sky-400 font-semibold uppercase tracking-wider">Executive SRE Summary:</div>
                <p class="text-sm text-slate-200 leading-relaxed">${escapeHTML(report.summary)}</p>
            </div>

            <!-- Observed Facts -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Observed Telemetry Facts:</h4>
                <ul class="space-y-1.5 p-3 rounded bg-navy-900 border border-navy-700/50">
                    ${factsHtml || '<li class="text-xs text-slate-400">No telemetry facts specified.</li>'}
                </ul>
            </div>

            <!-- Ranked Root Causes -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ranked Root-Cause Hypotheses:</h4>
                    <span class="text-[11px] text-amber-400">Operator Verification Required</span>
                </div>
                <div class="space-y-2">
                    ${causesHtml}
                </div>
            </div>

            <!-- Evidence Citations Explorer -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verified Structured Evidence Citations:</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${evidenceHtml || '<div class="text-xs text-slate-400 col-span-2">No direct citations recorded.</div>'}
                </div>
            </div>

            <!-- Runbook References -->
            ${report.runbook_references && report.runbook_references.length ? `
                <div class="space-y-1.5">
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Retrieved Runbook References:</h4>
                    <div class="flex flex-wrap gap-1.5">
                        ${report.runbook_references.map(r => `<span class="badge badge-source">${escapeHTML(r)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Recommended Next Steps -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recommended Remediation Workflow:</h4>
                <div class="p-3.5 rounded bg-navy-900 border border-navy-700/60 space-y-2.5">
                    ${stepsHtml || '<div class="text-xs text-slate-400">Review system logs and follow on-call checklist.</div>'}
                </div>
            </div>

            <!-- Uncertainty / Limitations Callout -->
            <div class="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/60 space-y-1 text-xs">
                <div class="flex items-center space-x-1.5 text-amber-300 font-semibold">
                    ${icon('alert', 'w-4 h-4 text-amber-400')}
                    <span>Remaining Uncertainty & Limitations:</span>
                </div>
                <p class="text-amber-200/80 leading-relaxed pl-5">${escapeHTML(report.remaining_uncertainty)}</p>
            </div>

            <!-- Expandable Tool-Call Audit Trail -->
            <div class="pt-2 border-t border-navy-700/60">
                <button onclick="document.getElementById('audit-table-container').classList.toggle('hidden')" class="flex items-center justify-between w-full text-xs font-mono text-slate-400 hover:text-white py-1">
                    <span class="flex items-center space-x-2">
                        ${icon('tool', 'w-3.5 h-3.5')}
                        <span>Technical Tool-Call Audit Log (${(report.tool_call_audit || []).length} steps)</span>
                    </span>
                    <span>Toggle Audit [+/-]</span>
                </button>
                <div id="audit-table-container" class="hidden mt-3 overflow-hidden rounded border border-navy-700">
                    <table class="sre-table text-xs">
                        <thead>
                            <tr>
                                <th>Tool</th>
                                <th>Source</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Arguments</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${auditRowsHtml || '<tr><td colspan="5" class="p-3 text-center text-slate-400">No tool executions recorded.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;
}

// -------------------------------------------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------------------------------------------
function initApp() {
    initSidebar();
    checkHealth();
    render();
    setInterval(checkHealth, 12000);
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
