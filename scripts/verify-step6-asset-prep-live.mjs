/**
 * Live VPS verification for STEP 6 — asset preparation & quality engine.
 */
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";

const BASE = process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173";

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
      if (inProduct) {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
        raw[i + 3] = 255;
      } else {
        raw[i] = 255;
        raw[i + 1] = 255;
        raw[i + 2] = 255;
        raw[i + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text };
}

async function main() {
  const tag = randomUUID().slice(0, 8);
  const results = [];
  const mark = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const health = await req("GET", "/api/health");
  mark("health", health.status > 0, `status=${health.status}`);

  const create = await req("POST", "/api/workspace/projects", {
    name: `STEP6 Live ${tag}`,
  });
  const projectId = create.json?.project?.id || create.json?.id;
  mark("create-project", Boolean(projectId), projectId || create.text.slice(0, 160));
  if (!projectId) {
    console.log(JSON.stringify({ verifiedLive: false, results }, null, 2));
    process.exit(1);
  }

  await req("PATCH", `/api/workspace/projects/${projectId}`, {
    productInformation: {
      name: `STEP6 Shoe ${tag}`,
      category: "Footwear",
      description: "Live verification product for asset preparation",
      price: 55000,
      currency: "RWF",
    },
  });

  const uploadA = await req("POST", `/api/workspace/projects/${projectId}/images`, {
    fileName: `front-${tag}.png`,
    mimeType: "image/png",
    dataBase64: makeProductPngBase64(64, 64, 120, 72, 40),
  });
  const assetA = uploadA.json?.image?.id || uploadA.json?.id;
  mark("upload-image-a", uploadA.status < 300 && Boolean(assetA), `status=${uploadA.status}`);

  const uploadB = await req("POST", `/api/workspace/projects/${projectId}/images`, {
    fileName: `detail-${tag}.png`,
    mimeType: "image/png",
    dataBase64: makeProductPngBase64(64, 64, 40, 90, 140),
  });
  const assetB = uploadB.json?.image?.id || uploadB.json?.id;
  mark("upload-image-b", uploadB.status < 300 && Boolean(assetB), `status=${uploadB.status}`);

  const prepare = await req("POST", `/api/product-asset-preparation/projects/${projectId}/prepare`);
  const preparedDecisions = prepare.json?.result?.preparedDecisions
    || prepare.json?.dashboard?.preparedDecisions
    || [];
  mark(
    "prepare-step6",
    prepare.status < 300 && preparedDecisions.length >= 1,
    `status=${prepare.status} decisions=${preparedDecisions.length} contract=${prepare.json?.result?.step6ContractVersion || "?"}`,
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

  const decisionsGet = await req("GET", `/api/product-asset-preparation/projects/${projectId}/decisions`);
  mark(
    "decisions-endpoint",
    decisionsGet.status === 200 && (decisionsGet.json?.decisions?.length ?? 0) >= 1,
    `status=${decisionsGet.status} count=${decisionsGet.json?.decisions?.length}`,
  );

  const createB = await req("POST", "/api/workspace/projects", { name: `STEP6 Live B ${tag}` });
  const projectB = createB.json?.project?.id || createB.json?.id;
  if (projectB) {
    await req("PATCH", `/api/workspace/projects/${projectB}`, {
      productInformation: {
        name: `Other Product ${tag}`,
        category: "Accessories",
        description: "Isolation check",
        price: 12000,
        currency: "RWF",
      },
    });
    await req("POST", `/api/workspace/projects/${projectB}/images`, {
      fileName: `other-${tag}.png`,
      mimeType: "image/png",
      dataBase64: makeProductPngBase64(48, 48, 200, 40, 40),
    });
    const prepB = await req("POST", `/api/product-asset-preparation/projects/${projectB}/prepare`);
    const decisionsB = prepB.json?.result?.preparedDecisions || [];
    const leak = decisionsB.some((d) => d.projectId !== projectB || d.assetId === assetA || d.assetId === assetB);
    mark("project-isolation", !leak && decisionsB.every((d) => d.projectId === projectB), `bDecisions=${decisionsB.length}`);
  } else {
    mark("project-isolation", false, "could not create project B");
  }

  const again = await req("GET", `/api/product-asset-preparation/projects/${projectId}/decisions`);
  mark(
    "persist-restore",
    (again.json?.decisions || []).some((d) => d.assetId === assetA && d.projectId === projectId),
    `count=${again.json?.decisions?.length}`,
  );

  const critical = results.filter((r) => r.name !== "health");
  const verifiedLive = critical.every((r) => r.ok);
  console.log(JSON.stringify({
    verifiedLive,
    base: BASE,
    projectId,
    preparedCount: preparedDecisions.length,
    sampleRole: decision?.role?.role,
    sampleBackground: decision?.background?.decision,
    results,
  }, null, 2));
  process.exit(verifiedLive ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
