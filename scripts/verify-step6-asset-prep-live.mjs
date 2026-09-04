/**
 * Live VPS verification for STEP 6 — asset preparation & quality engine.
 */
import { deflateSync } from "node:zlib";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "16517189459c6b2fee9d011b04e51a54921f3612").slice(0, 40);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeProductPngBase64(width, height, r, g, b) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4;
      const inProduct = x > width * 0.25 && x < width * 0.75 && y > height * 0.2 && y < height * 0.8;
      raw[i] = inProduct ? r : 255;
      raw[i + 1] = inProduct ? g : 255;
      raw[i + 2] = inProduct ? b : 255;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

async function api(pathname, { method = "GET", body, retries = 12 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      if (res.ok) return { status: res.status, json };
      last = { status: res.status, json, text };
      if (res.status === 503 || res.status === 429 || (json && json.status === "starting")) {
        await new Promise((r) => setTimeout(r, 2000 + attempt * 1000));
        continue;
      }
      return { status: res.status, json, text };
    } catch (error) {
      last = { status: 0, json: null, text: error instanceof Error ? error.message : String(error) };
      await new Promise((r) => setTimeout(r, 2500 + attempt * 1000));
    }
  }
  return last;
}

async function waitReady() {
  for (let i = 0; i < 30; i += 1) {
    const health = await api("/api/health", { retries: 1 });
    if (health.status === 200 && health.json?.status !== "starting") return health;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Server not ready");
}

async function main() {
  const tag = Date.now().toString(36);
  const results = [];
  const mark = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  await waitReady();
  const health = await api("/api/health");
  mark("health", health.status === 200, `status=${health.status}`);

  const deploy = await api("/api/deployment");
  const deployedCommit = String(deploy.json?.deployedCommit || "");
  mark(
    "deployed-commit",
    deploy.json?.verifiedLive === true && deployedCommit.startsWith(EXPECTED.slice(0, 7)),
    `deployed=${deployedCommit.slice(0, 7)} expected=${EXPECTED.slice(0, 7)} verifiedLive=${deploy.json?.verifiedLive}`,
  );

  const create = await api("/api/workspace/projects", {
    method: "POST",
    body: { name: `STEP6 Live ${tag}` },
  });
  const projectId = create.json?.project?.id || create.json?.id;
  mark("create-project", Boolean(projectId), projectId || JSON.stringify(create.json).slice(0, 120));
  if (!projectId) {
    console.log(JSON.stringify({ verifiedLive: false, results }, null, 2));
    process.exit(1);
  }

  const update = await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: `STEP6 Shoe ${tag}`,
          category: "Footwear",
          description: "Live verification product for asset preparation",
          price: 55000,
          currency: "RWF",
        },
        brandInformation: { name: "KWIZERA" },
      },
    },
  });
  mark("product-update", update.status < 300, `status=${update.status}`);

  const uploadA = await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: {
      fileName: `front-${tag}.png`,
      mimeType: "image/png",
      dataBase64: makeProductPngBase64(64, 64, 120, 72, 40),
    },
  });
  const assetA = uploadA.json?.image?.id || uploadA.json?.id;
  mark("upload-image-a", uploadA.status < 300 && Boolean(assetA), `status=${uploadA.status}`);

  const uploadB = await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: {
      fileName: `detail-${tag}.png`,
      mimeType: "image/png",
      dataBase64: makeProductPngBase64(68, 68, 40, 90, 140),
    },
  });
  const assetB = uploadB.json?.image?.id || uploadB.json?.id;
  mark("upload-image-b", uploadB.status < 300 && Boolean(assetB), `status=${uploadB.status}`);

  const prepare = await api(`/api/product-asset-preparation/projects/${projectId}/prepare`, {
    method: "POST",
    body: {},
  });
  const preparedDecisions = prepare.json?.result?.preparedDecisions
    || prepare.json?.dashboard?.preparedDecisions
    || [];
  mark(
    "prepare-step6",
    prepare.status < 300 && preparedDecisions.length >= 1,
    `status=${prepare.status} decisions=${preparedDecisions.length} contract=${prepare.json?.result?.step6ContractVersion || "?"} err=${prepare.json?.error || ""}`,
  );

  const decision = preparedDecisions.find((d) => d.assetId === assetA) || preparedDecisions[0];
  mark("decision-identity", Boolean(decision && decision.projectId === projectId && decision.assetId), `project=${decision?.projectId}`);
  mark("original-preserved", decision?.originalPreserved === true, String(decision?.originalPreserved));
  mark("has-role", Boolean(decision?.role?.role), decision?.role?.role);
  mark("has-framing", Boolean(decision?.framing?.formats?.["9:16"]), `nearEdge=${decision?.framing?.nearEdge}`);
  mark(
    "format-aware",
    Boolean(decision?.framing?.formats?.["16:9"] && decision?.framing?.formats?.["1:1"] && decision?.framing?.formats?.["4:5"]),
  );
  mark("background-decision", Boolean(decision?.background?.decision), decision?.background?.decision);
  mark(
    "no-fake-ml-bg",
    decision?.background?.reliableBackgroundRemovalAvailable === false,
    String(decision?.background?.reliableBackgroundRemovalAvailable),
  );

  const decisionsGet = await api(`/api/product-asset-preparation/projects/${projectId}/decisions`);
  mark(
    "decisions-endpoint",
    decisionsGet.status === 200 && (decisionsGet.json?.decisions?.length ?? 0) >= 1,
    `status=${decisionsGet.status} count=${decisionsGet.json?.decisions?.length}`,
  );

  const createB = await api("/api/workspace/projects", {
    method: "POST",
    body: { name: `STEP6 Live B ${tag}` },
  });
  const projectB = createB.json?.project?.id || createB.json?.id;
  if (projectB) {
    await api(`/api/workspace/projects/${projectB}`, {
      method: "POST",
      body: {
        changes: {
          productInformation: {
            name: `Other Product ${tag}`,
            category: "Accessories",
            description: "Isolation check",
            price: 12000,
            currency: "RWF",
          },
        },
      },
    });
    await api(`/api/workspace/projects/${projectB}/images`, {
      method: "POST",
      body: {
        fileName: `other-${tag}.png`,
        mimeType: "image/png",
        dataBase64: makeProductPngBase64(52, 52, 200, 40, 40),
      },
    });
    const prepB = await api(`/api/product-asset-preparation/projects/${projectB}/prepare`, {
      method: "POST",
      body: {},
    });
    const decisionsB = prepB.json?.result?.preparedDecisions || [];
    const leak = decisionsB.some((d) => d.projectId !== projectB || d.assetId === assetA || d.assetId === assetB);
    mark("project-isolation", !leak && decisionsB.every((d) => d.projectId === projectB) && decisionsB.length >= 1, `bDecisions=${decisionsB.length}`);
  } else {
    mark("project-isolation", false, "could not create project B");
  }

  const again = await api(`/api/product-asset-preparation/projects/${projectId}/decisions`);
  mark(
    "persist-restore",
    (again.json?.decisions || []).some((d) => d.assetId === assetA && d.projectId === projectId),
    `count=${again.json?.decisions?.length}`,
  );

  const verifiedLive = results.every((r) => r.ok);
  console.log(JSON.stringify({
    verifiedLive,
    base: BASE,
    projectId,
    preparedCount: preparedDecisions.length,
    sampleRole: decision?.role?.role,
    sampleBackground: decision?.background?.decision,
    deployedCommit,
    results,
  }, null, 2));
  process.exit(verifiedLive ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
