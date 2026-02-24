# UX Design: Evidence and Audit Trail

**Bead:** bead-0460
**Status:** Done
**Date:** 2026-02-18

## Problem

The evidence screen has integrity banners and export, but lacks:

1. **Per-entry hash display** — cryptographic hash visible and copyable for independent verification
2. **Chain visualization** — showing how entries link (prev_hash → hash chain)
3. **Tamper-evident indicator** — clear visual break when chain integrity fails
4. **Hash copy/verify UX** — supporting external auditors verifying independently

## Screen Layout Additions

```
[Evidence]
  ┌─ Chain Integrity: ● All 26 entries verified ──────────────────────┐
  │  Entry #120 → #146 | SHA-256 chain | Last verified: now           │
  │  [Verify chain] [Download proof bundle]                           │
  └───────────────────────────────────────────────────────────────────┘

  Evidence list:
  ┌──────────────────────────────────────────────────────────────────┐
  │ #146 | Approval decision submitted                               │
  │ Category: Approval | Actor: user@acme.com | 1d ago               │
  │ Hash: sha256:a3f8...d91c   [Copy ⎘]  [Verify ✓]                 │
  │ Prev: sha256:7e2b...4a5f   ← chain link                         │
  └──────────────────────────────────────────────────────────────────┘

  Tamper-detected state:
  ┌─ ⚠ Chain break at entry #142 ──────────────────────────────────┐
  │  Expected: sha256:9ab3... | Found: sha256:ff1c...               │
  │  Entries after #142 cannot be verified.                         │
  │  [Export incident report] [Contact support]                     │
  └────────────────────────────────────────────────────────────────┘
```

## Chain Verification Flow

1. System auto-verifies on page load (integrity-banner--ok)
2. "Verify chain" button triggers full re-verification
3. Result: ok (green) / warn (gap in sequence) / danger (hash mismatch)
4. Per-entry [Verify ✓] button checks entry hash against server
5. [Copy ⎘] copies full hash for external verification

## Tamper-Evident Indicators

| State         | Visual                                 | Action                               |
| ------------- | -------------------------------------- | ------------------------------------ |
| All verified  | Green banner + ● on each entry         | —                                    |
| Sequence gap  | Yellow banner "Missing entries N–M"    | Export gap report                    |
| Hash mismatch | Red banner "Chain break at #N"         | Disable edit; export incident report |
| WORM lock     | Lock icon on entry + "Immutable" badge | —                                    |

## Export Types

- **Verification report** — JSON: hash chain with computed vs expected hashes
- **Evidence bundle** — ZIP: raw payloads + hashes + signature
- **Legal hold** — mark entries as held (cannot expire)
- **Selected entries** — subset export for targeted audit

## Nielsen Heuristic Evaluation

| Heuristic                           | Assessment                                       |
| ----------------------------------- | ------------------------------------------------ |
| Visibility of system status         | ✓ Chain integrity banner always visible          |
| Match between system and real world | ✓ "Tamper" language matches auditor vocabulary   |
| Error prevention                    | ✓ Legal hold prevents accidental deletion        |
| Recognition over recall             | ✓ Hash shown inline (no need to navigate away)   |
| Help users recover from errors      | ✓ Tamper break shows exact entry + export action |
| Consistency                         | ✓ Status badges reused (ok/warn/danger)          |

## Accessibility

- Hash code uses `<code>` element with `aria-label="SHA-256 hash: [value]"`
- Copy button: `aria-label="Copy hash for entry #N"`
- Verify button: aria-live region announces verification result
- Tamper banner: `role="alert"` for immediate screen reader announcement
- Sequence/hash values are readable (not purely visual)
