#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DEFAULT_CONTRACT_PATH = path.join(
  ROOT,
  'examples',
  'openclaw',
  'portarium-openclaw-adapter.contract.json',
);

const CONTRACT_PATH = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : DEFAULT_CONTRACT_PATH;

const REQUIRED_PRINCIPALS = ['read-only', 'standing-read', 'approval-drafting', 'executor'];
const REQUIRED_FAIL_CLOSED_RULES = [
  'unknown-tool',
  'unknown-action',
  'unknown-principal',
  'executor-exposed-to-chat',
  'executor-without-dry-run-default',
  'approval-card-draft-executes-action',
];
const REQUIRED_TIMELINE_EVENTS = [
  'proposal',
  'policy-decision',
  'approval-card-drafted',
  'cockpit-visible',
  'approval-decision',
  'execution-result',
  'evidence-recorded',
];
const REQUIRED_COCKPIT_FIELDS = [
  'approval-status',
  'plan',
  'policy-decision',
  'evidence',
  'execution-result',
  'blocked-reason',
];

const errors = [];

function addError(message) {
  errors.push(message);
}

function assertArrayIncludesAll(label, actual, expected) {
  if (!Array.isArray(actual)) {
    addError(`${label} must be an array.`);
    return;
  }
  for (const value of expected) {
    if (!actual.includes(value)) {
      addError(`${label} must include "${value}".`);
    }
  }
}

