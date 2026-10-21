interface JobFeatureData {
  status?: string;
  is_featured?: boolean;
  user?: { role?: string } | null;
  employer?: {
    isSubscribed?: boolean | number | string;
    subscription_expires_at?: string | null;
    user?: { role?: string } | null;
  } | null;
}

/** Use the feed flag when available; other job feeds include the employer's subscription. */
export function isFeaturedJob(job: JobFeatureData, now = Date.now()): boolean {
  if (job.status !== 'active') return false;
  if (typeof job.is_featured === 'boolean') return job.is_featured;

  const employer = job.employer;
  const role = job.user?.role ?? employer?.user?.role;
  if (!employer || (role && role !== 'employer')) return false;
  if (![true, 1, '1'].includes(employer.isSubscribed ?? false)) return false;

  const expires = employer.subscription_expires_at;
  // Match the backend's existing policy for subscriptions without an expiry.
  if (expires == null || expires === '') return true;

  // Laravel can return an uncast database timestamp; its timezone is UTC.
  const utcExpiry = expires.trim().replace(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/,
    '$1T$2Z'
  );
  const expiresAt = Date.parse(utcExpiry);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

type ForYouJob = JobFeatureData & {
  id: string | number;
  match_percentage?: number | null;
  match_source?: string;
};

/** Keep Premium placement available even when the matching endpoint omits it. */
export function buildForYouJobs(
  matches: ForYouJob[],
  allJobs: ForYouJob[],
  now = Date.now()
): ForYouJob[] {
  const currentJobs = new Map(allJobs.map((job) => [String(job.id), job]));
  const feed = new Map<string, ForYouJob>();

  for (const match of matches) {
    const key = String(match.id);
    const current = currentJobs.get(key);
    const job = current ? {
      ...match,
      ...current,
      match_percentage: match.match_percentage,
      match_source: match.match_source,
    } : match;

    if (job.status !== 'active') continue;
    feed.set(key, { ...job, is_featured: isFeaturedJob(current ?? match, now) });
  }

  for (const job of allJobs) {
    const key = String(job.id);
    if (feed.has(key) || !isFeaturedJob(job, now)) continue;
    feed.set(key, {
      ...job,
      is_featured: true,
      match_percentage: null,
      match_source: 'premium_featured',
    });
  }

  // Stable sorting keeps the AI's order within each group.
  return [...feed.values()].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
}
