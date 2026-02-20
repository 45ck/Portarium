"""
Screenshot every cockpit route at localhost:5173
Run: python apps/cockpit/scripts/screenshot-all-routes.py
"""
import os
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:5173"
OUT  = "apps/cockpit/screenshots"

ROUTES = [
    ("00-inbox",                 "/inbox"),
    ("01-dashboard",             "/dashboard"),
    ("02-work-items",            "/work-items"),
    ("03-work-item-detail",      "/work-items/wi-m0001"),
    ("04-runs",                  "/runs"),
    ("05-run-detail",            "/runs/run-m0001"),
    ("06-approvals-pending",     "/approvals"),
    ("07-approvals-triage",      "/approvals?tab=triage"),
    ("08-approval-detail",       "/approvals/apr-m0001"),
    ("09-evidence",              "/evidence"),
    ("10-workforce",             "/workforce"),
    ("11-workforce-member",      "/workforce/wfm-m001"),
    ("12-workforce-queues",      "/workforce/queues"),
    ("13-config-agents",         "/config/agents"),
    ("14-config-agent-detail",   "/config/agents/agent-order-router"),
    ("15-config-adapters",       "/config/adapters"),
    ("16-config-settings",       "/config/settings"),
    ("17-explore-observability", "/explore/observability"),
    ("18-explore-events",        "/explore/events"),
    ("19-explore-governance",    "/explore/governance"),
    ("20-explore-objects",       "/explore/objects"),
    ("21-robotics-robots",       "/robotics/robots"),
    ("22-robotics-missions",     "/robotics/missions"),
    ("23-robotics-safety",       "/robotics/safety"),
    ("24-robotics-gateways",     "/robotics/gateways"),
]

async def main():
    os.makedirs(OUT, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            storage_state={
                "cookies": [],
                "origins": [{
                    "origin": BASE,
                    "localStorage": [
                        {"name": "portarium-dataset", "value": "meridian-demo"},
                        {"name": "portarium-theme",   "value": "default"},
                    ]
                }]
            }
        )

        results = []

        for name, path in ROUTES:
            page = await context.new_page()
            status = "ok"
            error  = None

            try:
                await page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=20000)
                await page.wait_for_timeout(2000)

                body = await page.text_content("body") or ""
                if "Something went wrong" in body:
                    status = "error-boundary-triggered"

                main_el = await page.query_selector("#main-content")
                if not main_el:
                    status = f"{status}+missing-main-id"

                out_path = os.path.join(OUT, f"{name}.png")
                await page.screenshot(path=out_path, full_page=True)
                print(f"  [OK]  {name}")
            except Exception as e:
                status = "crash"
                error  = str(e)
                print(f"  [ERR] {name}: {e}")
                try:
                    await page.screenshot(path=os.path.join(OUT, f"{name}-ERROR.png"))
                except:
                    pass

            results.append({"name": name, "path": path, "status": status, "error": error})
            await page.close()

        await browser.close()

    # Summary
    ok    = [r for r in results if r["status"] == "ok"]
    warn  = [r for r in results if r["status"] not in ("ok", "crash") ]
    crash = [r for r in results if r["status"] == "crash"]

    print("\n-- SUMMARY " + "-" * 40)
    print(f"  OK:    {len(ok)}/{len(results)}")
    if warn:
        print(f"  Warn:  {len(warn)}  ->  {', '.join(r['name'] for r in warn)}")
    if crash:
        print(f"  Crash: {len(crash)}  ->  {', '.join(r['name'] for r in crash)}")
        for r in crash:
            print(f"       {r['name']}: {r['error']}")
    print(f"\n  Screenshots saved to: {OUT}/")

asyncio.run(main())