function readContract(contractPath) {
  if (!fs.existsSync(contractPath)) {
    addError(`Contract file does not exist: ${contractPath}`);
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } catch (error) {
    addError(`Contract file is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function validatePrincipals(contract) {
  const principals = contract.bridgePrincipalModel?.principals;
  if (!Array.isArray(principals)) {
    addError('bridgePrincipalModel.principals must be an array.');
    return;
  }

  const principalIds = principals.map((principal) => principal?.id).filter(Boolean);
  assertArrayIncludesAll('bridgePrincipalModel.principals[].id', principalIds, REQUIRED_PRINCIPALS);

  const seen = new Set();
  for (const principal of principals) {
    if (!principal?.id) {
      addError('Each bridge principal must have an id.');
      continue;
    }
    if (seen.has(principal.id)) {
      addError(`Duplicate bridge principal id: ${principal.id}`);
    }
    seen.add(principal.id);

    if (principal.id === 'executor' && principal.mayExecute !== true) {
      addError('The executor principal must be the only principal allowed to execute.');
    }
    if (principal.id !== 'executor' && principal.mayExecute === true) {
      addError(`Non-executor principal "${principal.id}" must not be executable.`);
    }
  }

  if (contract.bridgePrincipalModel?.unknownPrincipalDecision !== 'deny') {
    addError('Unknown bridge principals must deny/fail closed.');
  }
}

function validateAliasManifest(contract) {
  const aliases = contract.aliasManifest;
  if (!Array.isArray(aliases) || aliases.length === 0) {
    addError('aliasManifest must be a non-empty array.');
    return;
  }

  const aliasIds = new Set();
  const bridgeTools = new Set();
  const principalCoverage = new Set();
  const knownPrincipals = new Set(REQUIRED_PRINCIPALS);
  const executorAliases = [];
  const approvalDraftAliases = [];

  for (const entry of aliases) {
    if (!entry?.alias) addError('Every aliasManifest entry must include alias.');
    if (!entry?.bridgeTool)
      addError(`Alias "${entry?.alias ?? '<missing>'}" must include bridgeTool.`);
    if (!knownPrincipals.has(entry?.principal)) {
      addError(
        `Alias "${entry?.alias ?? '<missing>'}" uses unknown principal "${entry?.principal}".`,
      );
    } else {
      principalCoverage.add(entry.principal);
    }

    if (entry?.alias) {
      if (aliasIds.has(entry.alias)) addError(`Duplicate alias: ${entry.alias}`);
      aliasIds.add(entry.alias);
      if (!/^[a-z][a-z0-9_]*$/.test(entry.alias)) {
        addError(`Alias "${entry.alias}" must be OpenAI-safe snake_case.`);
      }
    }

    if (entry?.bridgeTool) {
      if (bridgeTools.has(entry.bridgeTool)) addError(`Duplicate bridgeTool: ${entry.bridgeTool}`);
      bridgeTools.add(entry.bridgeTool);
      if (!/^[a-z][a-z0-9_.-]*$/.test(entry.bridgeTool)) {
        addError(`bridgeTool "${entry.bridgeTool}" must be a stable lower-case identifier.`);
      }
    }

    if (entry.chatExposed === true && entry.principal === 'executor') {
      addError(`Executor alias "${entry.alias}" must not be exposed to chat.`);
    }
    if (entry.chatExposed === true && entry.mayExecute === true) {
      addError(`Chat-exposed alias "${entry.alias}" must not execute effects.`);
    }
    if (entry.principal !== 'executor' && entry.mayExecute === true) {
      addError(`Non-executor alias "${entry.alias}" must not execute effects.`);
    }
    if (entry.principal === 'executor') {
      executorAliases.push(entry);
    }
    if (entry.bridgeTool === contract.approvalCardDraftFlow?.requestTool) {
      approvalDraftAliases.push(entry);
    }
  }

  assertArrayIncludesAll(
    'aliasManifest principal coverage',
    Array.from(principalCoverage),
    REQUIRED_PRINCIPALS,
  );

  if (approvalDraftAliases.length !== 1) {
    addError('Exactly one alias must implement approvalCardDraftFlow.requestTool.');
  } else {
    const [draftAlias] = approvalDraftAliases;
    if (draftAlias.principal !== 'approval-drafting') {
      addError('Approval card draft alias must use the approval-drafting principal.');
    }
    if (draftAlias.mayExecute !== false) {
      addError('Approval card draft alias must be proposal-only and mayExecute=false.');
    }
    if (draftAlias.cockpitVisible !== true) {
      addError('Approval card draft alias must require Cockpit visibility.');
    }
  }

  if (executorAliases.length === 0) {
    addError('At least one executor alias is required for the direct dry-run gate.');
  }
  for (const executorAlias of executorAliases) {
    if (executorAlias.chatExposed !== false) {
      addError(`Executor alias "${executorAlias.alias}" must set chatExposed=false.`);
    }
    if (executorAlias.dryRunDefault !== true) {
      addError(`Executor alias "${executorAlias.alias}" must default to dry-run.`);
    }
    if (executorAlias.requireExplicitExecute !== true) {
      addError(`Executor alias "${executorAlias.alias}" must require explicit execute=true.`);
    }
  }
}

function validateFlows(contract) {
  const approvalFlow = contract.approvalCardDraftFlow;
  if (!approvalFlow) {
    addError('approvalCardDraftFlow is required.');
  } else {
    if (approvalFlow.executesAction !== false) {
      addError('approvalCardDraftFlow must not execute actions.');
    }
    if (approvalFlow.cockpitMirrorRequired !== true) {
      addError('approvalCardDraftFlow must require Cockpit mirroring.');
    }
    assertArrayIncludesAll(
      'approvalCardDraftFlow.supportedDecisions',
      approvalFlow.supportedDecisions,
      ['approve', 'reject', 'request-changes', 'dry-run', 'execute'],
    );
  }

  const executorGate = contract.executorGate;
  if (!executorGate) {
    addError('executorGate is required.');
  } else {
    if (executorGate.directOnly !== true) addError('executorGate.directOnly must be true.');
    if (executorGate.chatExposed !== false) addError('executorGate.chatExposed must be false.');
    if (executorGate.dryRunDefault !== true) addError('executorGate.dryRunDefault must be true.');
    if (executorGate.requireExplicitExecute !== true) {
      addError('executorGate.requireExplicitExecute must be true.');
    }
    if (executorGate.failClosedUnknownTool !== true) {
      addError('executorGate.failClosedUnknownTool must be true.');
    }
  }
}

function validateEvidenceAndVisibility(contract) {
  assertArrayIncludesAll(
    'evidenceTimeline.requiredEvents',
    contract.evidenceTimeline?.requiredEvents,
    REQUIRED_TIMELINE_EVENTS,
  );
  if (contract.evidenceTimeline?.mustRecordCorrelationId !== true) {
    addError('evidenceTimeline.mustRecordCorrelationId must be true.');
  }

  const cockpitVisibility = contract.cockpitVisibility;
  if (cockpitVisibility?.reviewRouteRequired !== true) {
    addError('cockpitVisibility.reviewRouteRequired must be true.');
  }
  if (cockpitVisibility?.hiddenBlockedWorkProhibited !== true) {
    addError('cockpitVisibility.hiddenBlockedWorkProhibited must be true.');
  }
  assertArrayIncludesAll(
    'cockpitVisibility.mustShow',
    cockpitVisibility?.mustShow,
    REQUIRED_COCKPIT_FIELDS,
  );
}

function validateContract(contract) {
  if (contract.schemaVersion !== 1) addError('schemaVersion must be 1.');
  if (contract.contractName !== 'portarium.openclaw.adapter.v1') {
    addError('contractName must be "portarium.openclaw.adapter.v1".');
  }

  validatePrincipals(contract);
  validateAliasManifest(contract);
  validateFlows(contract);
  validateEvidenceAndVisibility(contract);
  assertArrayIncludesAll('failClosedRules', contract.failClosedRules, REQUIRED_FAIL_CLOSED_RULES);
}

const contract = readContract(CONTRACT_PATH);
if (contract) validateContract(contract);

if (errors.length > 0) {
  console.error(
    `OpenClaw adapter contract check failed for ${path.relative(ROOT, CONTRACT_PATH)}:\n`,
  );
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(
  `OpenClaw adapter contract check passed: ${path.relative(ROOT, CONTRACT_PATH)} is valid.`,
);
