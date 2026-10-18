/**
 * Lightweight Phase 51 smoke (no full app).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AUTOMATED_EXECUTION_BANNER,
  getAutomatedTradingService,
  parseAutomatedTradingEnvironment,
  resetAutomatedTradingServiceForTests,
  resetAutomatedTradingStoreForTests,
} from "../ai/forex-ai/automated-trading/index.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("PASS:", msg);
}

assert(parseAutomatedTradingEnvironment("DEMO") === "DEMO", "parse DEMO");
assert(parseAutomatedTradingEnvironment("LIVE") === "LIVE", "parse LIVE");
assert(parseAutomatedTradingEnvironment("nope") === null, "reject invalid env");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p51-"));
resetAutomatedTradingStoreForTests();
resetAutomatedTradingServiceForTests();
const svc = getAutomatedTradingService(tmp);

const status = await svc.buildStatus();
assert(status.selectedEnvironment === "DEMO", "default DEMO");
assert(status.controls.emergencyEntryLock === true, "entry lock default ON");
assert(status.controls.automatedExecutionEnabled === false, "execution off");
assert(status.banner === AUTOMATED_EXECUTION_BANNER, "banner");
assert(status.placesOrders === false, "placesOrders false");

const noConfirm = await svc.selectEnvironment({ environment: "LIVE", confirm: false });
assert(!noConfirm.ok && noConfirm.code === "CONFIRMATION_REQUIRED", "confirm required");

const switched = await svc.selectEnvironment({
  environment: "LIVE",
  confirm: true,
  expectedCurrentEnvironment: "DEMO",
});
assert(switched.ok && switched.status.selectedEnvironment === "LIVE", "switch to LIVE");

const mismatch = await svc.updateControls({
  environment: "DEMO",
  patch: { masterEnable: true },
});
assert(!mismatch.ok && mismatch.code === "ENVIRONMENT_MISMATCH", "env mismatch on controls");

resetAutomatedTradingServiceForTests();
resetAutomatedTradingStoreForTests();
fs.rmSync(tmp, { recursive: true, force: true });

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nPhase 51 smoke OK");
