const API = "/api";



let phases = [];

let engines = [];

let testing = false;

let sessionData = null;

let uiSaveTimer = null;



function statusLabel(s) {

  return { pass: "PASS", blueprint: "COMPLETE", fail: "FAIL", "not-run": "NOT RUN" }[s] ?? "UNKNOWN";

}



async function api(path, method = "GET", body = null) {

  const options = { method };

  if (body) {

    options.headers = { "Content-Type": "application/json" };

    options.body = JSON.stringify(body);

  }

  const res = await fetch(`${API}${path}`, options);

  return res.json();

}



function showTestRunning(label) {

  document.getElementById("test-running").classList.remove("hidden");

  document.getElementById("test-running-label").textContent = label;

}



function hideTestRunning() {

  document.getElementById("test-running").classList.add("hidden");

}



function showTestResult(result) {

  const el = document.getElementById("test-result");

  el.classList.remove("hidden", "success", "error");

  el.classList.add(result.success ? "success" : "error");

  el.innerHTML = `

    <div class="test-result-header">

      <strong>${result.success ? "✓ Passed" : "✗ Failed"}</strong>

      <span>${result.durationMs}ms</span>

    </div>

    <p>${escapeHtml(result.message)}</p>

    ${result.output ? `<pre class="test-output">${escapeHtml(result.output)}</pre>` : ""}

  `;

}



function escapeHtml(s) {

  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

}



async function runTest(label, promise, refreshOnSuccess = false) {

  if (testing) return;

  testing = true;

  setButtonsDisabled(true);

  showTestRunning(label);

  document.getElementById("test-result").classList.add("hidden");

  try {

    const result = await promise;

    showTestResult(result);

    if (refreshOnSuccess && result.success) await load();

  } finally {

    hideTestRunning();

    testing = false;

    setButtonsDisabled(false);

  }

}



function setButtonsDisabled(disabled) {

  document.querySelectorAll("button").forEach((b) => { b.disabled = disabled; });

}



function renderSessionPanel() {

  if (!sessionData?.session) return;

  const { session, runtime } = sessionData;

  const rt = runtime?.runtime ?? session.lastRuntime;



  document.getElementById("sess-storage").textContent = session.storageRoot;

  document.getElementById("sess-memory").textContent = rt.memoryLoaded

    ? `Loaded (${rt.memoryReadiness ?? "—"}/100)` : "Loading…";

  document.getElementById("sess-knowledge").textContent = rt.knowledgeLoaded

    ? `Loaded (${rt.knowledgeReadiness ?? "—"}/100)` : "Loading…";

  document.getElementById("sess-projects").textContent = String(rt.projectCount ?? 0);

  document.getElementById("sess-modules").textContent = `${rt.modulesConnected ?? 0} connected`;

  document.getElementById("sess-id").textContent = session.sessionId.slice(0, 8) + "…";



  const msg = runtime?.message ?? "Persistent session active";

  document.getElementById("session-message").textContent = msg;



  const sessEl = document.getElementById("session-status");

  if (runtime?.ready) {

    sessEl.textContent = runtime.restored ? "● Session Restored" : "● Session Active";

    sessEl.style.color = "var(--success)";

  } else if (runtime?.booting) {

    sessEl.textContent = "● Restoring…";

    sessEl.style.color = "var(--warning)";

  } else {

    sessEl.textContent = "● Session Offline";

    sessEl.style.color = "var(--error)";

  }



  if (session.ui?.filter && !document.getElementById("filter").value) {

    document.getElementById("filter").value = session.ui.filter;

  }

}



function scheduleUiSave() {

  if (uiSaveTimer) clearTimeout(uiSaveTimer);

  uiSaveTimer = setTimeout(saveUiState, 500);

}



async function saveUiState() {

  const openPhases = [];

  document.querySelectorAll(".phase-header").forEach((btn) => {

    const body = btn.nextElementSibling;

    if (body && body.style.display !== "none") {

      openPhases.push(btn.getAttribute("data-phase"));

    }

  });



  try {

    await api("/session/ui", "POST", {

      filter: document.getElementById("filter").value,

      openPhases,

    });

  } catch { /* ignore */ }

}



function renderEngines() {

  const container = document.getElementById("engine-buttons");

  container.innerHTML = engines.map((e) =>

    `<button class="btn btn-engine" data-engine="${e.id}">Test ${escapeHtml(e.name)}</button>`

  ).join("");

  container.querySelectorAll("[data-engine]").forEach((btn) => {

    btn.addEventListener("click", () => {

      const id = btn.getAttribute("data-engine");

      const engine = engines.find((e) => e.id === id);

      runTest(`${engine.name} Quick Test`, api(`/engines/${id}/quick-test`, "POST"));

    });

  });

}



