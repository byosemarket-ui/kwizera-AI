/**
 * Eager Automated Trading boot — resumes analysis schedule without an HTTP request.
 */
import { getAutomatedTradingService } from "../../ai/forex-ai/automated-trading/index.js";

export async function bootAutomatedTrading(): Promise<void> {
  try {
    const service = getAutomatedTradingService();
    await service.ensureAutomaticAnalysisScheduleOnBoot();
    console.info("[KWIZERA] Automated Trading boot: schedule resume attempted");
  } catch (error) {
    console.warn(
      "[KWIZERA] Automated Trading boot error:",
      error instanceof Error ? error.message : error,
    );
  }
}
