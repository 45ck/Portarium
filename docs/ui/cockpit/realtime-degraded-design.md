# UX Design: Real-Time Updates and Degraded Mode

**Bead:** bead-0462
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

The cockpit relies on a server-sent event (SSE) stream for live data. When that stream is healthy the UI reflects reality within milliseconds. When it degrades or fails the cockpit must remain usable, communicate its state honestly, and recover automatically on demand.

---

## 2. Connection Status — Status Bar Indicator

The rightmost slot of the global status bar shows a persistent connection badge.
