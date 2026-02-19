"""Quick verification screenshots for the 4 bug fixes."""
from playwright.sync_api import sync_playwright
import os

FILE = "file:///D:/Visual%20Studio%20Projects/VAOP/docs/ui/cockpit/index.html"
OUT = os.path.dirname(os.path.abspath(__file__))

def shot(page, name):
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT, f"verify-{name}.png"), full_page=False)
    print(f"  OK {name}")

def nav(page, hash_):
    page.evaluate(f"document.querySelector('a[href=\"{hash_}\"]')?.click()")
    page.wait_for_timeout(400)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(FILE, wait_until="networkidle")
    page.select_option("#persona", "operator")

    # WF-3: Click Bob Chen (2nd card) — should update full detail
    nav(page, "#workforce")
    page.wait_for_timeout(300)
    cards = page.query_selector_all(".workforce-card")
    if len(cards) > 1:
        cards[1].click()
        page.wait_for_timeout(400)
    shot(page, "WF3-bob-chen")

    # WF-3: Click Dan Park (4th card)
    nav(page, "#workforce")
    page.wait_for_timeout(300)
    cards = page.query_selector_all(".workforce-card")
    if len(cards) > 3:
        cards[3].click()
        page.wait_for_timeout(400)
    shot(page, "WF3-dan-park")

    # WF-4: Click Legal Queue (2nd card)
    nav(page, "#queues")
    page.wait_for_timeout(300)
    qcards = page.query_selector_all(".queue-card")
    if len(qcards) > 1:
        qcards[1].click()
        page.wait_for_timeout(400)
    shot(page, "WF4-legal-queue")

    # WF-4: Click General Queue (3rd card)
    nav(page, "#queues")
    page.wait_for_timeout(300)
    qcards = page.query_selector_all(".queue-card")
    if len(qcards) > 2:
        qcards[2].click()
        page.wait_for_timeout(400)
    shot(page, "WF4-general-queue")

    # WF-7: Approvals Unassigned chip
    page.select_option("#persona", "approver")
    nav(page, "#approvals")
    shot(page, "WF7-approvals-unassigned")

    browser.close()
    print("Done.")
