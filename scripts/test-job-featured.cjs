// Run with: node scripts/test-job-featured.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '../utils/jobFeatured.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { isFeaturedJob, buildForYouJobs, moveAppliedJobsLast } = loaded.exports;
const now = Date.parse('2026-10-15T07:18:00Z');
const job = (profile = {}) => ({ status: 'active', user: { role: 'employer' }, employer: profile });

test('applied jobs move below new opportunities without changing either group or the source feed', () => {
  const jobs = Object.freeze([
    { id: 1, title: 'Applied featured job', is_featured: true },
    { id: '2', title: 'Nearest new job' },
    { id: 3, title: 'Next new job' },
    { id: '4', title: 'Another applied job' },
    { id: 5, title: 'Last new job' },
  ]);
  const result = moveAppliedJobsLast(jobs, new Set(['1', '4']));
  assert.deepEqual(result.map(item => item.id), ['2', 3, 5, 1, '4']);
  assert.deepEqual(jobs.map(item => item.id), [1, '2', 3, '4', 5]);
  assert.equal(result[3], jobs[0], 'preserve the complete job record and its badge');
});

test('For You prioritizes unapplied jobs while preserving Featured and AI ranking within each group', () => {
  const matches = [
    { ...job(), id: 1, match_percentage: 95 },
    { ...job(), id: 2, match_percentage: 80 },
    { ...job(), id: 4, match_percentage: 70 },
  ];
  const premium = { ...job({ isSubscribed: true }), id: 3 };
  const recommended = buildForYouJobs(matches, [...matches, premium], now);
  const result = moveAppliedJobsLast(recommended, new Set(['2', '3']));
  assert.deepEqual(result.map(item => item.id), [1, 4, 3, 2]);
  assert.equal(result[2].is_featured, true);
  assert.equal(result[0].match_percentage, 95);
  assert.equal(result[3].match_percentage, 80);
});

test('refreshing applied IDs restores original ranking when a job is no longer marked applied', () => {
  const jobs = [{ id: 3 }, { id: 1 }, { id: 2 }];
  assert.deepEqual(moveAppliedJobsLast(jobs, new Set(['3'])).map(item => item.id), [1, 2, 3]);
  assert.deepEqual(moveAppliedJobsLast(jobs, new Set()), jobs);
  assert.deepEqual(moveAppliedJobsLast(jobs, new Set(['1', '2', '3'])), jobs);
  assert.deepEqual(moveAppliedJobsLast([], new Set(['3'])), []);
});

test('All jobs, Nearby and Saved can show Premium badges without a matching-feed flag', () => {
  for (const isSubscribed of [true, 1, '1']) {
    assert.equal(isFeaturedJob(job({ isSubscribed, subscription_expires_at: '2026-11-15T07:18:00Z' }), now), true);
  }
});

test('a job title or subscription plan name alone cannot qualify for a badge', () => {
  for (const isSubscribed of [false, 0, '0', 'false', undefined]) {
    assert.equal(isFeaturedJob({ ...job({ isSubscribed, subscription_plan: 'premium' }), title: 'Premium' }, now), false);
  }
});

test('expired subscriptions and the exact expiry instant do not qualify', () => {
  for (const subscription_expires_at of ['2026-10-14T07:18:00Z', '2026-10-15T07:18:00Z', 'invalid']) {
    assert.equal(isFeaturedJob(job({ isSubscribed: true, subscription_expires_at }), now), false);
  }
});

test('database timestamps are interpreted as UTC consistently with the backend', () => {
  assert.equal(isFeaturedJob(job({ isSubscribed: true, subscription_expires_at: '2026-10-15 07:18:01' }), now), true);
  assert.equal(isFeaturedJob(job({ isSubscribed: true, subscription_expires_at: '2026-10-15 07:18:00' }), now), false);
  assert.equal(isFeaturedJob(job({ isSubscribed: true, subscription_expires_at: '2026-10-15T15:18:01+08:00' }), now), true);
});

