#!/usr/bin/env node
// Zero-dependency "poor man's bundler" for the Global Core addon script.
//
// Why not a real bundler: this repository ships zero runtime/dev
// dependencies on purpose (assets.directory = '.' — see package.json's own
// comment), and the existing DB-backed addon scripts are hand-assembled
// single files. This script keeps that deployment shape while letting the
// *source* stay in normal, readable, git-diffable ES modules instead of
// one opaque blob: it concatenates the modules in dependency order and
// mechanically strips `import`/`export` (every module in src/global-core
// uses plain top-level `export function`/`export const`, never default
// exports or re-exports, specifically so this transform stays exact).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'src', 'global-core');
const distDir = path.join(here, '..', 'dist');

const MODULE_ORDER = [
  'country-registry.mjs',
  'currency-engine.mjs',
  'timezone-engine.mjs',
  'phone-engine.mjs',
  'locale-engine.mjs',
  'rtl.mjs',
  'index.mjs',
  'settings-store.mjs',
  'region-language-form.mjs',
  'styles.mjs',
  'modal-helpers.mjs',
  'settings-ui.mjs',
  'onboarding-ui.mjs',
  'browser-bootstrap.mjs',
];

function stripModuleSyntax(source, fileName) {
  return source
    .split('\n')
    .filter((line) => !/^\s*import\s.+from\s+'\.\/.+\.mjs';?\s*$/.test(line))
    .join('\n')
    .replace(/^export\s+(async function|function|const|class)\s/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
    .replace(/\bexport\s+\{[^}]*\};?/g, '') // trailing re-export lines mid-file (index.mjs)
    + `\n// --- end ${fileName} ---\n`;
}

function loadJson(relPath) {
  return JSON.parse(readFileSync(path.join(srcDir, relPath), 'utf8'));
}

function buildDataLiteral() {
  const countries = loadJson('data/countries.json');
  const addressSchemas = loadJson('data/address-schemas.json');
  const currencyMinorUnits = loadJson('data/currency-minor-units.json');
  const phoneMetadata = loadJson('data/phone-metadata.json');
  return `const GLOBAL_CORE_DATA = ${JSON.stringify({ countries, addressSchemas, currencyMinorUnits, phoneMetadata })};\n`;
}

function buildLocalePacksLiteral() {
  const dir = path.join(srcDir, 'locale-packs');
  const packs = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const tag = file.replace(/\.json$/, '');
    packs[tag] = loadJson(path.join('locale-packs', file));
  }
  return `const GLOBAL_CORE_LOCALE_PACKS = ${JSON.stringify(packs)};\n`;
}

function build() {
  const parts = [];
  parts.push('(function(){\n"use strict";\n');
  parts.push(buildDataLiteral());
  parts.push(buildLocalePacksLiteral());
  for (const moduleFile of MODULE_ORDER) {
    const source = readFileSync(path.join(srcDir, moduleFile), 'utf8');
    parts.push(stripModuleSyntax(source, moduleFile));
  }
  parts.push(`
function keyed(objectMap){const idx={};for(const tag of Object.keys(GLOBAL_CORE_LOCALE_PACKS)){idx[tag]=GLOBAL_CORE_LOCALE_PACKS[tag]}return idx}
function start(){bootGlobalCore(GLOBAL_CORE_DATA, keyed()).catch(function(e){console.error('sama_global_core_start', e)})}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded', start)}else{start()}
})();
`);

  const bundle = parts.join('\n');
  mkdirSync(distDir, { recursive: true });
  const outFile = path.join(distDir, 'global-core-v1.js');
  writeFileSync(outFile, bundle, 'utf8');
  const sha256 = createHash('sha256').update(bundle, 'utf8').digest('hex');
  writeFileSync(path.join(distDir, 'global-core-v1.sha256'), sha256 + '\n', 'utf8');
  console.log(`Built ${outFile}`);
  console.log(`bytes=${Buffer.byteLength(bundle, 'utf8')} sha256=${sha256}`);
}

build();
