/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
function load(filename) {
  const loaded = new Module(filename, module);
  loaded.require = name => name.endsWith('.json') ? JSON.parse(fs.readFileSync(path.resolve(path.dirname(filename), name), 'utf8'))
    : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
const { isWithinPinamalayan, isWithinRing, filterPinamalayanResults, locationSearchText, safeLocationAddress,
  PINAMALAYAN_BOUNDARY, PINAMALAYAN_CENTER, MAP_RING_CHECK_JS } = load(path.join(__dirname, '../utils/pinamalayanLocation.ts'));

test('Pinamalayan town centre is allowed', () => assert.equal(isWithinPinamalayan(PINAMALAYAN_CENTER.latitude, PINAMALAYAN_CENTER.longitude), true));
for (const [name, lat, lng] of [['Calapan', 13.4115, 121.1803], ['Gloria', 12.9197, 121.487], ['Socorro', 13.059, 121.397], ['Pola', 13.145, 121.441], ['outside polygon but inside bbox', 13.11, 121.25]]) {
  test(name + ' is excluded', () => assert.equal(isWithinPinamalayan(lat, lng), false));
}
test('boundary edges are allowed without accepting the bounding rectangle', () => {
  const [lng, lat] = PINAMALAYAN_BOUNDARY.geometry.coordinates[0][0];
  assert.equal(isWithinPinamalayan(lat, lng), true);
});
test('malformed coordinates never qualify', () => {
  for (const value of [null, undefined, '', '13.0386691', NaN, Infinity, {}, [], true]) assert.equal(isWithinPinamalayan(value, 121.4801563), false);
  assert.equal(isWithinPinamalayan(13.0386691, Infinity), false);
});
test('ring check supports boundary points and excludes surrounding points', () => {
  const square = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  assert.equal(isWithinRing(1, 1, square), true);
  assert.equal(isWithinRing(1, 0, square), true);
  assert.equal(isWithinRing(1, -0.01, square), false);
});
test('search rejects outside places even if their label mentions Pinamalayan', () => {
  const data = [{lat:'13.0386691',lon:'121.4801563',display_name:'Pinamalayan town',place_id:1},
    {lat:'13.059',lon:'121.397',display_name:'Pinamalayan / Socorro',place_id:2},
    {lat:null,lon:null,display_name:'Bad data'},
    {lat:13.0386691,lon:121.4801563,display_name:'<script>bad</script>'}];
  assert.deepEqual(filterPinamalayanResults(data), [{lat:13.0386691,lon:121.4801563,display_name:'Pinamalayan town',place_id:'1'}]);
  assert.deepEqual(filterPinamalayanResults({}), []);
});
test('search and addresses normalize ordinary input and reject markup', () => {
  assert.equal(locationSearchText('  Marfrancisco\x00\u202e  '), 'Marfrancisco');
  assert.throws(() => locationSearchText('&lt;script&gt;test&lt;/script&gt;'));
  assert.throws(() => locationSearchText('a'.repeat(121)));
  assert.equal(safeLocationAddress('  Town\x00\r\nPinamalayan  '), 'Town Pinamalayan');
  assert.equal(safeLocationAddress('<b>Town</b>'), null);
});
test('map-side ring function runs independently inside the WebView', () => {
  const browserRing = new Function('return (' + MAP_RING_CHECK_JS + ')')();
  const ring = PINAMALAYAN_BOUNDARY.geometry.coordinates[0];
  const locations = [[PINAMALAYAN_CENTER.latitude, PINAMALAYAN_CENTER.longitude], [13.059, 121.397], [13.11, 121.25],
    ...ring.map(([lng, lat]) => [lat, lng])];
  for (const [lat, lng] of locations) assert.equal(browserRing(lat, lng, ring), isWithinPinamalayan(lat, lng));
});
test('frontend and backend use the same municipal polygon snapshot', () => {
  const backend = JSON.parse(fs.readFileSync(path.join(__dirname, '../../diskartech-backend/resources/data/pinamalayan-boundary.json'), 'utf8'));
  assert.deepEqual(backend, PINAMALAYAN_BOUNDARY);
});
