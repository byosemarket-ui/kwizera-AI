const API = "/api";



let phases = [];

let engines = [];

let testing = false;

let sessionData = null;

let uiSaveTimer = null;

let workspaceData = null;

let workspaceSaveTimer = null;

let planningData = null;

let planningSaveTimer = null;

let reviewData = null;

let pipelineData = null;

let modelData = null;

let imageGenerationData = null;

let videoAudioData = null;

let optimizationData = null;

let productIntelligenceData = null;

let imageIntelligenceData = null;

let marketingIntelligenceData = null;

let decisionIntelligenceData = null;

let learningIntelligenceData = null;



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



    const [phaseData, engineData, session, workspace, pipeline, models, imageGeneration, videoAudio, optimization, productIntelligence, imageIntelligence, marketingIntelligence, decisionIntelligence, learningIntelligence] = await Promise.all([

      api("/phases?refresh=1"),

      api("/engines"),

      api("/session"),

      api("/workspace"),

      api("/pipeline"),

      api("/models"),

      api("/image-generation"),

      api("/video-audio-generation"),

      api("/generation-optimization"),

      api("/product-intelligence"),

      api("/image-intelligence"),

      api("/marketing-intelligence"),

      api("/decision-intelligence"),

      api("/learning-intelligence"),

    ]);

    phases = phaseData.phases;

    engines = engineData.engines;

    sessionData = session;

    workspaceData = workspace.error ? null : workspace;

    pipelineData = pipeline.error ? null : pipeline;

    modelData = models.error ? null : models;

    imageGenerationData = imageGeneration.error ? null : imageGeneration;

    videoAudioData = videoAudio.error ? null : videoAudio;

    optimizationData = optimization.error ? null : optimization;

    productIntelligenceData = productIntelligence.error ? null : productIntelligence;

    imageIntelligenceData = imageIntelligence.error ? null : imageIntelligence;

    marketingIntelligenceData = marketingIntelligence.error ? null : marketingIntelligence;

    decisionIntelligenceData = decisionIntelligence.error ? null : decisionIntelligence;

    learningIntelligenceData = learningIntelligence.error ? null : learningIntelligence;

    updateStats();

    renderSessionPanel();

    renderEngines();

    renderPhases(document.getElementById("filter").value);

    renderWorkspace();

    await loadPlanning();

    await loadReview();

    renderPipeline();

    renderModels();

    await loadImageGeneration();

    await loadVideoAudioGeneration();

    await loadGenerationOptimization();

    await loadProductIntelligence();

    await loadImageIntelligence();

    await loadMarketingIntelligence();

    await loadDecisionIntelligence();

    await loadLearningIntelligence();

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

function workspaceError(message) {

  const panel = document.getElementById("validation-panel");

  panel.className = "validation-panel validation-errors";

  panel.textContent = message;

}

function fieldValue(project, path) {

  return path.split(".").reduce((value, key) => value?.[key], project) ?? "";

}

