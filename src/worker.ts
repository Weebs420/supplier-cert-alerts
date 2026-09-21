import { runAlertJob } from "./lib/alert-job";
export default {
  async scheduled(event: ScheduledEvent, env: Record<string, unknown>, ctx: ExecutionContext): Promise<void> {
    console.log("[cron] Alert job triggered at", new Date().toISOString());
    try { const result = await runAlertJob(); console.log("[cron] complete:", result); }
    catch (err) { console.error("[cron] failed:", err); throw err; }
  },
};