test('legacy subscriptions without an expiry follow the existing backend policy', () => {
  assert.equal(isFeaturedJob(job({ isSubscribed: true, subscription_expires_at: null }), now), true);
  assert.equal(isFeaturedJob(job({ isSubscribed: true }), now), true);
});

test('the matching API flag remains authoritative for active jobs', () => {
  assert.equal(isFeaturedJob({ ...job(), is_featured: true }, now), true);
  assert.equal(isFeaturedJob({ ...job({ isSubscribed: true }), is_featured: false }, now), false);
});

test('closed posts and household profiles do not acquire a Premium badge from fallback data', () => {
  assert.equal(isFeaturedJob({ ...job({ isSubscribed: true }), status: 'closed' }, now), false);
  assert.equal(isFeaturedJob({ ...job(), status: 'closed', is_featured: true }, now), false);
  assert.equal(isFeaturedJob({ ...job({ isSubscribed: true }), user: { role: 'household' } }, now), false);
  assert.equal(isFeaturedJob({ status: 'active', household: { isSubscribed: true } }, now), false);
});

test('For You includes an unmatched Premium opening when the AI response contains only one organic job', () => {
  const organic = { ...job(), id: 1, match_percentage: 85, match_source: 'ai_skills_schedule' };
  const premium = { ...job({ isSubscribed: true }), id: 2 };
  const feed = buildForYouJobs([organic], [organic, premium], now);
  assert.deepEqual(feed.map(item => item.id), [2, 1]);
  assert.equal(feed[0].is_featured, true);
  assert.equal(feed[0].match_percentage, null);
  assert.equal(feed[0].match_source, 'premium_featured');
  assert.equal(feed[1].match_percentage, 85);
});

test('current subscription data overrides a stale matching badge without duplicating string/numeric IDs', () => {
  const match = { ...job(), id: '2', is_featured: false, match_percentage: 45, match_source: 'ai_openai' };
  const current = { ...job({ isSubscribed: true }), id: 2, title: 'Updated opening' };
  const feed = buildForYouJobs([match], [current], now);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].is_featured, true);
  assert.equal(feed[0].title, 'Updated opening');
  assert.equal(feed[0].match_percentage, 45);
  assert.equal(feed[0].match_source, 'ai_openai');
});

test('Featured jobs can display while recommendations are still loading', () => {
  const premium = { ...job({ isSubscribed: true }), id: 2 };
  const basic = { ...job(), id: 3 };
  assert.deepEqual(buildForYouJobs([], [basic, premium], now).map(item => item.id), [2]);
  assert.deepEqual(buildForYouJobs([], [basic], now), []);
});

test('expired or downgraded subscriptions do not keep a stale Featured badge on an organic match', () => {
  const match = { ...job({ isSubscribed: true }), id: 2, is_featured: true, match_percentage: 70 };
  for (const profile of [{ isSubscribed: false }, { isSubscribed: true, subscription_expires_at: '2026-10-14T00:00:00Z' }]) {
    const current = { ...job(profile), id: 2 };
    const feed = buildForYouJobs([match], [current], now);
    assert.equal(feed.length, 1);
    assert.equal(feed[0].is_featured, false);
    assert.equal(feed[0].match_percentage, 70);
    assert.deepEqual(buildForYouJobs([], [current], now), []);
  }
});

test('closed jobs are excluded and unrelated basic jobs are not added to For You', () => {
  const closed = { ...job({ isSubscribed: true }), id: 2, status: 'closed', is_featured: true };
  const household = { ...job({ isSubscribed: true }), id: 3, user: { role: 'household' } };
  const basic = { ...job(), id: 4 };
  assert.deepEqual(buildForYouJobs([closed], [closed, household, basic], now), []);
});

test('AI order and matching endpoint data survive when All jobs has not loaded', () => {
  const matches = [
    { ...job(), id: 3, match_percentage: 95 },
    { ...job(), id: 1, match_percentage: 80 },
    { ...job(), id: 2, is_featured: true, match_percentage: 30 },
  ];
  const feed = buildForYouJobs(matches, [], now);
  assert.deepEqual(feed.map(item => item.id), [2, 3, 1]);
  assert.equal(feed[0].match_percentage, 30);
});
