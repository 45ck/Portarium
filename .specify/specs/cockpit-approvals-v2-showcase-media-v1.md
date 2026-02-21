# Cockpit Approvals V2 Showcase Media v1

## Context

Approvals v2 is implemented and needs a stable demo artifact for README-level product communication.

## Requirements

1. Provide a reproducible command that renders an approvals-v2 showcase asset from the cockpit lo-fi prototype.
2. Store generated showcase media in-repo under a deterministic path for documentation use.
3. Embed the resulting showcase media in the project README.
4. Document how to regenerate the asset in cockpit demo docs.

## Verification

1. Run `npm run cockpit:demo:approvals-v2:showcase` to regenerate media and metadata.
2. Run `npm run ci:pr`.
3. Confirm README includes the embedded showcase GIF path.
