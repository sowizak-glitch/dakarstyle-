import assert from 'node:assert/strict';
import fs from 'node:fs';

const router = fs.readFileSync('src/senecompare-v52-router.js', 'utf8');
const app = fs.readFileSync('senecompare/universal-v52.js', 'utf8');
const css = fs.readFileSync('senecompare/universal-v52.css', 'utf8');
const taxonomy = JSON.parse(fs.readFileSync('senecompare/taxonomy-v52.json', 'utf8'));
const index = fs.readFileSync('src/index.js', 'utf8');

assert.match(index, /senecompare-v52-router\.js/);
assert.match(router, /UI_VERSION = '5\.2\.0'/);
assert.match(router, /manifest\.webmanifest/);
assert.match(router, /apple-touch-icon/);
assert.match(router, /x-senecompare-ui-version/);
assert.match(app, /Touchez une image/);
assert.match(app, /Bësal nataal/);
assert.match(app, /findSearch/);
assert.match(app, /Installer/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);

assert.equal(taxonomy.version, '5.2.0');
assert.ok(taxonomy.groups.length >= 4);
const items = taxonomy.groups.flatMap(group => group.items);
assert.ok(items.length >= 35, `expected >=35 categories, got ${items.length}`);
for (const item of items) {
  assert.ok(item.id && item.icon && item.fr && item.wo && item.query, item);
}
for (const required of ['carpool','babysitting','agriculture','medical','energy','security','construction','phones','vehicles']) {
  assert.ok(items.some(item => item.id === required), `missing ${required}`);
}
console.log(`SeneCompare 5.2 contract OK — ${items.length} intuitive categories`);
