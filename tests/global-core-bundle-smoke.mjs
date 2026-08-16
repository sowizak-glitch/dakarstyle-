// Minimal, dependency-free smoke test for the built browser bundle
// (dist/global-core-v1.js). Not a DOM test (no jsdom in this repo by
// design) — this only proves the bundle parses and its top-level IIFE
// executes without throwing against a stubbed-out browser environment,
// which is exactly the failure mode that would otherwise crash the host
// page on every SAMABUSINESS load.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(here, '..', 'dist', 'global-core-v1.js');

function makeStubDocument() {
  const listeners = {};
  const el = () => ({
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    style: {},
  });
  return {
    readyState: 'complete',
    documentElement: el(),
    head: { appendChild() {} },
    body: { appendChild() {}, style: {} },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return el(); },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
  };
}

let failed = false;
function assert(cond, message) {
  if (!cond) {
    failed = true;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok - ${message}`);
  }
}

const source = readFileSync(bundlePath, 'utf8');
const errors = [];
const sandbox = {
  window: {},
  document: makeStubDocument(),
  navigator: { language: 'fr-SN', languages: ['fr-SN'] },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
  Intl,
  console: { ...console, error: (...args) => errors.push(args) },
  setTimeout,
  clearTimeout,
  MutationObserver: class { observe() {} disconnect() {} },
  crypto: globalThis.crypto,
  btoa: globalThis.btoa,
  atob: globalThis.atob,
};
sandbox.window = sandbox; // classic-script style: top-level == window
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
try {
  vm.runInContext(source, sandbox, { filename: 'global-core-v1.js' });
  assert(true, 'bundle evaluates without throwing');
} catch (error) {
  assert(false, `bundle threw during evaluation: ${error && error.stack || error}`);
}

// bootGlobalCore is async and self-invoked on DOMContentLoaded/immediately;
// give its microtasks a tick, then check nothing landed in console.error
// beyond our own controlled "no DOM" degradation path.
await new Promise((resolve) => setTimeout(resolve, 20));
const unexpected = errors.filter(([tag]) => tag !== 'sama_global_core_boot' && tag !== 'sama_global_core_mount' && tag !== 'sama_global_core_start');
assert(unexpected.length === 0, `no unexpected console.error calls (got ${JSON.stringify(errors)})`);
assert(typeof sandbox.window.SAMABUSINESS === 'object', 'window.SAMABUSINESS.global is installed even with a stubbed DOM');
assert(typeof sandbox.window.SAMABUSINESS?.global?.currency?.format === 'function', 'currency engine reachable from window.SAMABUSINESS.global');

process.exit(failed ? 1 : 0);