function renderWorkspace() {

  const project = workspaceData?.activeProject;

  const recent = document.getElementById("recent-projects");

  const projects = workspaceData?.projects ?? [];

  recent.innerHTML = projects.length

    ? projects.map((item) => `<button class="recent-project ${item.id === project?.id ? "active" : ""}" data-workspace-project="${item.id}"><strong>${escapeHtml(item.name)}</strong><span>${new Date(item.modifiedAt).toLocaleDateString()}</span></button>`).join("")

    : '<span class="muted">No saved projects</span>';

  recent.querySelectorAll("[data-workspace-project]").forEach((button) => button.addEventListener("click", () => openWorkspaceProject(button.dataset.workspaceProject)));

  document.getElementById("workspace-empty").classList.toggle("hidden", Boolean(project));

  document.getElementById("workspace-form").classList.toggle("hidden", !project);

  document.getElementById("save-project-btn").disabled = !project;

  if (!project) return;

  document.querySelectorAll("[data-project-field]").forEach((field) => { field.value = fieldValue(project, field.dataset.projectField); });

  document.getElementById("project-status").textContent = workspaceData.validation.valid ? "Ready" : "Draft";

  document.getElementById("project-modified").textContent = new Date(project.modifiedAt).toLocaleString();

  document.getElementById("image-preview-list").innerHTML = project.productImages.map((image) => `<figure class="image-preview"><img src="${image.url}" alt="${escapeHtml(image.fileName)}"><figcaption>${escapeHtml(image.fileName)}</figcaption></figure>`).join("");

  const panel = document.getElementById("validation-panel");

  const validation = workspaceData.validation;

  panel.className = `validation-panel ${validation.valid ? "validation-ready" : "validation-errors"}`;

  panel.innerHTML = validation.valid ? "Inputs complete. This project is ready for the next creative pipeline step." : `<strong>Complete required inputs</strong><ul>${validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;

  document.getElementById("continue-btn").disabled = !validation.valid;

}

async function refreshWorkspace() {

  const workspace = await api("/workspace");

  if (workspace.error) return workspaceError(workspace.error);

  workspaceData = workspace;

  renderWorkspace();

  await loadPlanning();

  await loadReview();

}

async function openWorkspaceProject(projectId) {

  const result = await api(`/workspace/projects/${projectId}`, "POST", { action: "open" });

  if (result.error) return workspaceError(result.error);

  await refreshWorkspace();

}

async function saveWorkspace() {

  const project = workspaceData?.activeProject;

  if (!project) return;

  const changes = {};

  document.querySelectorAll("[data-project-field]").forEach((field) => {

    const [group, key] = field.dataset.projectField.split(".");

    if (key) changes[group] = { ...(changes[group] ?? {}), [key]: field.value };

    else changes[group] = field.value;

  });

  const result = await api(`/workspace/projects/${project.id}`, "POST", { changes });

  if (result.error) return workspaceError(result.error);

  workspaceData.activeProject = result.project;

  workspaceData.projects = workspaceData.projects.map((item) => item.id === result.project.id ? result.project : item);

  workspaceData.validation = result.validation;

  renderWorkspace();

}

async function uploadWorkspaceImages(files) {

  const project = workspaceData?.activeProject;

  if (!project) return;

  for (const file of files) {

    const dataBase64 = await new Promise((resolve, reject) => {

      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result).split(",")[1]);

      reader.onerror = reject;

      reader.readAsDataURL(file);

    });

    const result = await api(`/workspace/projects/${project.id}/images`, "POST", { fileName: file.name, mimeType: file.type, dataBase64 });

    if (result.error) return workspaceError(result.error);

  }

  await refreshWorkspace();

}

document.getElementById("new-project-btn").addEventListener("click", async () => {

  const input = document.getElementById("new-project-name");

  const result = await api("/workspace/projects", "POST", { name: input.value });

  if (result.error) return workspaceError(result.error);

  input.value = "";

  await refreshWorkspace();

});

document.getElementById("save-project-btn").addEventListener("click", () => { void saveWorkspace(); });

document.getElementById("workspace-form").addEventListener("input", () => {

  clearTimeout(workspaceSaveTimer);

  workspaceSaveTimer = setTimeout(() => { void saveWorkspace(); }, 600);

});

document.getElementById("product-images").addEventListener("change", (event) => { void uploadWorkspaceImages(event.target.files); });

function planField(label, field, value) {

  return `<section class="plan-section"><h3>${label}</h3><textarea data-plan-field="${field}">${escapeHtml(value ?? "")}</textarea></section>`;

}

function renderPlanning() {

  const project = workspaceData?.activeProject;

  const plan = planningData?.plan;

  const validProject = Boolean(project && workspaceData.validation?.valid);

  document.getElementById("planning-empty").classList.toggle("hidden", Boolean(plan));

  document.getElementById("planning-form").classList.toggle("hidden", !plan);

  document.getElementById("generate-plan-btn").disabled = !validProject;

  document.getElementById("save-plan-btn").disabled = !plan;

  if (!plan) return;

  document.getElementById("plan-status").textContent = "Editable plan ready";

  document.getElementById("plan-version").textContent = `v${plan.version}`;

  document.getElementById("plan-modified").textContent = new Date(plan.modifiedAt).toLocaleString();

  const analyses = Object.entries(plan.analyses).map(([key, value]) => planField(`${key[0].toUpperCase()}${key.slice(1)} Analysis`, `analyses.${key}`, value)).join("");

  const direction = [

    planField("Creative Brief", "creativeBrief", plan.creativeBrief),

    planField("Marketing Strategy", "marketingStrategy", plan.marketingStrategy),

    planField("Creative Strategy", "creativeStrategy", plan.creativeStrategy),

    planField("Storyboard", "storyboard", plan.storyboard),

    planField("Script", "script", plan.script),

    planField("Scene Timeline", "scenes", JSON.stringify(plan.scenes, null, 2)),

    planField("Camera Plan", "cameraPlan", plan.cameraPlan),

    planField("Lighting Plan", "lightingPlan", plan.lightingPlan),

    planField("Colour Style", "colourStyle", plan.colourStyle),

    planField("Composition Guide", "compositionGuide", plan.compositionGuide),

    planField("Animation Plan", "animationPlan", plan.animationPlan),

    planField("Image Prompt", "prompts.image", plan.prompts.image),

    planField("Video Prompt", "prompts.video", plan.prompts.video),

    planField("Audio Prompt", "prompts.audio", plan.prompts.audio),

    planField("Production Workflow", "workflow", plan.workflow.join("\n")),

  ].join("");

  document.getElementById("plan-grid").innerHTML = analyses + direction;

}

async function loadPlanning() {

  const project = workspaceData?.activeProject;

  if (!project) { planningData = null; renderPlanning(); return; }

  const response = await api(`/workspace/projects/${project.id}/plan`);

  if (response.error) { planningData = null; renderPlanning(); return; }

  planningData = response;

  if (!planningData.plan && workspaceData.validation?.valid) {

    await generatePlan();

    return;

  }

  renderPlanning();

}

async function generatePlan() {

  const project = workspaceData?.activeProject;

  if (!project) return;

  const result = await api(`/workspace/projects/${project.id}/plan`, "POST", { action: "generate" });

  if (result.error) return workspaceError(result.error);

  planningData = { ...result, integrations: planningData?.integrations };

  renderPlanning();

}

async function savePlanning() {

  const project = workspaceData?.activeProject;

  if (!project || !planningData?.plan) return;

  const changes = {};

  try {

    document.querySelectorAll("[data-plan-field]").forEach((field) => {

      const [group, key] = field.dataset.planField.split(".");

      let value = field.value;

      if (group === "scenes") value = JSON.parse(value);

      if (group === "workflow") value = value.split("\n").map((step) => step.trim()).filter(Boolean);

      if (key) changes[group] = { ...(changes[group] ?? {}), [key]: value };

      else changes[group] = value;

    });

  } catch {

    workspaceError("Scene Timeline must remain valid JSON while editing.");

    return;

  }

  const result = await api(`/workspace/projects/${project.id}/plan`, "POST", { changes });

  if (result.error) return workspaceError(result.error);

  planningData = result;

  renderPlanning();

}

document.getElementById("generate-plan-btn").addEventListener("click", () => { void generatePlan(); });

document.getElementById("save-plan-btn").addEventListener("click", () => { void savePlanning(); });

document.getElementById("planning-form").addEventListener("input", () => {

  clearTimeout(planningSaveTimer);

  planningSaveTimer = setTimeout(() => { void savePlanning(); }, 700);

});

function reviewAssetUrl(projectId, asset) {

  return `/api/review/projects/${projectId}/assets/${asset.fileName}`;

}

function previewMarkup(projectId, asset) {

  if (!asset) return '<span class="muted">Choose an asset to compare.</span>';

  const source = reviewAssetUrl(projectId, asset);

  if (asset.mediaType === "image") return `<img src="${source}" alt="${escapeHtml(asset.name)}">`;

  if (asset.mediaType === "video") return `<video controls src="${source}"></video>`;

  return `<audio controls src="${source}"></audio>`;

}

function renderReview() {

  const project = workspaceData?.activeProject;

  const state = reviewData?.review;

  const assets = state?.assets ?? [];

  document.getElementById("review-bootstrap-btn").disabled = !project || !project.productImages.length;

  document.getElementById("review-empty").classList.toggle("hidden", assets.length > 0);

  document.getElementById("review-content").classList.toggle("hidden", !assets.length);

  if (!assets.length) return;

  const select = document.getElementById("review-asset-select");

  const currentId = select.value || assets[0].id;

  select.innerHTML = assets.map((asset) => `<option value="${asset.id}" ${asset.id === currentId ? "selected" : ""}>${escapeHtml(asset.name)} · v${asset.version}</option>`).join("");

  const selected = assets.find((asset) => asset.id === select.value) ?? assets[0];

  const compare = document.getElementById("review-compare-select");

  const compareId = compare.value || assets.find((asset) => asset.id !== selected.id)?.id || selected.id;

  compare.innerHTML = assets.map((asset) => `<option value="${asset.id}" ${asset.id === compareId ? "selected" : ""}>${escapeHtml(asset.name)} · v${asset.version}</option>`).join("");

  const compared = assets.find((asset) => asset.id === compare.value) ?? selected;

  document.getElementById("media-preview").innerHTML = previewMarkup(project.id, selected);

  document.getElementById("compare-preview").innerHTML = previewMarkup(project.id, compared);

  document.getElementById("quality-report").innerHTML = Object.entries(selected.quality).filter(([key]) => key !== "recommendations").map(([key, value]) => `<div><span>${key.replace(/([A-Z])/g, " $1")}</span><strong>${typeof value === "number" ? `${value}/100` : escapeHtml(value)}</strong></div>`).join("") + `<ul>${selected.quality.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

  document.getElementById("version-history").innerHTML = assets.map((asset) => `<div><strong>${escapeHtml(asset.name)} · v${asset.version}</strong><span>${asset.approved ? "Approved" : "In review"} · ${new Date(asset.createdAt).toLocaleString()}</span></div>`).join("");

  document.getElementById("review-timeline").innerHTML = state.history.map((entry) => `<div><strong>${escapeHtml(entry.action)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("");

  const sourceFormat = selected.mimeType === "image/jpeg" ? "jpg" : selected.mimeType.split("/")[1];

  document.getElementById("export-format").innerHTML = `<option value="${sourceFormat}">${sourceFormat.toUpperCase()}</option>`;

  document.getElementById("approve-btn").disabled = selected.approved;

  document.getElementById("download-area").innerHTML = state.exports.map((item) => `<a class="download-link" href="/api/review/projects/${project.id}/downloads/${encodeURIComponent(item.fileName)}" download>${escapeHtml(item.fileName)}</a>`).join("");

}

async function loadReview() {

  const project = workspaceData?.activeProject;

  if (!project) { reviewData = null; renderReview(); return; }

  const result = await api(`/review/projects/${project.id}`);

  if (!result.error) reviewData = result;

  renderReview();

}

async function bootstrapReview() {

  const project = workspaceData?.activeProject;

  if (!project) return;

  const result = await api(`/review/projects/${project.id}/bootstrap`, "POST", {});

  if (result.error) return workspaceError(result.error);

  reviewData = { ...reviewData, review: result.review };

  renderReview();

}

async function addReviewMedia(files) {

  const project = workspaceData?.activeProject;

  if (!project) return;

  for (const file of files) {

    const dataBase64 = await new Promise((resolve, reject) => {

      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file);

    });

    const result = await api(`/review/projects/${project.id}/assets`, "POST", { name: file.name, mimeType: file.type, dataBase64 });

    if (result.error) return workspaceError(result.error);

    reviewData = { ...reviewData, review: result.review };

  }

  renderReview();

}

async function reviewAction(action, body = {}) {

  const project = workspaceData?.activeProject;

  const assetId = document.getElementById("review-asset-select").value;

  if (!project || !assetId) return;

  const result = await api(`/review/projects/${project.id}/${action}`, "POST", { assetId, ...body });

  if (result.error) return workspaceError(result.error);

  if (result.review) { reviewData = { ...reviewData, review: result.review }; renderReview(); }

  if (result.downloadPath) { document.getElementById("export-progress").textContent = "Export complete: 100%"; await loadReview(); }

}

document.getElementById("review-bootstrap-btn").addEventListener("click", () => { void bootstrapReview(); });

document.getElementById("review-media-input").addEventListener("change", (event) => { void addReviewMedia(event.target.files); });

document.getElementById("review-asset-select").addEventListener("change", renderReview);

document.getElementById("review-compare-select").addEventListener("change", renderReview);

document.getElementById("approve-btn").addEventListener("click", () => { void reviewAction("approve"); });

document.getElementById("regenerate-btn").addEventListener("click", () => { void reviewAction("regenerate", { instructions: "Create a revised version that addresses the current quality recommendations." }); });

document.getElementById("export-btn").addEventListener("click", () => { void reviewAction("export", { format: document.getElementById("export-format").value, platform: document.getElementById("export-platform").value.toLowerCase(), resolution: document.getElementById("export-resolution").value, quality: document.getElementById("export-quality").value }); });

function renderPipeline() {

  const project = workspaceData?.activeProject;

  const dashboard = pipelineData;

  document.getElementById("run-pipeline-btn").disabled = !project;

  document.getElementById("pipeline-empty").classList.toggle("hidden", Boolean(project && dashboard));

  document.getElementById("pipeline-content").classList.toggle("hidden", !project || !dashboard);

  if (!project || !dashboard) return;

  const monitor = dashboard.monitor ?? {};

  document.getElementById("pipeline-metrics").innerHTML = [

    ["Health", monitor.pipelineHealth ?? "pending"], ["Active", monitor.activeJobs ?? 0], ["Queued", monitor.queuedJobs ?? 0], ["Memory", `${monitor.memoryMb ?? 0} MB`], ["Success", `${monitor.successRate ?? 0}%`],

  ].map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("");

  const jobs = dashboard.jobs ?? [];

  document.getElementById("pipeline-jobs").innerHTML = jobs.length ? jobs.map((job) => `<div><strong>${escapeHtml(job.projectId === project.id ? project.name : job.projectId)} · ${escapeHtml(job.stage)}</strong><span>${job.progress}% · ${escapeHtml(job.status)}${job.error ? ` · ${escapeHtml(job.error)}` : ""}</span>${job.status === "failed" ? `<button class="btn btn-sm" data-retry-job="${job.id}">Retry</button>` : ""}</div>`).join("") : '<span class="muted">No active pipeline jobs.</span>';

  document.getElementById("pipeline-integrations").innerHTML = Object.entries(dashboard.integrations ?? {}).map(([name, ready]) => `<div><span>${escapeHtml(name.replace(/([A-Z])/g, " $1"))}</span><strong class="${ready ? "ready" : "pending"}">${ready ? "Connected" : "Awaiting"}</strong></div>`).join("");

  const notices = jobs.flatMap((job) => job.notifications ?? []).slice(0, 6);

  document.getElementById("pipeline-notices").innerHTML = notices.length ? notices.map((notice) => `<div><strong>${escapeHtml(notice.level)}</strong><span>${escapeHtml(notice.message)}</span></div>`).join("") : '<span class="muted">No pipeline notices.</span>';

  const history = dashboard.history ?? [];

  document.getElementById("pipeline-history").innerHTML = history.length ? history.slice(0, 8).map((job) => `<div><strong>${escapeHtml(job.projectId === project.id ? project.name : job.projectId)}</strong><span>${escapeHtml(job.status)} · ${job.progress}% · ${new Date(job.updatedAt).toLocaleString()}</span></div>`).join("") : '<span class="muted">No completed projects yet.</span>';

  document.querySelectorAll("[data-retry-job]").forEach((button) => button.addEventListener("click", () => { void retryPipeline(button.dataset.retryJob); }));

}

async function runPipeline() {

  const project = workspaceData?.activeProject;

  if (!project) return;

  const result = await api("/pipeline/jobs", "POST", { projectId: project.id });

  if (result.error) return workspaceError(result.error);

  pipelineData = result.dashboard;

  renderPipeline();

  await loadReview();

}

async function retryPipeline(jobId) {

  const result = await api(`/pipeline/jobs/${jobId}/retry`, "POST", {});

  if (result.error) return workspaceError(result.error);

  pipelineData = result.dashboard;

  renderPipeline();

}

document.getElementById("run-pipeline-btn").addEventListener("click", () => { void runPipeline(); });

function modelRow(model, action) {

  const buttons = model.status === "loaded" ? `<button class="btn btn-sm" data-model-action="unload" data-model-id="${model.id}">Unload</button>` : `<button class="btn btn-sm" data-model-action="load" data-model-id="${model.id}">Load</button>`;

  return `<div class="model-row"><div><strong>${escapeHtml(model.name)}</strong><span>${escapeHtml(model.category)} · v${escapeHtml(model.version)} · ${escapeHtml(model.status)}</span></div><div class="model-actions">${action === "install" ? `<button class="btn btn-sm" data-model-action="install" data-model-id="${model.id}">Install</button>` : `${buttons}<button class="btn btn-sm" data-model-action="validate" data-model-id="${model.id}">Validate</button><button class="btn btn-sm" data-model-action="remove" data-model-id="${model.id}">Remove</button>`}</div></div>`;

}

function renderModels() {

  document.getElementById("models-empty").classList.toggle("hidden", Boolean(modelData));

  document.getElementById("models-content").classList.toggle("hidden", !modelData);

  if (!modelData) return;

  const stats = modelData.performance ?? {};

  document.getElementById("model-metrics").innerHTML = Object.entries(stats).map(([name, value]) => `<div><span>${escapeHtml(name.replace(/([A-Z])/g, " $1"))}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("");

  const hardware = modelData.hardware ?? {};

  document.getElementById("hardware-grid").innerHTML = [

    ["GPU", `${hardware.gpu?.name ?? "Detecting"}${hardware.gpu?.memoryMb ? ` · ${hardware.gpu.memoryMb} MB` : ""}`], ["CPU", `${hardware.cpu?.cores ?? 0} cores · ${hardware.cpu?.load ?? 0}%`], ["RAM", `${hardware.ram?.freeMb ?? 0} MB free / ${hardware.ram?.totalMb ?? 0} MB`], ["Storage", `${hardware.storage?.freeMb ?? 0} MB free / ${hardware.storage?.totalMb ?? 0} MB`],

  ].map(([name, value]) => `<div><span>${name}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  document.getElementById("installed-models").innerHTML = modelData.installed?.length ? modelData.installed.map((model) => modelRow(model, "managed")).join("") : '<span class="muted">No installed model profiles.</span>';

  document.getElementById("available-models").innerHTML = modelData.available?.map((model) => modelRow(model, "install")).join("") || '<span class="muted">No catalog models available.</span>';

  document.getElementById("model-logs").innerHTML = modelData.logs?.slice(0, 8).map((log) => `<div><strong>${escapeHtml(log.event)}</strong><span>${escapeHtml(log.detail)}</span></div>`).join("") || '<span class="muted">No model events yet.</span>';

  document.getElementById("model-cache-limit").value = modelData.settings.cacheLimit;

  document.getElementById("model-auto-unload").value = modelData.settings.autoUnloadMinutes;

  document.getElementById("model-prefer-gpu").checked = modelData.settings.preferGpu;

  document.getElementById("model-validate-load").checked = modelData.settings.validateOnLoad;

  document.querySelectorAll("[data-model-action]").forEach((button) => button.addEventListener("click", () => { void modelAction(button.dataset.modelId, button.dataset.modelAction); }));

}

async function modelAction(modelId, action) {

  const result = await api(`/models/${modelId}/${action}`, "POST", {});

  if (result.error) return workspaceError(result.error);

  modelData = result;

  renderModels();

}

async function saveModelSettings() {

  const result = await api("/models/settings", "POST", { cacheLimit: Number(document.getElementById("model-cache-limit").value), autoUnloadMinutes: Number(document.getElementById("model-auto-unload").value), preferGpu: document.getElementById("model-prefer-gpu").checked, validateOnLoad: document.getElementById("model-validate-load").checked });

  if (result.error) return workspaceError(result.error);

  modelData.settings = result.settings;

  renderModels();

}

document.getElementById("scan-model-health-btn").addEventListener("click", async () => { const result = await api("/models/health", "POST", {}); if (result.error) return workspaceError(result.error); modelData = result; renderModels(); });

document.getElementById("refresh-models-btn").addEventListener("click", () => { void load(); });

document.getElementById("save-model-settings-btn").addEventListener("click", () => { void saveModelSettings(); });

function imageAssetUrl(image) { return `/api/image-generation/assets/${image.id}`; }

function renderImageGeneration() {

  const project = workspaceData?.activeProject;

  document.getElementById("image-empty").classList.toggle("hidden", Boolean(project && imageGenerationData));

  document.getElementById("image-content").classList.toggle("hidden", !project || !imageGenerationData);

  if (!project || !imageGenerationData) return;

  const productSelect = document.getElementById("image-product");

  productSelect.innerHTML = `<option value="">No product image</option>${project.productImages.map((image) => `<option value="${image.id}">${escapeHtml(image.fileName)}</option>`).join("")}`;

  const modelSelect = document.getElementById("image-model");

  const selected = modelSelect.value;

  modelSelect.innerHTML = `<option value="">Automatic</option>${imageGenerationData.models.map((model) => `<option value="${model.id}" ${model.id === selected ? "selected" : ""}>${escapeHtml(model.name)} · ${escapeHtml(model.status)}</option>`).join("")}`;

  const images = imageGenerationData.images ?? [];

  document.getElementById("generated-gallery").innerHTML = images.length ? images.map((image) => `<button class="generated-tile ${image.id === document.getElementById("generated-preview").dataset.imageId ? "selected" : ""}" data-generated-image="${image.id}"><img src="${imageAssetUrl(image)}" alt="${escapeHtml(image.name)}"><span>${escapeHtml(image.name)}</span></button>`).join("") : '<span class="muted">No generated images for this project.</span>';

  const previewId = document.getElementById("generated-preview").dataset.imageId || images[0]?.id;

  const preview = images.find((image) => image.id === previewId) ?? images[0];

  document.getElementById("generated-preview").dataset.imageId = preview?.id ?? "";

  document.getElementById("generated-preview").innerHTML = preview ? `<img src="${imageAssetUrl(preview)}" alt="${escapeHtml(preview.name)}">` : '<span class="muted">Generate an image to preview it.</span>';

  document.getElementById("image-information").innerHTML = preview ? `<div><span>Model</span><strong>${escapeHtml(preview.modelId)}</strong></div><div><span>Quality</span><strong>${preview.quality.score}/100</strong></div><div><span>Output</span><strong>${escapeHtml(preview.aspectRatio)} · ${escapeHtml(preview.resolution)}</strong></div><p>${escapeHtml(preview.quality.notes.join(" "))}</p>` : "";

  document.getElementById("image-history").innerHTML = imageGenerationData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No generation history yet.</span>';

  document.querySelectorAll("[data-generated-image]").forEach((button) => button.addEventListener("click", () => { document.getElementById("generated-preview").dataset.imageId = button.dataset.generatedImage; renderImageGeneration(); }));

}

async function loadImageGeneration() {

  const project = workspaceData?.activeProject;

  if (!project) { renderImageGeneration(); return; }

  const result = await api(`/image-generation?projectId=${encodeURIComponent(project.id)}`);

  if (!result.error) imageGenerationData = result;

  renderImageGeneration();

}

async function applyImageDefaults() {

  const project = workspaceData?.activeProject;

  if (!project) return;

  const result = await api(`/image-generation/projects/${project.id}/default`);

  if (result.error) return workspaceError(result.error);

  const request = result.request;

  document.getElementById("image-prompt").value = request.prompt ?? "";

  document.getElementById("image-mode").value = request.mode ?? "text-to-image";

  document.getElementById("image-style").value = request.style ?? "studio";

  document.getElementById("image-ratio").value = request.aspectRatio ?? "1:1";

  document.getElementById("image-resolution").value = request.resolution ?? "high";

  document.getElementById("image-count").value = request.count ?? 1;

  document.getElementById("image-product").value = request.productImageId ?? "";

}

async function generateImages() {

  const project = workspaceData?.activeProject;

  if (!project) return;

  const progress = document.getElementById("image-progress"); progress.textContent = "Generating marketing image variations...";

  const result = await api("/image-generation/generate", "POST", { projectId: project.id, prompt: document.getElementById("image-prompt").value, mode: document.getElementById("image-mode").value, modelId: document.getElementById("image-model").value || undefined, style: document.getElementById("image-style").value, aspectRatio: document.getElementById("image-ratio").value, resolution: document.getElementById("image-resolution").value, count: Number(document.getElementById("image-count").value), productImageId: document.getElementById("image-product").value || undefined });

  if (result.error) { progress.textContent = "Generation paused."; return workspaceError(result.error); }

  imageGenerationData = result.dashboard; progress.textContent = `Generation complete: ${result.images.length} image(s) ready.`;

  if (result.images[0]) document.getElementById("generated-preview").dataset.imageId = result.images[0].id;

  renderImageGeneration();

}

document.getElementById("image-defaults-btn").addEventListener("click", () => { void applyImageDefaults(); });

document.getElementById("generate-images-btn").addEventListener("click", () => { void generateImages(); });

document.getElementById("regenerate-image-btn").addEventListener("click", () => { void generateImages(); });

document.getElementById("save-image-btn").addEventListener("click", () => { document.getElementById("image-progress").textContent = "Saved in persistent generation history."; });

function videoAssetUrl(pkg, kind) { return `/api/video-audio-generation/packages/${pkg.id}/${kind}`; }

function renderVideoAudioGeneration() {

  const project = workspaceData?.activeProject;

  document.getElementById("video-empty").classList.toggle("hidden", Boolean(project && videoAudioData));

  document.getElementById("video-content").classList.toggle("hidden", !project || !videoAudioData);

  if (!project || !videoAudioData) return;

  const imageSelect = document.getElementById("video-image");

  imageSelect.innerHTML = `<option value="">No generated image</option>${videoAudioData.images.map((image) => `<option value="${image.id}">${escapeHtml(image.name)}</option>`).join("")}`;

  const modelSelect = document.getElementById("video-model"); const modelValue = modelSelect.value;

  modelSelect.innerHTML = `<option value="">Automatic</option>${videoAudioData.models.filter((model) => model.category === "video").map((model) => `<option value="${model.id}" ${model.id === modelValue ? "selected" : ""}>${escapeHtml(model.name)} · ${escapeHtml(model.status)}</option>`).join("")}`;

  const packages = videoAudioData.packages ?? [];

  document.getElementById("video-gallery").innerHTML = packages.length ? packages.map((pkg) => `<button class="video-tile" data-video-package="${pkg.id}"><img src="${videoAssetUrl(pkg, "preview")}" alt="${escapeHtml(pkg.name)}"><span>${escapeHtml(pkg.name)}</span><small>${pkg.durationSeconds}s · ${pkg.quality.score}/100</small></button>`).join("") : '<span class="muted">No generated video packages for this project.</span>';

  const previewId = document.getElementById("video-preview").dataset.packageId || packages[0]?.id;

  const selected = packages.find((pkg) => pkg.id === previewId) ?? packages[0];

  document.getElementById("video-preview").dataset.packageId = selected?.id ?? "";

  document.getElementById("video-preview").innerHTML = selected ? `<img src="${videoAssetUrl(selected, "preview")}" alt="${escapeHtml(selected.name)}">` : '<span class="muted">Generate a video package to preview it.</span>';

  const audio = document.getElementById("video-audio"); audio.src = selected ? videoAssetUrl(selected, "audio") : "";

  const subtitle = document.getElementById("video-subtitle-link"); subtitle.href = selected?.subtitleFileName ? videoAssetUrl(selected, "subtitles") : "#"; subtitle.style.display = selected?.subtitleFileName ? "inline-block" : "none";

  document.getElementById("video-information").innerHTML = selected ? `<div><span>Video model</span><strong>${escapeHtml(selected.videoModelId)}</strong></div><div><span>Audio model</span><strong>${escapeHtml(selected.audioModelId)}</strong></div><div><span>Timeline</span><strong>${selected.timeline.length} scenes · ${selected.frameRate} fps</strong></div><div><span>Quality</span><strong>${selected.quality.score}/100</strong></div><p>${escapeHtml(selected.quality.notes.join(" "))}</p>` : "";

  document.getElementById("video-history").innerHTML = videoAudioData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No video generation history yet.</span>';

  document.querySelectorAll("[data-video-package]").forEach((button) => button.addEventListener("click", () => { document.getElementById("video-preview").dataset.packageId = button.dataset.videoPackage; renderVideoAudioGeneration(); }));

}

async function loadVideoAudioGeneration() {

  const project = workspaceData?.activeProject;

  if (!project) { renderVideoAudioGeneration(); return; }

  const result = await api(`/video-audio-generation?projectId=${encodeURIComponent(project.id)}`);

  if (!result.error) videoAudioData = result;

  renderVideoAudioGeneration();

}

async function applyVideoDefaults() {

  const project = workspaceData?.activeProject; if (!project) return;

  const result = await api(`/video-audio-generation/projects/${project.id}/default`); if (result.error) return workspaceError(result.error);

  const request = result.request;

  document.getElementById("video-prompt").value = request.prompt ?? ""; document.getElementById("video-mode").value = request.mode ?? "text-to-video"; document.getElementById("video-duration").value = request.durationSeconds ?? 15; document.getElementById("video-resolution").value = request.resolution ?? "1080p"; document.getElementById("video-frame-rate").value = request.frameRate ?? 30; document.getElementById("video-voice").value = request.voice ?? "narrator"; document.getElementById("video-music").value = request.music ?? "uplifting"; document.getElementById("video-sfx").checked = request.soundEffects ?? true; document.getElementById("video-subtitles").checked = request.subtitles ?? true; document.getElementById("video-image").value = request.imageId ?? "";

}

async function generateVideoPackage() {

  const project = workspaceData?.activeProject; if (!project) return;

  const progress = document.getElementById("video-progress"); progress.textContent = "Building video scenes, voice, music, subtitles, and synchronized audio...";

  const result = await api("/video-audio-generation/generate", "POST", { projectId: project.id, prompt: document.getElementById("video-prompt").value, mode: document.getElementById("video-mode").value, videoModelId: document.getElementById("video-model").value || undefined, imageId: document.getElementById("video-image").value || undefined, durationSeconds: Number(document.getElementById("video-duration").value), resolution: document.getElementById("video-resolution").value, frameRate: Number(document.getElementById("video-frame-rate").value), voice: document.getElementById("video-voice").value, music: document.getElementById("video-music").value, soundEffects: document.getElementById("video-sfx").checked, subtitles: document.getElementById("video-subtitles").checked });

  if (result.error) { progress.textContent = "Generation paused."; return workspaceError(result.error); }

  videoAudioData = result.dashboard; document.getElementById("video-preview").dataset.packageId = result.package.id; progress.textContent = "Package ready: animated preview, WAV mix, subtitles, and synchronized timeline."; renderVideoAudioGeneration();

}

document.getElementById("video-defaults-btn").addEventListener("click", () => { void applyVideoDefaults(); });
document.getElementById("generate-video-btn").addEventListener("click", () => { void generateVideoPackage(); });
document.getElementById("regenerate-video-btn").addEventListener("click", () => { void generateVideoPackage(); });
document.getElementById("save-video-btn").addEventListener("click", () => { document.getElementById("video-progress").textContent = "Saved in persistent video generation history."; });

function renderOptimizationRows(tasks, retryable = false) {

  return tasks.length ? tasks.map((task) => {

    const selected = task.results?.find((result) => result.id === task.selectedResultId);

    return `<div><strong>${escapeHtml(task.request.target)} · ${task.status} ${selected ? `· ${selected.quality.score}/100` : ""}</strong><span>${task.progress}% · ${task.attempts}/${task.maxAttempts} attempt(s)${task.error ? ` · ${escapeHtml(task.error)}` : ""}</span>${retryable ? `<button class="btn btn-sm" data-optimization-retry="${task.id}">Retry</button>` : ""}</div>`;

  }).join("") : '<span class="muted">No tasks in this state.</span>';

}

function renderOptimizationEntries(entries) {

  return Object.entries(entries ?? {}).map(([key, value]) => `<div><span>${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("");

}

function renderGenerationOptimization() {

  const project = workspaceData?.activeProject;

  document.getElementById("optimization-empty").classList.toggle("hidden", Boolean(project && optimizationData));

  document.getElementById("optimization-content").classList.toggle("hidden", !project || !optimizationData);

  if (!project || !optimizationData) return;

  const target = document.getElementById("optimization-target").value;

  const select = document.getElementById("optimization-models");

  const selected = [...select.selectedOptions].map((option) => option.value);

  const category = target === "image" ? "image" : "video";

  select.innerHTML = (modelData?.models ?? []).filter((model) => model.category === category && model.status !== "removed").map((model) => `<option value="${model.id}" ${selected.includes(model.id) ? "selected" : ""}>${escapeHtml(model.name)} · ${escapeHtml(model.status)}</option>`).join("") || '<option disabled>No compatible models available</option>';

  const tasks = optimizationData.tasks ?? [];

  const history = optimizationData.history ?? [];

  document.getElementById("optimization-active").innerHTML = renderOptimizationRows(tasks.filter((task) => task.status === "queued" || task.status === "running"));

  document.getElementById("optimization-completed").innerHTML = renderOptimizationRows(history.filter((task) => task.status === "completed"));

  document.getElementById("optimization-failed").innerHTML = renderOptimizationRows([...tasks, ...history].filter((task) => task.status === "failed"), true);

  document.getElementById("optimization-performance").innerHTML = renderOptimizationEntries(optimizationData.performance);

  document.getElementById("optimization-analytics").innerHTML = renderOptimizationEntries({ ...optimizationData.analytics, ...optimizationData.queue });

  document.getElementById("optimization-metrics").innerHTML = `<div><span>Queue</span><strong>${escapeHtml(String(optimizationData.queue?.state ?? "idle"))}</strong></div><div><span>GPU usage</span><strong>${escapeHtml(String(optimizationData.performance?.gpuUsagePercent ?? 0))}%</strong></div><div><span>CPU usage</span><strong>${escapeHtml(String(optimizationData.performance?.cpuUsage ?? 0))}%</strong></div><div><span>RAM</span><strong>${escapeHtml(String(optimizationData.performance?.ramUsageMb ?? 0))} MB</strong></div>`;

  document.getElementById("optimization-logs").innerHTML = optimizationData.logs?.slice(0, 12).map((entry) => `<div><strong>${escapeHtml(entry.level)}</strong><span>${escapeHtml(entry.message)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No optimization logs yet.</span>';

  document.querySelectorAll("[data-optimization-retry]").forEach((button) => button.addEventListener("click", () => { void retryOptimization(button.dataset.optimizationRetry); }));

}

async function loadGenerationOptimization() {

  const project = workspaceData?.activeProject;

  if (!project) { renderGenerationOptimization(); return; }

  const result = await api(`/generation-optimization?projectId=${encodeURIComponent(project.id)}`);

  if (!result.error) optimizationData = result;

  renderGenerationOptimization();

}

async function applyOptimizationDefaults() {

  const project = workspaceData?.activeProject; if (!project) return;

  const result = await api(`/image-generation/projects/${project.id}/default`);

  if (result.error) return workspaceError(result.error);

  document.getElementById("optimization-prompt").value = result.request.prompt ?? "";

}

function optimizationRequest(project, target, prompt, models, maxAttempts, variation) {

  const enhancedPrompt = variation ? `${prompt} Variation ${variation + 1}` : prompt;

  if (target === "image") return { target, projectId: project.id, candidateModelIds: models, maxAttempts, image: { projectId: project.id, prompt: enhancedPrompt, mode: "marketing-banner", style: "studio", aspectRatio: "1:1", resolution: "high", count: 1 } };

  return { target, projectId: project.id, candidateModelIds: models, maxAttempts, videoAudio: { projectId: project.id, prompt: enhancedPrompt, mode: "marketing-video", durationSeconds: 6, resolution: "720p", frameRate: 24, voice: "narrator", music: "uplifting", soundEffects: true, subtitles: true } };

}

async function optimizeGeneration() {

  const project = workspaceData?.activeProject; if (!project) return;

  const target = document.getElementById("optimization-target").value;

  const prompt = document.getElementById("optimization-prompt").value;

  const models = [...document.getElementById("optimization-models").selectedOptions].map((option) => option.value);

  const maxAttempts = Number(document.getElementById("optimization-retries").value);

  const batchSize = Number(document.getElementById("optimization-batch-size").value);

  const progress = document.getElementById("optimization-progress"); progress.textContent = "Scheduling candidate models, quality validation, and best-result selection...";

  const requests = Array.from({ length: batchSize }, (_, variation) => optimizationRequest(project, target, prompt, models, maxAttempts, variation));

  const result = await api(batchSize === 1 ? "/generation-optimization/optimize" : "/generation-optimization/batch", "POST", batchSize === 1 ? requests[0] : { projectId: project.id, requests });

  if (result.error) { progress.textContent = "Optimization paused."; return workspaceError(result.error); }

  optimizationData = result.dashboard; progress.textContent = batchSize === 1 ? `Optimization complete: quality ${result.task.results.find((item) => item.id === result.task.selectedResultId)?.quality.score ?? "pending"}/100 selected.` : `${result.tasks.length} optimization tasks completed.`; renderGenerationOptimization();

}

async function retryOptimization(taskId) {

  const result = await api(`/generation-optimization/tasks/${taskId}/retry`, "POST");

  if (result.error) return workspaceError(result.error);

  optimizationData = result.dashboard; document.getElementById("optimization-progress").textContent = "Retry completed with a fresh validation pass."; renderGenerationOptimization();

}

document.getElementById("optimization-defaults-btn").addEventListener("click", () => { void applyOptimizationDefaults(); });
document.getElementById("optimize-generation-btn").addEventListener("click", () => { void optimizeGeneration(); });
document.getElementById("optimization-target").addEventListener("change", renderGenerationOptimization);

function renderProductEntries(entries) {

  return Object.entries(entries ?? {}).map(([key, value]) => `<div><span>${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</span><strong>${escapeHtml(Array.isArray(value) ? value.join(", ") : String(value))}</strong></div>`).join("");

}

function renderProductIntelligence() {

  const project = workspaceData?.activeProject;

  document.getElementById("product-intelligence-empty").classList.toggle("hidden", Boolean(project && productIntelligenceData));

  document.getElementById("product-intelligence-content").classList.toggle("hidden", !project || !productIntelligenceData);

  if (!project || !productIntelligenceData) return;

  const profile = productIntelligenceData.profiles?.[0];

  document.getElementById("product-intelligence-images").innerHTML = project.productImages.length ? project.productImages.map((image) => `<div class="generated-tile"><img src="${image.url}" alt="${escapeHtml(image.fileName)}"><span>${escapeHtml(image.fileName)}</span></div>`).join("") : '<span class="muted">Upload product images in Creative Workspace to enable analysis.</span>';

  document.getElementById("product-intelligence-overview").innerHTML = profile ? renderProductEntries({ product: profile.productName, identifiedAs: profile.identifiedAs, category: profile.category, views: profile.viewCount, qualityScore: `${profile.quality.score}/100`, confidence: `${profile.quality.confidence}/100` }) + `<ul>${profile.quality.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : '<span class="muted">Run analysis to create a digital product profile.</span>';

  document.getElementById("product-intelligence-identification").innerHTML = profile ? renderProductEntries({ identification: profile.identifiedAs, category: profile.category, brand: profile.brand }) : "";

  document.getElementById("product-intelligence-materials").innerHTML = profile ? renderProductEntries({ materials: profile.materials, colours: profile.colours, texture: profile.textures }) : "";

  document.getElementById("product-intelligence-features").innerHTML = profile ? renderProductEntries({ shape: profile.shapes, features: profile.features, functions: profile.functions }) : "";

  document.getElementById("product-intelligence-relationships").innerHTML = profile?.relationships?.length ? profile.relationships.map((relationship) => `<div><strong>${escapeHtml(relationship.type)}</strong><span>${escapeHtml(relationship.target)} · ${relationship.confidence}% confidence</span></div>`).join("") : '<span class="muted">No relationship analysis yet.</span>';

  document.getElementById("product-intelligence-analytics").innerHTML = renderProductEntries(productIntelligenceData.analytics);

  document.getElementById("product-intelligence-history").innerHTML = productIntelligenceData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No product analysis history yet.</span>';

  document.getElementById("product-intelligence-logs").innerHTML = productIntelligenceData.logs?.slice(0, 12).map((entry) => `<div><strong>${escapeHtml(entry.level)}</strong><span>${escapeHtml(entry.message)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No product intelligence logs yet.</span>';

}

async function loadProductIntelligence() {

  const project = workspaceData?.activeProject;

  if (!project) { renderProductIntelligence(); return; }

  const result = await api(`/product-intelligence?projectId=${encodeURIComponent(project.id)}`);

  if (!result.error) productIntelligenceData = result;

  renderProductIntelligence();

}

async function analyzeProduct() {

  const project = workspaceData?.activeProject; if (!project) return;

  const progress = document.getElementById("product-intelligence-progress"); progress.textContent = "Grouping uploaded product views and evaluating category, brand, material, colour, texture, shape, and quality...";

  const result = await api(`/product-intelligence/projects/${project.id}/analyze`, "POST");

  if (result.error) { progress.textContent = "Product analysis paused."; return workspaceError(result.error); }

  productIntelligenceData = result.dashboard; progress.textContent = `Digital product profile ready: ${result.profile.identifiedAs} · ${result.profile.quality.score}/100 quality.`; renderProductIntelligence();

}

document.getElementById("analyze-product-btn").addEventListener("click", () => { void analyzeProduct(); });

function renderImageIntelligence() {

  const project = workspaceData?.activeProject;

  document.getElementById("image-intelligence-empty").classList.toggle("hidden", Boolean(project && imageIntelligenceData));

  document.getElementById("image-intelligence-content").classList.toggle("hidden", !project || !imageIntelligenceData);

  if (!project || !imageIntelligenceData) return;

  const profiles = imageIntelligenceData.profiles ?? [];

  const selectedId = document.getElementById("image-intelligence-preview").dataset.imageId || profiles[0]?.imageId;

  const selected = profiles.find((profile) => profile.imageId === selectedId) ?? profiles[0];

  const original = project.productImages.find((image) => image.id === selected?.imageId);

  document.getElementById("image-intelligence-gallery").innerHTML = project.productImages.length ? project.productImages.map((image) => { const profile = profiles.find((item) => item.imageId === image.id); return `<button class="generated-tile ${image.id === selected?.imageId ? "selected" : ""}" data-intelligence-image="${image.id}"><img src="${image.url}" alt="${escapeHtml(image.fileName)}"><span>${escapeHtml(image.fileName)}${profile ? ` · ${profile.quality.score}/100` : ""}</span></button>`; }).join("") : '<span class="muted">Upload product images in Creative Workspace to enable analysis.</span>';

  document.getElementById("image-intelligence-preview").dataset.imageId = selected?.imageId ?? "";

  document.getElementById("image-intelligence-preview").innerHTML = original ? `<img src="${original.url}" alt="${escapeHtml(original.fileName)}">` : '<span class="muted">Analyze uploaded images to inspect a profile.</span>';

  document.getElementById("image-intelligence-overview").innerHTML = selected ? renderProductEntries({ image: selected.fileName, qualityScore: `${selected.quality.score}/100`, confidence: `${selected.quality.confidence}/100`, scene: selected.scene }) + `<ul>${selected.quality.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : '<span class="muted">No image intelligence profile yet.</span>';

  document.getElementById("image-intelligence-lighting").innerHTML = selected ? renderProductEntries({ background: `${selected.background.type} (${selected.background.confidence}%)`, removable: selected.background.removable ? "recommended for future masking" : "verify visually", lighting: selected.lighting, shadows: selected.shadows, reflections: selected.reflections }) : "";

  document.getElementById("image-intelligence-composition").innerHTML = selected ? renderProductEntries({ cameraAngle: selected.cameraAngle, composition: selected.composition, perspective: selected.perspective }) : "";

  document.getElementById("image-intelligence-objects").innerHTML = selected ? renderProductEntries({ objects: selected.objects.map((object) => `${object.label} (${object.confidence}%)`), enhancements: selected.enhancements }) : "";

  document.getElementById("image-intelligence-defects").innerHTML = selected ? (selected.defects.length ? selected.defects.map((defect) => `<div><strong>Flag</strong><span>${escapeHtml(defect)}</span></div>`).join("") : '<span class="muted">No metadata-based defect flags.</span>') : "";

  document.getElementById("image-intelligence-analytics").innerHTML = renderProductEntries(imageIntelligenceData.analytics);

  document.getElementById("image-intelligence-history").innerHTML = imageIntelligenceData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No image analysis history yet.</span>';

  document.getElementById("image-intelligence-logs").innerHTML = imageIntelligenceData.logs?.slice(0, 12).map((entry) => `<div><strong>${escapeHtml(entry.level)}</strong><span>${escapeHtml(entry.message)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No image intelligence logs yet.</span>';

  document.querySelectorAll("[data-intelligence-image]").forEach((button) => button.addEventListener("click", () => { document.getElementById("image-intelligence-preview").dataset.imageId = button.dataset.intelligenceImage; renderImageIntelligence(); }));

}

async function loadImageIntelligence() {

  const project = workspaceData?.activeProject;

  if (!project) { renderImageIntelligence(); return; }

  const result = await api(`/image-intelligence?projectId=${encodeURIComponent(project.id)}`);

  if (!result.error) imageIntelligenceData = result;

  renderImageIntelligence();

}

async function analyzeImages() {

  const project = workspaceData?.activeProject; if (!project) return;

  const progress = document.getElementById("image-intelligence-progress"); progress.textContent = "Analyzing quality, background, lighting, reflections, camera, composition, objects, scene, and enhancement decisions...";

  const result = await api(`/image-intelligence/projects/${project.id}/analyze`, "POST");

  if (result.error) { progress.textContent = "Image analysis paused."; return workspaceError(result.error); }

  imageIntelligenceData = result.dashboard; progress.textContent = `${result.profiles.length} uploaded image profile(s) ready.`; renderImageIntelligence();

}

document.getElementById("analyze-images-btn").addEventListener("click", () => { void analyzeImages(); });

function renderMarketingIntelligence() {

  const project = workspaceData?.activeProject;
  document.getElementById("analyze-marketing-btn").disabled = !project;
  document.getElementById("marketing-intelligence-empty").classList.toggle("hidden", Boolean(project && marketingIntelligenceData));
  document.getElementById("marketing-intelligence-content").classList.toggle("hidden", !project || !marketingIntelligenceData);
  if (!project || !marketingIntelligenceData) return;

  const profile = marketingIntelligenceData.profiles?.[0];
  const empty = '<span class="muted">No marketing strategy profile yet.</span>';
  document.getElementById("marketing-intelligence-product").innerHTML = profile ? renderProductEntries({ overview: profile.productOverview, valueProposition: profile.valueProposition }) : empty;
  document.getElementById("marketing-intelligence-score").innerHTML = profile ? renderProductEntries({ marketingScore: `${profile.score}/100`, readiness: profile.performancePrediction, cached: profile.cached ? "restored from matching project evidence" : "current analysis" }) : empty;
  document.getElementById("marketing-intelligence-audience").innerHTML = profile ? renderProductEntries({ persona: profile.audience.persona, needs: profile.audience.needs, messaging: profile.audience.messaging }) : empty;
  document.getElementById("marketing-intelligence-brand").innerHTML = profile ? renderProductEntries(profile.brand) : empty;
  document.getElementById("marketing-intelligence-campaign").innerHTML = profile ? renderProductEntries(profile.campaign) : empty;
  document.getElementById("marketing-intelligence-value").innerHTML = profile ? renderProductEntries({ sellingPoints: profile.sellingPoints, valueProposition: profile.valueProposition }) : empty;
  document.getElementById("marketing-intelligence-strategy").innerHTML = profile ? renderProductEntries({ strategy: profile.strategy, callToActionSuggestions: profile.ctas }) : empty;
  document.getElementById("marketing-intelligence-platform").innerHTML = profile ? renderProductEntries({ platform: profile.platform.name, format: profile.platform.format, recommendations: profile.platform.recommendations }) : empty;
  document.getElementById("marketing-intelligence-competitors").innerHTML = profile?.competitors?.length ? profile.competitors.map((item) => `<div><strong>Category insight</strong><span>${escapeHtml(item)}</span></div>`).join("") : '<span class="muted">Category-level insights appear after analysis.</span>';
  document.getElementById("marketing-intelligence-analytics").innerHTML = renderProductEntries(marketingIntelligenceData.analytics ?? {});
  document.getElementById("marketing-intelligence-history").innerHTML = marketingIntelligenceData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No marketing analysis history yet.</span>';
  document.getElementById("marketing-intelligence-logs").innerHTML = marketingIntelligenceData.logs?.slice(0, 12).map((entry) => `<div><strong>${escapeHtml(entry.level)}</strong><span>${escapeHtml(entry.message)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No marketing intelligence logs yet.</span>';
}

async function loadMarketingIntelligence() {

  const project = workspaceData?.activeProject;
  if (!project) { renderMarketingIntelligence(); return; }
  const result = await api(`/marketing-intelligence?projectId=${encodeURIComponent(project.id)}`);
  if (!result.error) marketingIntelligenceData = result;
  renderMarketingIntelligence();
}

async function analyzeMarketing() {

  const project = workspaceData?.activeProject; if (!project) return;
  const progress = document.getElementById("marketing-intelligence-progress"); progress.textContent = "Connecting product, image, audience, brand, platform, campaign, and CTA evidence...";
  const result = await api(`/marketing-intelligence/projects/${project.id}/analyze`, "POST");
  if (result.error) { progress.textContent = "Marketing analysis paused."; return workspaceError(result.error); }
  marketingIntelligenceData = result.dashboard; progress.textContent = `Marketing strategy profile ready: ${result.profile.score}/100 readiness.`; renderMarketingIntelligence();
}

document.getElementById("analyze-marketing-btn").addEventListener("click", () => { void analyzeMarketing(); });

function renderDecisionIntelligence() {

  const project = workspaceData?.activeProject;
  document.getElementById("make-decision-btn").disabled = !project;
  document.getElementById("decision-intelligence-empty").classList.toggle("hidden", Boolean(project && decisionIntelligenceData));
  document.getElementById("decision-intelligence-content").classList.toggle("hidden", !project || !decisionIntelligenceData);
  if (!project || !decisionIntelligenceData) return;
  const profile = decisionIntelligenceData.profiles?.[0]; const empty = '<span class="muted">No recorded execution decision yet.</span>';
  document.getElementById("decision-intelligence-overview").innerHTML = profile ? renderProductEntries({ objective: profile.objective, task: profile.taskKind, priority: profile.priority, learnedFrom: profile.learnedFrom }) : empty;
  document.getElementById("decision-intelligence-score").innerHTML = profile ? renderProductEntries({ selectedScore: `${profile.selected.score}/100`, confidence: `${profile.confidence}%`, cache: profile.cached ? "restored from matching project evidence" : "current analysis" }) : empty;
  document.getElementById("decision-intelligence-options").innerHTML = profile?.options?.length ? profile.options.map((option) => `<div><strong>${escapeHtml(option.label)} · ${option.score}/100</strong><span>${escapeHtml(option.workflow)} · ${escapeHtml(option.risk)} risk · ${escapeHtml(option.resourceCost)} resources</span></div>`).join("") : empty;
  document.getElementById("decision-intelligence-strategy").innerHTML = profile ? renderProductEntries({ strategy: profile.selected.label, creativeApproach: profile.selected.creativeApproach, renderingStrategy: profile.selected.renderingStrategy, reasons: profile.selected.reasons }) : empty;
  document.getElementById("decision-intelligence-resources").innerHTML = profile ? renderProductEntries({ availableRam: `${profile.resourceAnalysis.availableRamMb} MB`, availableStorage: `${profile.resourceAnalysis.availableStorageMb} MB`, gpuAvailable: profile.resourceAnalysis.gpuAvailable ? "yes" : "no", recommendation: profile.resourceAnalysis.recommendation }) : empty;
  document.getElementById("decision-intelligence-workflow").innerHTML = profile ? renderProductEntries({ workflow: profile.selected.workflow, priority: profile.priority }) : empty;
  document.getElementById("decision-intelligence-model").innerHTML = profile ? renderProductEntries(profile.modelRecommendation) : empty;
  document.getElementById("decision-intelligence-explanation").innerHTML = profile ? renderProductEntries({ explanation: profile.explanation, risks: profile.risks }) : empty;
  document.getElementById("decision-intelligence-analytics").innerHTML = renderProductEntries(decisionIntelligenceData.analytics ?? {});
  document.getElementById("decision-intelligence-history").innerHTML = decisionIntelligenceData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No decision history yet.</span>';
  document.getElementById("decision-intelligence-logs").innerHTML = decisionIntelligenceData.logs?.slice(0, 12).map((entry) => `<div><strong>${escapeHtml(entry.level)}</strong><span>${escapeHtml(entry.message)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No decision intelligence logs yet.</span>';
}

async function loadDecisionIntelligence() {

  const project = workspaceData?.activeProject;
  if (!project) { renderDecisionIntelligence(); return; }
  const result = await api(`/decision-intelligence?projectId=${encodeURIComponent(project.id)}`);
  if (!result.error) decisionIntelligenceData = result;
  renderDecisionIntelligence();
}

async function makeDecision() {

  const project = workspaceData?.activeProject; if (!project) return;
  const progress = document.getElementById("decision-intelligence-progress"); progress.textContent = "Comparing execution strategies, available models, resources, risks, and prior decisions...";
  const result = await api(`/decision-intelligence/projects/${project.id}/decide`, "POST", { taskKind: "pipeline" });
  if (result.error) { progress.textContent = "Decision analysis paused."; return workspaceError(result.error); }
  decisionIntelligenceData = result.dashboard; progress.textContent = `${result.decision.selected.label} selected at ${result.decision.confidence}% confidence.`; renderDecisionIntelligence();
}

document.getElementById("make-decision-btn").addEventListener("click", () => { void makeDecision(); });

function renderLearningIntelligence() {

  const project = workspaceData?.activeProject;
  document.getElementById("learn-project-btn").disabled = !project;
  document.getElementById("submit-learning-feedback-btn").disabled = !project;
  document.getElementById("learning-intelligence-empty").classList.toggle("hidden", Boolean(project && learningIntelligenceData));
  document.getElementById("learning-intelligence-content").classList.toggle("hidden", !project || !learningIntelligenceData);
  if (!project || !learningIntelligenceData) return;
  const profile = learningIntelligenceData.profiles?.[0]; const empty = '<span class="muted">No learning profile recorded for this project yet.</span>';
  document.getElementById("learning-intelligence-overview").innerHTML = profile ? renderProductEntries({ project: project.name, progress: `${profile.progress}%`, status: profile.cached ? "restored from matching experience" : "current learning profile" }) : empty;
  document.getElementById("learning-intelligence-growth").innerHTML = profile ? renderProductEntries({ learningProgress: `${profile.progress}%`, knowledgeGrowth: `+${profile.knowledgeGrowth}`, updatedAt: new Date(profile.updatedAt).toLocaleString() }) : empty;
  document.getElementById("learning-intelligence-experiences").innerHTML = learningIntelligenceData.experiences?.length ? learningIntelligenceData.experiences.slice(0, 8).map((item) => `<div><strong>${escapeHtml(item.title)} · ${item.qualityScore}/100</strong><span>${escapeHtml(item.outcome)} · ${escapeHtml(item.lesson)}</span></div>`).join("") : '<span class="muted">Completed, failed, and feedback experiences appear here.</span>';
  document.getElementById("learning-intelligence-improvements").innerHTML = profile ? renderProductEntries({ improvements: profile.improvements }) : empty;
  document.getElementById("learning-intelligence-recommendations").innerHTML = profile ? renderProductEntries({ recommendations: profile.recommendationHistory }) : empty;
  document.getElementById("learning-intelligence-preferences").innerHTML = profile ? renderProductEntries({ learnedPreferences: profile.userPreferences }) : empty;
  document.getElementById("learning-intelligence-report").innerHTML = profile ? renderProductEntries({ improvements: profile.improvements, recommendations: profile.recommendationHistory }) : empty;
  document.getElementById("learning-intelligence-evolution").innerHTML = profile?.evolution?.length ? profile.evolution.map((item) => `<div><strong>Evolution</strong><span>${escapeHtml(item)}</span></div>`).join("") : empty;
  document.getElementById("learning-intelligence-analytics").innerHTML = renderProductEntries(learningIntelligenceData.analytics ?? {});
  document.getElementById("learning-intelligence-history").innerHTML = learningIntelligenceData.history?.slice(0, 8).map((entry) => `<div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No learning history yet.</span>';
  document.getElementById("learning-intelligence-logs").innerHTML = learningIntelligenceData.logs?.slice(0, 12).map((entry) => `<div><strong>${escapeHtml(entry.level)}</strong><span>${escapeHtml(entry.message)} · ${new Date(entry.at).toLocaleString()}</span></div>`).join("") || '<span class="muted">No learning logs yet.</span>';
}

async function loadLearningIntelligence() {

  const project = workspaceData?.activeProject;
  if (!project) { renderLearningIntelligence(); return; }
  const result = await api(`/learning-intelligence?projectId=${encodeURIComponent(project.id)}`);
  if (!result.error) learningIntelligenceData = result;
  renderLearningIntelligence();
}

async function learnProject() {

  const project = workspaceData?.activeProject; if (!project) return;
  const progress = document.getElementById("learning-intelligence-progress"); progress.textContent = "Collecting product, image, marketing, decision, creative, and workflow experience signals...";
  const result = await api(`/learning-intelligence/projects/${project.id}/learn`, "POST", { outcome: "success" });
  if (result.error) { progress.textContent = "Learning collection paused."; return workspaceError(result.error); }
  learningIntelligenceData = result.dashboard; progress.textContent = `Learning profile updated: ${result.profile.progress}% progress and +${result.profile.knowledgeGrowth} knowledge growth.`; renderLearningIntelligence();
}

async function submitLearningFeedback() {

  const project = workspaceData?.activeProject; const feedback = document.getElementById("learning-feedback").value.trim(); if (!project || !feedback) return workspaceError("Enter feedback before recording a learning signal.");
  const result = await api(`/learning-intelligence/projects/${project.id}/feedback`, "POST", { feedback });
  if (result.error) return workspaceError(result.error);
  learningIntelligenceData = result.dashboard; document.getElementById("learning-feedback").value = ""; document.getElementById("learning-intelligence-progress").textContent = "Feedback stored as a user preference learning signal."; renderLearningIntelligence();
}

document.getElementById("learn-project-btn").addEventListener("click", () => { void learnProject(); });
document.getElementById("submit-learning-feedback-btn").addEventListener("click", () => { void submitLearningFeedback(); });



load();

setInterval(load, 30_000);


