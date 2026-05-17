import { Router } from "express";
import { CronService } from "../services/cron-service";
import { lookupService } from "../configure-services";

const router = Router();

router.get("/", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>SensorCentral Admin</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        h1 { color: #333; }
        .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .card h2 { margin-top: 0; }
        .card a { color: #0066cc; text-decoration: none; font-size: 18px; }
        .card a:hover { text-decoration: underline; }
        .card p { color: #666; margin-bottom: 0; }
    </style>
</head>
<body>
    <h1>SensorCentral Admin</h1>
    <div class="card">
        <a href="/admin/queues">Queues (Bull Board)</a>
        <p>Monitor background job queues, view failed jobs, and retry them.</p>
    </div>
    <div class="card">
        <a href="/admin/cronjobs">Scheduled Cron Jobs</a>
        <p>View all currently scheduled cron jobs across all users.</p>
    </div>
</body>
</html>`);
});

router.get("/cronjobs", async (_req, res) => {
    const cronService = (await lookupService(CronService.NAME)) as CronService;
    const jobs = cronService.list();

    const rows = jobs.map(j => {
        const meta = j.metadata || {};
        return `<tr>
            <td>${j.name}</td>
            <td>${meta.userId ? meta.userId : meta.type === "legacy_subscription" ? "(legacy)" : "-"}</td>
            <td>${meta.type || "-"}</td>
            <td>${j.cronTime}</td>
            <td>${j.running ? '<span style="color:green">running</span>' : '<span style="color:grey">stopped</span>'}</td>
            <td>${j.lastDate ? j.lastDate.toISOString() : "-"}</td>
            <td>${j.nextDate ? j.nextDate.toISOString() : "-"}</td>
            <td>${meta.sensorId || "-"}</td>
            <td>${meta.houseId || "-"}</td>
        </tr>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Scheduled Cron Jobs - SensorCentral Admin</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        h1 { color: #333; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #f8f9fa; text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6; font-size: 13px; color: #555; text-transform: uppercase; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        .summary { color: #666; margin-bottom: 20px; }
    </style>
</head>
<body>
    <p><a href="/admin">&larr; Back to Admin</a></p>
    <h1>Scheduled Cron Jobs</h1>
    <p class="summary">${jobs.length} job(s) currently scheduled</p>
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>User</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Next Run</th>
                <th>Sensor</th>
                <th>House</th>
            </tr>
        </thead>
        <tbody>
            ${rows || '<tr><td colspan="9" style="text-align:center;color:#999;padding:20px;">No cron jobs scheduled</td></tr>'}
        </tbody>
    </table>
</body>
</html>`);
});

router.get("/cronjobs/json", async (_req, res) => {
    const cronService = (await lookupService(CronService.NAME)) as CronService;
    const jobs = cronService.list();
    res.json(jobs);
});

export default router;
