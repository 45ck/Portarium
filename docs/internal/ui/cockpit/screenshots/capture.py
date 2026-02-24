"""
Playwright screenshot capture for Nielsen heuristic evaluation.
Captures Workforce integration screens + key related surfaces.
"""
from playwright.sync_api import sync_playwright
import os, time

FILE = "file:///D:/Visual%20Studio%20Projects/VAOP/docs/internal/ui/cockpit/index.html"
OUT = os.path.dirname(os.path.abspath(__file__))

def shot(page, name):
    page.wait_for_timeout(500)
    path = os.path.join(OUT, f"heuristic-{name}.png")
    page.screenshot(path=path, full_page=False)
    print(f"  OK {name}")

def nav(page, hash_):
    page.evaluate(f"document.querySelector('a[href=\"{hash_}\"]')?.click()")
    page.wait_for_timeout(300)

def set_persona(page, val):
    page.select_option("#persona", val)
    page.wait_for_timeout(300)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(FILE, wait_until="networkidle")

    print("Capturing Workforce integration screens...")

    # 1. Inbox — Operator persona (HumanTask cards should be visible)
    set_persona(page, "operator")
    nav(page, "#inbox")
    shot(page, "01-inbox-operator")

    # 2. Inbox — Approver persona
    set_persona(page, "approver")
    nav(page, "#inbox")
    shot(page, "02-inbox-approver")

    # 3. Workforce directory — Operator
    set_persona(page, "operator")
    nav(page, "#workforce")
    shot(page, "03-workforce-directory")

    # 4. Workforce — click Bob Chen (2nd card) for master-detail
    nav(page, "#workforce")
    page.wait_for_timeout(200)
    cards = page.query_selector_all(".workforce-card")
    if len(cards) > 1:
        cards[1].click()
        page.wait_for_timeout(300)
    shot(page, "04-workforce-bob-detail")

    # 5. Workforce — click Carol Davis (3rd card)
    nav(page, "#workforce")
    page.wait_for_timeout(200)
    cards = page.query_selector_all(".workforce-card")
    if len(cards) > 2:
        cards[2].click()
        page.wait_for_timeout(300)
    shot(page, "05-workforce-carol-detail")

    # 6. Queues screen
    nav(page, "#queues")
    shot(page, "06-queues-list")

    # 7. Queues — click second queue card
    nav(page, "#queues")
    page.wait_for_timeout(200)
    qcards = page.query_selector_all(".queue-card")
    if len(qcards) > 1:
        qcards[1].click()
        page.wait_for_timeout(300)
    shot(page, "07-queues-detail")

    # 8. Work Items list
    set_persona(page, "operator")
    nav(page, "#work-items")
    shot(page, "08-work-items")

    # 9. Work Item detail (click first row)
    nav(page, "#work-items")
    page.wait_for_timeout(200)
    first_row = page.query_selector("tr[data-href], .table__row[data-href], .work-item-row")
    if first_row:
        first_row.click()
        page.wait_for_timeout(400)
    shot(page, "09-work-item-detail")

    # 10. Owner picker open (try to find visible trigger in current drawer/panel)
    try:
        picker_trigger = page.query_selector(".owner-picker__trigger, [data-action='open-owner-picker'], .js-owner-picker-trigger")
        if picker_trigger and picker_trigger.is_visible():
            picker_trigger.click(timeout=3000)
            page.wait_for_timeout(300)
    except Exception:
        pass
    shot(page, "10-owner-picker-open")

    # 11. Approvals table — assignee column
    set_persona(page, "approver")
    nav(page, "#approvals")
    shot(page, "11-approvals-table")

    # 12. Run detail — step timeline
    set_persona(page, "operator")
    nav(page, "#runs")
    page.wait_for_timeout(200)
    first_run = page.query_selector("tr[data-href], .table__row[data-href]")
    if first_run:
        first_run.click()
        page.wait_for_timeout(400)
    shot(page, "12-run-detail-timeline")

    # 13. Settings — Workforce tab
    set_persona(page, "admin")
    nav(page, "#settings")
    page.wait_for_timeout(300)
    # Find workforce tab
    wf_tab = page.query_selector("[data-tab='workforce'], [data-value='workforce'], .tab--workforce, button:has-text('Workforce'), a:has-text('Workforce')")
    if wf_tab:
        wf_tab.click()
        page.wait_for_timeout(300)
    shot(page, "13-settings-workforce-tab")

    # 14. Workforce — Admin persona (sees edit controls)
    set_persona(page, "admin")
    nav(page, "#workforce")
    shot(page, "14-workforce-admin")

    # 15. Full sidebar visible — highlight navigation section
    set_persona(page, "operator")
    nav(page, "#workforce")
    shot(page, "15-sidebar-workforce-nav")

    # 16. Triage screen
    nav(page, "#triage")
    shot(page, "16-triage")

    # 17. Inbox with Human Tasks filter chip active — Operator
    set_persona(page, "operator")
    nav(page, "#inbox")
    page.wait_for_timeout(200)
    ht_chip = page.query_selector(".js-filter-human-tasks, [data-filter='human-tasks']")
    if ht_chip:
        ht_chip.click()
        page.wait_for_timeout(300)
    shot(page, "17-inbox-human-tasks-chip")

    browser.close()
    print(f"\nDone. {17} screenshots saved to: {OUT}")
