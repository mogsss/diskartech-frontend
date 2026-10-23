// Run with: node --test scripts/test-application-trail.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const helpers = load('utils/applicationTrail.ts');
const { buildApplicationTrail, formatTrailTimestamp } = helpers;
const appliedAt = '2026-10-20T02:00:00Z';
const hiredAt = '2026-10-21T03:00:00Z';
const updatedAt = '2026-10-23T05:00:00Z';
const current = trail => trail.steps.find(step => step.state === 'current');

test('pending applications show submission, current review, and clearly upcoming optional steps', () => {
  const trail = buildApplicationTrail({ status: 'pending', appliedAt });
  assert.deepEqual(trail.steps.map(step => [step.key, step.state]), [
    ['submitted', 'recorded'], ['current', 'current'], ['interview-next', 'upcoming'], ['decision-next', 'upcoming'],
  ]);
  assert.equal(trail.steps[0].occurredAt, appliedAt);
  assert.equal(current(trail).occurredAt, undefined);
  assert.match(trail.steps[2].title, /if needed/);
});

test('a direct acceptance never fabricates a viewed, shortlisted, or attended interview milestone', () => {
  const record = Object.freeze({ status: 'accepted', appliedAt, hiredAt, updatedAt });
  const trail = buildApplicationTrail(record);
  assert.deepEqual(trail.steps.map(step => step.key), ['submitted', 'current', 'completion-next']);
  assert.equal(current(trail).occurredAt, hiredAt);
  assert.equal(trail.steps.at(-1).state, 'upcoming');
});

test('an interview schedule is recorded as an invitation, with no fabricated event timestamp', () => {
  const trail = buildApplicationTrail({ status: 'accepted', appliedAt, hiredAt, interviewDate: 'October 21, 2026', interviewTime: '10:00 AM' });
  const interview = trail.steps.find(step => step.key === 'interview');
  assert.equal(interview.title, 'Interview scheduled');
  assert.equal(interview.state, 'recorded');
  assert.match(interview.description, /October 21, 2026 at 10:00 AM/);
  assert.equal(interview.occurredAt, undefined);
  assert.equal(trail.steps.filter(step => step.key.includes('interview')).length, 1);
});

test('an ended interview call uses its saved timestamp and still awaits the hiring decision', () => {
  const interviewEndedAt = '2026-10-21T03:30:00Z';
  const trail = buildApplicationTrail({ status: 'interview', appliedAt, interviewEndedAt });
  assert.equal(current(trail).title, 'Interview call ended');
  assert.equal(current(trail).occurredAt, interviewEndedAt);
  assert.equal(trail.steps.filter(step => step.title === 'Interview call ended').length, 1);
  assert.equal(trail.steps.at(-1).key, 'decision-next');
});

test('terminal states stop the process and legacy records do not invent missing history or dates', () => {
  for (const status of ['cancelled', 'rejected', 'completed', 'terminated']) {
    const trail = buildApplicationTrail({ status, appliedAt, updatedAt });
    assert.equal(trail.steps.some(step => step.state === 'upcoming'), false, status);
    assert.deepEqual(trail.steps.map(step => step.key), ['submitted', 'current']);
    assert.equal(current(trail).occurredAt, undefined, 'updated_at is not a status-change timestamp');
  }
  const terminatedAt = '2026-10-22T04:00:00Z';
  const trail = buildApplicationTrail({ status: 'terminated', appliedAt, hiredAt, terminatedAt });
  assert.equal(trail.steps.find(step => step.key === 'accepted').occurredAt, hiredAt);
  assert.equal(current(trail).occurredAt, terminatedAt);
});

test('all supported and unknown statuses have exactly one current stage', () => {
  for (const status of ['pending', 'viewed', 'shortlisted', 'interview', 'accepted', 'rejected', 'cancelled', 'completed', 'terminated', '', 'future_status']) {
    const trail = buildApplicationTrail({ status, appliedAt });
    assert.equal(trail.steps.filter(step => step.state === 'current').length, 1, status);
    assert.equal(new Set(trail.steps.map(step => step.key)).size, trail.steps.length);
  }
  assert.equal(buildApplicationTrail({ status: ' Accepted ' }).label, 'Accepted');
  assert.equal(buildApplicationTrail({ status: '' }).label, 'Status unavailable');
});

test('timestamps display in Philippine time and invalid dates stay hidden', () => {
  for (const value of [null, undefined, '', 'invalid']) assert.equal(formatTrailTimestamp(value), null);
  const text = formatTrailTimestamp('2026-10-21T23:30:00Z');
  assert.match(text, /Oct 22, 2026/);
  assert.match(text, /7:30/);
  assert.equal(text, formatTrailTimestamp('2026-10-22T07:30:00+08:00'));
});

test('light and dark cards retain the rating child, current-stage labels, and honest update dates', () => {
  let isDark = false;
  const jsx = (type, props) => ({ type, props });
  const Card = load('components/student/application-details/ApplicationStatusCard.tsx', {
    react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text' },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ isDark, colors: { background: '#0F172A', surface: '#1E293B', text: '#FFF', textSecondary: '#94A3B8', border: '#334155' } }) },
    '@/utils/helpers': { getStatusIcon: () => 'info-outline' },
    '@/utils/applicationTrail': helpers,
    '@/components/student/application-details/ApplicationSection': 'Section',
  }).default;
  for (isDark of [false, true]) {
    const rating = { type: 'Rating', props: {} };
    const tree = Card({ status: 'accepted', companyName: 'Cafe', applicationId: 83, appliedAt, hiredAt, updatedAt, children: rating });
    assert.equal(tree.props.title, 'Application trail');
    assert.ok(tree.props.children.includes(rating));
    const nodes = [];
    const visit = node => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      nodes.push(node); visit(node.props?.children);
    };
    visit(tree);
    const currentRow = nodes.find(node => node.props?.accessibilityLabel?.includes('Application accepted. Current'));
    assert.ok(currentRow);
    assert.ok(currentRow.props.accessibilityLabel.includes(formatTrailTimestamp(hiredAt)));
    assert.equal(currentRow.props.accessibilityLabel.includes(formatTrailTimestamp(updatedAt)), false);
    assert.ok(nodes.some(node => node.type === 'Text' && node.props.children === 'Last updated ' + formatTrailTimestamp(updatedAt)));
  }
});