function renderPhases(filter = "") {

  const q = filter.toLowerCase();

  const openFromSession = new Set(sessionData?.session?.ui?.openPhases ?? []);

  const container = document.getElementById("phases");

  const filtered = phases.map((p) => ({

    ...p,

    modules: p.modules.filter((m) =>

      !q || m.name.toLowerCase().includes(q) || m.step.toLowerCase().includes(q) ||

      m.engine.toLowerCase().includes(q) || (m.aiPath?.toLowerCase().includes(q) ?? false)

    ),

  })).filter((p) => p.modules.length > 0 || p.name.toLowerCase().includes(q));



  if (!filtered.length) {

    container.innerHTML = '<div class="loading">No modules match filter</div>';

    return;

  }



  container.innerHTML = filtered.map((phase, i) => {

    const defaultOpen = openFromSession.size > 0

      ? openFromSession.has(phase.id)

      : i < 4;

    return `

    <section class="phase-panel">

      <button class="phase-header" data-phase="${phase.id}">

        <div class="phase-title">

          <span class="status-badge status-${phase.status}">${statusLabel(phase.status)}</span>

          <h2>${escapeHtml(phase.name)}</h2>

          <span class="phase-engine">${escapeHtml(phase.engine)}</span>

        </div>

        <div class="phase-stats">

          <span>${phase.passedModules}/${phase.totalModules} complete</span>

          <span class="chevron">${defaultOpen ? "▾" : "▸"}</span>

        </div>

      </button>

      <div class="phase-body" ${defaultOpen ? "" : 'style="display:none"'}>

        <p class="phase-desc">${escapeHtml(phase.description)}</p>

        <div class="module-list">

          ${phase.modules.map((m) => renderModule(m)).join("")}

        </div>

      </div>

    </section>

  `;

  }).join("");



  container.querySelectorAll(".phase-header").forEach((btn) => {

    btn.addEventListener("click", () => {

      const body = btn.nextElementSibling;

      const chevron = btn.querySelector(".chevron");

      const open = body.style.display !== "none";

      body.style.display = open ? "none" : "block";

      chevron.textContent = open ? "▸" : "▾";

      scheduleUiSave();

    });

  });



  container.querySelectorAll("[data-smoke]").forEach((btn) => {

    btn.addEventListener("click", () => {

      const key = btn.getAttribute("data-smoke");

      const mod = phases.flatMap((p) => p.modules).find((m) => m.validateKey === key);

      runTest(`${mod.step} Load Test`, api(`/modules/${key}/smoke-test`, "POST"));

    });

  });



  container.querySelectorAll("[data-validate]").forEach((btn) => {

    btn.addEventListener("click", () => {

      const key = btn.getAttribute("data-validate");

      const mod = phases.flatMap((p) => p.modules).find((m) => m.validateKey === key);

      runTest(`${mod.step} Full Validation`, api(`/modules/${key}/validate`, "POST"), true);

    });

  });

}



function renderModule(m) {

  const actions = m.validateKey && m.kind !== "blueprint" ? `

    <div class="module-actions">

      ${m.aiPath ? `<button class="btn btn-sm" data-smoke="${m.validateKey}">Load</button>` : ""}

      <button class="btn btn-sm btn-primary" data-validate="${m.validateKey}">Validate</button>

    </div>

  ` : "";



  return `

    <div class="module-row">

      <div class="module-info">

        <span class="module-step">${m.step}</span>

        <span class="module-name">${escapeHtml(m.name)}</span>

        ${m.kind === "certification" ? '<span class="module-tag">CERT</span>' : ""}

        ${m.aiPath ? `<span class="module-path">${escapeHtml(m.aiPath)}</span>` : ""}

      </div>

      <div class="module-meta">

        ${m.readinessScore !== null ? `<span class="readiness">${m.readinessScore}/100</span>` : ""}

        <span class="status-badge status-${m.status}">${statusLabel(m.status)}</span>

        ${actions}

      </div>

    </div>

  `;

}



function updateStats() {

  const all = phases.flatMap((p) => p.modules);

  document.getElementById("stat-passed").textContent = all.filter((m) => m.status === "pass" || m.status === "blueprint").length;

  document.getElementById("stat-total").textContent = all.length;

  document.getElementById("stat-ai").textContent = all.filter((m) => m.aiPath).length;

}



async function load() {

  try {

    const health = await api("/health");

    const statusEl = document.getElementById("api-status");

    statusEl.textContent = health.ok ? "● API Online" : "● API Offline";

    statusEl.className = health.ok ? "api-online" : "api-offline";



    const [phaseData, engineData, session] = await Promise.all([

      api("/phases?refresh=1"),

      api("/engines"),

      api("/session"),

    ]);

    phases = phaseData.phases;

    engines = engineData.engines;

    sessionData = session;

    updateStats();

    renderSessionPanel();

    renderEngines();

    renderPhases(document.getElementById("filter").value);

  } catch {

    document.getElementById("api-status").textContent = "● API Offline";

    document.getElementById("session-status").textContent = "● Waiting for server";

    document.getElementById("phases").innerHTML = '<div class="loading">Run <code>npm run dev</code> then refresh.</div>';

  }

}



document.getElementById("refresh-btn").addEventListener("click", load);

document.getElementById("filter").addEventListener("input", (e) => {

  renderPhases(e.target.value);

  scheduleUiSave();

});



load();

setInterval(load, 30_000);


