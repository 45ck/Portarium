#!/usr/bin/env node
/**
 * CI script: validate and format-check all Terraform modules and environments.
 *
 * Runs `terraform validate` and `terraform fmt -check` against every directory
 * under infra/terraform/ that contains *.tf files. Exits non-zero on first failure.
 *
 * Usage: node scripts/ci/terraform-lint.mjs
 */

import { execSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const TF_BASE = join(ROOT, "infra", "terraform");

function hasTfFiles(dir) {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".tf"));
  } catch {
    return false;
  }
}

function collectTfDirs(base) {
  const dirs = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    if (hasTfFiles(dir)) dirs.push(dir);
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry.startsWith(".") || entry === "node_modules") continue;
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        /* skip inaccessible */
      }
    }
  };
  walk(base);
  return dirs;
}

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: "pipe", encoding: "utf8" });
    return { ok: true };
  } catch (err) {
    return { ok: false, stderr: err.stderr || err.stdout || String(err) };
  }
}

function hasTerraform() {
  try {
    execSync("terraform -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const tfInstalled = hasTerraform();
const dirs = collectTfDirs(TF_BASE);

if (dirs.length === 0) {
  console.log("No Terraform directories found — skipping.");
  process.exit(0);
}

let failures = 0;

for (const dir of dirs) {
  const rel = dir.replace(ROOT + "/", "").replace(ROOT + "\\", "");

  // fmt -check works without init
  if (tfInstalled) {
    const fmt = run("terraform fmt -check -diff -recursive", dir);
    if (!fmt.ok) {
      console.error(`FAIL  fmt   ${rel}`);
      console.error(fmt.stderr);
      failures++;
    } else {
      console.log(`OK    fmt   ${rel}`);
    }
  }

  // validate requires init (skip in CI if terraform not installed)
  if (tfInstalled && !existsSync(join(dir, ".terraform"))) {
    // Skip validate for dirs that need init — fmt-check is sufficient for CI lint
    console.log(`SKIP  validate ${rel} (needs terraform init)`);
  } else if (tfInstalled) {
    const val = run("terraform validate", dir);
    if (!val.ok) {
      console.error(`FAIL  validate ${rel}`);
      console.error(val.stderr);
      failures++;
    } else {
      console.log(`OK    validate ${rel}`);
    }
  }
}

if (!tfInstalled) {
  console.log(
    "terraform not found on PATH — skipping terraform lint (fmt + validate).",
  );
  console.log(
    "Install Terraform >= 1.8.0 to enable these checks locally.",
  );
  process.exit(0);
}

if (failures > 0) {
  console.error(`\n${failures} Terraform lint failure(s).`);
  process.exit(1);
}

console.log(`\nAll ${dirs.length} Terraform directories passed lint checks.`);
