function escapeHTML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
const API_BASE = ""; 

// State
let currentView = 'overview';
let incidents = [];
let anomalies = [];
let stats = {};
let knowledgeStatus = {};

// Helper: Fetch
async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

// Polling for health
async function checkHealth() {
    try {
        await apiGet('/health');
        document.getElementById('dot-backend').className = "w-2 h-2 rounded-full bg-green-500";
    } catch {
        document.getElementById('dot-backend').className = "w-2 h-2 rounded-full bg-red-500";
    }
    
    try {
        const rag = await apiGet('/knowledge/status');
        document.getElementById('dot-rag').className = rag.is_embedded ? "w-2 h-2 rounded-full bg-blue-500" : "w-2 h-2 rounded-full bg-yellow-500";
        knowledgeStatus = rag;
    } catch {
        document.getElementById('dot-rag').className = "w-2 h-2 rounded-full bg-red-500";
    }
}

// Navigation
function nav(view) {
    currentView = view;
    ['overview', 'services', 'anomalies', 'incidents', 'knowledge'].forEach(v => {
        document.getElementById(`nav-${v}`).classList.remove('text-white', 'border-b-2', 'border-blue-400');
        document.getElementById(`nav-${v}`).classList.add('text-slate-400');
    });
    document.getElementById(`nav-${view}`).classList.add('text-white', 'border-b-2', 'border-blue-400');
    document.getElementById(`nav-${view}`).classList.remove('text-slate-400');
    
    render();
}

// Router
async function render() {
    const root = document.getElementById('app-content');
    root.innerHTML = '<div class="flex justify-center mt-10"><i class="fas fa-spinner fa-spin text-2xl text-slate-500"></i></div>';
    
    try {
        if (currentView === 'overview') await renderOverview(root);
        if (currentView === 'services') await renderServices(root);
        if (currentView === 'anomalies') await renderAnomalies(root);
        if (currentView === 'incidents') await renderIncidents(root);
        if (currentView === 'knowledge') await renderKnowledge(root);
    } catch (e) {
        root.innerHTML = `<div class="bg-red-900/30 border border-red-700 text-red-200 p-4 rounded">${escapeHTML(e.message)}</div>`;
    }
}

