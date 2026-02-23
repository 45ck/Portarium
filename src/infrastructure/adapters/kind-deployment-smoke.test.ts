/**
 * Validates kind cluster configuration and deployment smoke test infrastructure.
 *
 * These tests verify that the kind config, deploy script, and Kubernetes
 * manifests are structurally correct without requiring kind to be installed.
 *
 * Bead: bead-qr8v
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const kindDir = path.join(repoRoot, 'infra', 'kind');
const k8sBaseDir = path.join(repoRoot, 'infra', 'kubernetes', 'base');
const dockerDir = path.join(repoRoot, 'infra', 'docker');

describe('kind deployment smoke infrastructure', () => {
  describe('kind cluster configuration', () => {
    const configPath = path.join(kindDir, 'kind-cluster.yaml');

    it('kind-cluster.yaml exists', () => {
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('configures a multi-node cluster (control-plane + worker)', () => {
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('role: control-plane');
      expect(content).toContain('role: worker');
    });

    it('maps host ports for HTTP access', () => {
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('hostPort: 8080');
      expect(content).toContain('hostPort: 8081');
    });

    it('uses the correct kind API version', () => {
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('apiVersion: kind.x-k8s.io/v1alpha4');
      expect(content).toContain('kind: Cluster');
    });

    it('names the cluster "portarium"', () => {
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('name: portarium');
    });
  });

  describe('deployment smoke script', () => {
    const scriptPath = path.join(kindDir, 'deploy-smoke.sh');

    it('deploy-smoke.sh exists and is a bash script', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
    });

    it('uses bash strict mode', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      // Check for set -e (exit on error) and set -u (treat unset as error)
      expect(content).toMatch(/set -[a-z]*e[a-z]*/);
      expect(content).toMatch(/set -[a-z]*u[a-z]*/);
    });

    it('references both Dockerfiles', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('control-plane.Dockerfile');
      expect(content).toContain('worker.Dockerfile');
    });

    it('applies Kustomize base manifests', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('kubectl apply -k');
      expect(content).toContain('infra/kubernetes/base');
    });

    it('includes cleanup with trap', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('trap cleanup EXIT');
    });

    it('supports --keep flag to preserve cluster', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('--keep');
      expect(content).toContain('KEEP_CLUSTER');
    });

    it('checks PDBs in smoke tests', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('portarium-control-plane-pdb');
      expect(content).toContain('portarium-execution-plane-pdb');
      expect(content).toContain('portarium-otel-collector-pdb');
    });
  });

  describe('prerequisite files exist', () => {
    it('control-plane Dockerfile exists', () => {
      expect(fs.existsSync(path.join(dockerDir, 'control-plane.Dockerfile'))).toBe(true);
    });

    it('worker Dockerfile exists', () => {
      expect(fs.existsSync(path.join(dockerDir, 'worker.Dockerfile'))).toBe(true);
    });

    it('Kustomize base directory exists', () => {
      expect(fs.existsSync(k8sBaseDir)).toBe(true);
    });

    it('PDB manifest exists in base', () => {
      expect(fs.existsSync(path.join(k8sBaseDir, 'pdb.yaml'))).toBe(true);
    });
  });
});
