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
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  return loaded.exports;
}
const helpers = load('utils/jobQuota.ts');
const subscription = load('utils/employerSubscription.ts', { './jobQuota': helpers });

test('Basic availability comes from current server usage, including the exact limit', () => {
  for (const [plan, limit] of [['basic', 3]]) {
    const under = helpers.normalizeJobQuota({ plan, active_job_limit: limit, active_job_count: limit - 1 });
    assert.equal(under.can_post_job, true); assert.equal(under.remaining_job_slots, 1);
    const full = helpers.normalizeJobQuota({ plan, active_job_limit: limit, active_job_count: limit, can_post_job: true });
    assert.equal(full.can_post_job, false); assert.equal(full.remaining_job_slots, 0);
    assert.match(helpers.jobQuotaMessage(full), new RegExp(`up to ${limit} active job posts`));
  }
});

test('active Premium has no posting cap and never renders a null denominator or slot count', () => {
  for (const count of [0, 10, 11, 1000]) {
    const quota = helpers.normalizeJobQuota({ plan: 'premium', active_job_limit: null, active_job_count: count, can_post_job: false, remaining_job_slots: 0 });
    assert.equal(quota.can_post_job, true); assert.equal(quota.remaining_job_slots, null);
    assert.match(helpers.jobQuotaUsage(quota), /Unlimited/);
    assert.ok(!helpers.jobQuotaUsage(quota).includes('/null'));
    assert.match(helpers.jobQuotaAvailability(quota), /Unlimited/);
    assert.match(helpers.jobQuotaMessage(quota), /unlimited/);
  }
});

test('expired Premium accounts above the Basic cap stay over quota until count drops below three', () => {
  for (const count of [10, 4, 3]) {
    const quota = helpers.normalizeJobQuota({ plan: 'basic', active_job_limit: 3, active_job_count: count });
    assert.equal(quota.can_post_job, false); assert.equal(quota.remaining_job_slots, 0);
  }
  assert.equal(helpers.normalizeJobQuota({ plan: 'basic', active_job_limit: 3, active_job_count: 2 }).can_post_job, true);
});

test('household and missing legacy quota data do not create a paid-plan restriction', () => {
  for (const value of [null, undefined, {}, { plan: 'household' }]) assert.equal(helpers.normalizeJobQuota(value), null);
  const old = { subscription: { plan: 'basic', expires_at: null, test_mode: true, prices: { monthly: 14900, annually: 149000 } }, payment: null };
  assert.deepEqual(subscription.readEmployerSubscription(old), old);
});

test('invalid limits and forged availability flags are not displayed as extra posting slots', () => {
  for (const value of [{ plan: 'basic', active_job_limit: null, active_job_count: 0 }, { plan: 'basic', active_job_limit: 10, active_job_count: 0 }, { plan: 'premium', active_job_count: 0 }, { plan: 'premium', active_job_limit: 100, active_job_count: 0 }, { plan: 'basic', active_job_limit: 3, active_job_count: -1 }, { plan: 'basic', active_job_limit: 3, active_job_count: '0' }]) assert.equal(helpers.normalizeJobQuota(value), null);
  const value = { subscription: { plan: 'basic', expires_at: null, test_mode: true, prices: { monthly: 14900, annually: 149000 }, job_quota: { plan: 'basic', active_job_limit: 3, active_job_count: 3, can_post_job: true, remaining_job_slots: 99 } }, payment: null };
  const normalized = subscription.readEmployerSubscription(value);
  assert.equal(normalized.subscription.job_quota.can_post_job, false);
  assert.equal(normalized.subscription.job_quota.remaining_job_slots, 0);
});

test('only quota validation errors produce a quota notice, with bounded plain text', () => {
  assert.equal(helpers.jobQuotaError({ message: 'provider-private-payload' }), null);
  assert.equal(helpers.jobQuotaError({ errors: { salary: ['Invalid'] } }), null);
  assert.equal(helpers.jobQuotaError({ errors: { active_job_limit: [null] } }), null);
  assert.equal(helpers.jobQuotaError({ errors: { active_job_limit: ['\x00Your Basic plan is full.\u202E'] } }), 'Your Basic plan is full.');
  assert.equal(helpers.jobQuotaError({ errors: { active_job_limit: ['x'.repeat(1000)] } }).length, 600);
});