// Views
async function renderOverview(root) {
    stats = await apiGet('/stats');
    const incRes = await apiGet('/incidents?size=100');
    
    const totalIncidents = incRes.total;
    const openIncidents = incRes.items.filter(i => i.status === 'open').length;
    const ackIncidents = incRes.items.filter(i => i.status === 'acknowledged').length;
    const resIncidents = incRes.items.filter(i => i.status === 'resolved').length;
    
    const statusChart = `
        <div class="mt-4">
            <h4 class="text-xs text-slate-400 mb-1">Incident Status</h4>
            <div class="w-full bg-slate-700 h-2 rounded flex overflow-hidden">
                <div class="bg-red-500 h-full" style="width: ${totalIncidents ? (openIncidents/totalIncidents)*100 : 0}%"></div>
                <div class="bg-yellow-500 h-full" style="width: ${totalIncidents ? (ackIncidents/totalIncidents)*100 : 0}%"></div>
                <div class="bg-green-500 h-full" style="width: ${totalIncidents ? (resIncidents/totalIncidents)*100 : 0}%"></div>
            </div>
            <div class="flex space-x-3 text-xs mt-2">
                <span class="text-red-400"><i class="fas fa-circle text-[8px] mr-1"></i>Open (${openIncidents})</span>
                <span class="text-yellow-400"><i class="fas fa-circle text-[8px] mr-1"></i>Ack (${ackIncidents})</span>
                <span class="text-green-400"><i class="fas fa-circle text-[8px] mr-1"></i>Resolved (${resIncidents})</span>
            </div>
        </div>
    `;

    root.innerHTML = `
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-slate-800 border border-slate-700 p-4 rounded shadow-sm">
                <div class="text-xs text-slate-400 uppercase font-semibold">Total Events</div>
                <div class="text-2xl text-white mt-1">${stats.total_events}</div>
            </div>
            <div class="bg-slate-800 border border-slate-700 p-4 rounded shadow-sm">
                <div class="text-xs text-slate-400 uppercase font-semibold">Total Incidents</div>
                <div class="text-2xl text-blue-400 mt-1">${totalIncidents}</div>
                ${statusChart}
            </div>
            <div class="bg-slate-800 border border-slate-700 p-4 rounded shadow-sm">
                <div class="text-xs text-slate-400 uppercase font-semibold">Affected Services</div>
                <div class="text-2xl text-white mt-1">${Object.keys(stats.service_counts).length}</div>
            </div>
            <div class="bg-slate-800 border border-slate-700 p-4 rounded shadow-sm">
                <div class="text-xs text-slate-400 uppercase font-semibold">RAG Chunks</div>
                <div class="text-2xl text-purple-400 mt-1">${knowledgeStatus.chunks_indexed || 0}</div>
            </div>
        </div>
        
        <div class="grid grid-cols-2 gap-6">
            <div class="bg-slate-800 border border-slate-700 p-4 rounded shadow-sm">
                <h3 class="text-white font-medium mb-3">Event Volume by Service</h3>
                <div class="space-y-2">
                    ${Object.entries(stats.service_counts).map(([svc, count]) => {
                        const max = Math.max(...Object.values(stats.service_counts));
                        const pct = (count / max) * 100;
                        return `
                        <div class="relative bg-slate-700/50 p-2 rounded overflow-hidden">
                            <div class="absolute left-0 top-0 bottom-0 bg-blue-900/30" style="width: ${pct}%"></div>
                            <div class="relative flex justify-between items-center z-10">
                                <span class="text-sm text-slate-300">${svc}</span>
                                <span class="font-mono text-sm text-white">${count}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
            <div class="bg-slate-800 border border-slate-700 p-4 rounded shadow-sm">
                <h3 class="text-white font-medium mb-3">System & AI Status</h3>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between border-b border-slate-700 pb-2">
                        <span class="text-slate-400">Semantic Embedding</span>
                        <span class="${knowledgeStatus.is_embedded ? 'text-green-400' : 'text-yellow-400'}">
                            ${knowledgeStatus.is_embedded ? 'Available (Ollama)' : 'TF-IDF Fallback'}
                        </span>
                    </div>
                    <div class="flex justify-between border-b border-slate-700 pb-2">
                        <span class="text-slate-400">Ollama API</span>
                        <span class="text-slate-300">${knowledgeStatus.ollama_model || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function renderAnomalies(root) {
    const anomRes = await apiGet('/anomalies');
    const anoms = anomRes.anomalies.filter(a => a.is_anomalous);
    
    root.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded shadow-sm">
            <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 class="text-white font-medium">Detected Anomalies (Isolation Forest)</h3>
                <span class="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">Found: ${anoms.length} windows</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-900/50 text-slate-400 text-xs">
                        <tr>
                            <th class="px-4 py-2 font-medium">Window (Time)</th>
                            <th class="px-4 py-2 font-medium">Avg Latency</th>
                            <th class="px-4 py-2 font-medium">Errors / Warns</th>
                            <th class="px-4 py-2 font-medium">Score</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700/50">
                        ${anoms.map(a => `
                            <tr class="hover:bg-slate-700/30">
                                <td class="px-4 py-3 font-mono">${new Date(a.window).toLocaleString()}</td>
                                <td class="px-4 py-3">${a.features.avg_latency?.toFixed(1) || 0} ms</td>
                                <td class="px-4 py-3 text-red-300">${a.features.error_count || 0} / ${a.features.warn_count || 0}</td>
                                <td class="px-4 py-3 font-mono text-xs">${a.score?.toFixed(3)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderIncidents(root) {
    const incRes = await apiGet('/incidents?size=100');
    const items = incRes.items;
    
    window.openIncident = async (id) => {
        const detail = await apiGet(`/incidents/${id}`);
        renderIncidentDetail(root, detail);
    };
    
    const severityColor = {
        'critical': 'text-red-400 bg-red-900/30 border border-red-800',
        'high': 'text-orange-400 bg-orange-900/30 border border-orange-800',
        'medium': 'text-yellow-400 bg-yellow-900/30 border border-yellow-800',
        'low': 'text-blue-400 bg-blue-900/30 border border-blue-800'
    };
    
    root.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded shadow-sm">
            <div class="p-4 border-b border-slate-700">
                <h3 class="text-white font-medium">Correlated Incidents</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-900/50 text-slate-400 text-xs uppercase">
                        <tr>
                            <th class="px-4 py-3 font-medium">Incident ID</th>
                            <th class="px-4 py-3 font-medium">Severity</th>
                            <th class="px-4 py-3 font-medium">Status</th>
                            <th class="px-4 py-3 font-medium">Root Cause (Top Rank)</th>
                            <th class="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700/50">
                        ${items.map(inc => `
                            <tr class="hover:bg-slate-700/30">
                                <td class="px-4 py-3 font-mono text-xs">${inc.id.substring(0,8)}...</td>
                                <td class="px-4 py-3">
                                    <span class="px-2 py-0.5 rounded text-xs ${severityColor[inc.severity] || ''}">${escapeHTML(inc.severity)}</span>
                                </td>
                                <td class="px-4 py-3 capitalize">${escapeHTML(inc.status)}</td>
                                <td class="px-4 py-3">${inc.root_cause_candidates.length > 0 ? inc.root_cause_candidates[0].service : 'Unknown'}</td>
                                <td class="px-4 py-3 text-right">
                                    <button onclick="openIncident('${escapeHTML(inc.id)}')" class="text-blue-400 hover:text-blue-300 text-xs font-semibold">View Detail</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderIncidentDetail(root, inc) {
    root.innerHTML = `<div class='mb-4'><button onclick="nav('incidents')" class='text-blue-400 text-sm hover:underline'><i class='fas fa-arrow-left mr-1'></i> Back to Incidents</button></div>`;
    const card = document.createElement('div');
    card.className = 'bg-slate-800 border border-slate-700 rounded p-6 shadow-sm';
    
    const cands = inc.root_cause_candidates.map(c => `
        <div class='bg-slate-900/50 p-3 rounded mb-2 border border-slate-700/50'>
            <span class='text-white font-medium'>${escapeHTML(c.service)}</span> (Score: ${c.score.toFixed(2)})<br>
            <span class='text-xs text-slate-400'>Evidence: ${escapeHTML(c.evidence.join(' '))}</span>
        </div>`).join('');

    card.innerHTML = `
        <h2 class='text-xl text-white font-semibold mb-2'>Incident ${escapeHTML(inc.id)}</h2>
        <div class='flex space-x-2 mb-4'>
            <span class='px-2 py-1 bg-slate-700 rounded text-xs text-white capitalize'>Status: ${escapeHTML(inc.status)}</span>
            <span class='px-2 py-1 bg-slate-700 rounded text-xs text-white'>Sev: ${escapeHTML(inc.severity)}</span>
            <span class='px-2 py-1 bg-slate-700 rounded text-xs text-white'>Affected: ${inc.affected_services.join(', ')}</span>
        </div>
        <div class='mb-6 text-sm text-slate-300'>
            <div><strong>First Observed:</strong> ${new Date(inc.first_observed).toLocaleString()}</div>
            <div><strong>Last Observed:</strong> ${new Date(inc.last_observed).toLocaleString()}</div>
        </div>
        <div class='mb-6'>
            <h3 class='text-slate-400 text-sm font-semibold mb-2 uppercase'>Deterministic Root Cause Ranking</h3>
            ${cands}
        </div>
        <div class='flex space-x-3 mb-6'>
            <button id='btn-ack' class='bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-sm text-white'>Acknowledge</button>
            <button id='btn-res' class='bg-green-800 hover:bg-green-700 px-3 py-1.5 rounded text-sm text-white'>Resolve</button>
        </div>
        <div class='border-t border-slate-700 pt-4 mt-4'>
            <h3 class='text-white font-medium mb-3'><i class='fas fa-robot text-blue-400 mr-2'></i>AI Investigation</h3>
            <button id='btn-investigate' class='bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm text-white font-medium w-full sm:w-auto'>Launch Investigation</button>
            <div id='investigation-result' class='mt-4 hidden'></div>
        </div>
    `;
    root.appendChild(card);

    document.getElementById('btn-ack').onclick = async () => {
        await apiPatch(`/incidents/${escapeHTML(inc.id)}/status`, {status: 'acknowledged'});
        nav('incidents');
    };
    document.getElementById('btn-res').onclick = async () => {
        await apiPatch(`/incidents/${escapeHTML(inc.id)}/status`, {status: 'resolved'});
        nav('incidents');
    };
    
    document.getElementById('btn-investigate').onclick = async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Investigating...';
        const resDiv = document.getElementById('investigation-result');
        resDiv.classList.remove('hidden');
        resDiv.innerHTML = '<div class="text-sm text-slate-400">Connecting to local AI agent...</div>';
        
        try {
            const rep = await apiPost('/investigations', {incident_id: inc.id, question: 'Analyze this incident.'});
            const statusColor = rep.status === 'success' ? 'text-green-400' : 'text-yellow-400';
            resDiv.innerHTML = `
            <div class='bg-slate-900 border border-slate-700 p-4 rounded text-sm text-slate-300 space-y-3'>
                <div class='flex justify-between items-center border-b border-slate-800 pb-2 mb-2'>
                    <span class='font-semibold text-blue-400'>AI Investigation Report</span>
                    <span class='text-xs ${statusColor}'>Status: ${escapeHTML(rep.status)}</span>
                </div>
                <p><strong class='text-white'>Summary:</strong> ${escapeHTML(rep.summary)}</p>
                <p><strong class='text-white'>Uncertainty / Limitations:</strong> ${escapeHTML(rep.remaining_uncertainty)}</p>
                <p><strong class='text-white'>Runbook Evidence:</strong> ${rep.runbook_references.length ? rep.runbook_references.join(', ') : 'None'}</p>
                <p class='text-xs text-slate-500 mt-2 border-t border-slate-800 pt-2'>Model: ${escapeHTML(rep.model_identifier)} | Retrieval: ${escapeHTML(rep.retrieval_mode)}</p>
            </div>`;
        } catch(err) {
            resDiv.innerHTML = `<div class='text-red-400 text-sm'>Investigation failed: ${escapeHTML(err.message)}</div>`;
        } finally {
            btn.innerHTML = 'Launch Investigation';
            btn.disabled = false;
        }
    };
}

async function renderServices(root) {
    const s = await apiGet('/stats');
    root.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded p-6 shadow-sm">
            <h2 class="text-white text-lg font-medium mb-4">Service Telemetry</h2>
            <div class="grid grid-cols-2 gap-4">
                ${Object.entries(s.service_counts).map(([svc, count]) => `
                    <div class="bg-slate-900 border border-slate-700 p-4 rounded">
                        <div class="font-semibold text-blue-300 mb-2">${svc}</div>
                        <div class="text-xs text-slate-400">Recorded Events: <span class="text-white font-mono">${count}</span></div>
                    </div>
                `).join('')}
            </div>
            <p class="text-xs text-slate-500 mt-4">* Historical synthetic telemetry active.</p>
        </div>
    `;
}

async function renderKnowledge(root) {
    root.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded p-6 shadow-sm">
            <h2 class="text-white text-lg font-medium mb-4">Knowledge Base Search</h2>
            <div class="flex space-x-2 mb-4">
                <input type="text" id="rag-input" class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="Ask a technical question...">
                <button id="btn-search" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium">Search</button>
            </div>
            <div id="search-results" class="space-y-3"></div>
        </div>
    `;
    
    document.getElementById('btn-search').onclick = async () => {
        const q = document.getElementById('rag-input').value;
        if (!q) return;
        const resDiv = document.getElementById('search-results');
        resDiv.innerHTML = '<i class="fas fa-spinner fa-spin text-slate-400"></i>';
        
        try {
            const resp = await apiPost('/knowledge/search', {query: q, top_k: 3});
            if (resp.results.length === 0) {
                resDiv.innerHTML = '<div class="text-slate-400 text-sm">No relevant documents found.</div>';
                return;
            }
            resDiv.innerHTML = resp.results.map(r => `
                <div class="bg-slate-900 border border-slate-700 p-3 rounded text-sm">
                    <div class="text-blue-400 font-semibold mb-1">${escapeHTML(r.title)} <span class="text-slate-500 font-normal text-xs ml-2">${escapeHTML(r.heading)}</span></div>
                    <div class="text-slate-300">${escapeHTML(r.text.substring(0, 200))}...</div>
                    <div class="text-xs text-slate-500 mt-2">Score: ${r.score.toFixed(2)} | Method: ${escapeHTML(r.method)}</div>
                </div>
            `).join('');
        } catch (e) {
            resDiv.innerHTML = `<div class="text-red-400 text-sm">Error: ${escapeHTML(e.message)}</div>`;
        }
    };
}

// Init
checkHealth();
setInterval(checkHealth, 10000);
render();

