import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync('senecompare/final-v52.js', 'utf8');
const css = readFileSync('senecompare/final-v52.css', 'utf8');
const wrapper = readFileSync('src/senecompare-final-v52.js', 'utf8');
const router = readFileSync('src/senecompare-v5-router.js', 'utf8');
const brand = readFileSync('src/senecompare-brand-v52.js', 'utf8');

for (const label of [
  'Téléphones', 'Voitures', 'Motos', 'Électroménager', 'Informatique', 'Maison', 'Mode & beauté',
  'Matériel pro', 'Transport', 'Livraison', 'Travaux & artisans', 'Ménage & cuisine', 'Garde d’enfants',
  'Cours & formation', 'Santé', 'Immobilier', 'Alimentation', 'Agriculture', 'Construction',
  'Énergie & solaire', 'Sécurité', 'Web & création', 'Finance & assurance', 'Voyages', 'Autres services',
]) assert.match(ui, new RegExp(label.replace(/[&]/g, '\\&')), label);

for (const marker of ['Écrire', 'Parler', 'Près de moi', 'Gis catégories yépp', '__SENECOMPARE_FINAL__']) assert.match(ui, new RegExp(marker));
for (const marker of ['min-height:48px', '@media(max-width:720px)', 'prefers-reduced-motion', 'grid-template-columns:repeat(2']) assert.match(css, new RegExp(marker.replace(/[()]/g, '\\$&')));
for (const marker of ['/profile.webp?v=520', '/final-v52.css?v=520', '/final-v52.js?v=520', 'SeneCompare Sénégal', 'official-senegal-logo']) assert.match(wrapper, new RegExp(marker.replace(/[/.?]/g, '\\$&')));
assert.match(router, /import frontend from '\.\/senecompare-final-v52\.js'/);
assert.match(router, /const RELEASE = '5\.2\.0'/);
assert.match(brand, /SENECOMPARE_RELEASE = '5\.2\.0'/);

console.log('SeneCompare final 5.2 static audit passed');
