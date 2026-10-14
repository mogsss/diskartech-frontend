export const JOB_LIMITS = { basic: 3, premium: null } as const;

export type JobQuota = {
  plan: 'basic' | 'premium';
  active_job_limit: number | null;
  active_job_count: number;
  remaining_job_slots: number | null;
  can_post_job: boolean;
};

export function normalizeJobQuota(value: unknown): JobQuota | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<JobQuota>;
  if ((data.plan !== 'basic' && data.plan !== 'premium') || data.active_job_limit !== JOB_LIMITS[data.plan]
    || !Number.isSafeInteger(data.active_job_count) || (data.active_job_count as number) < 0) return null;
  const count = data.active_job_count as number;
  return { plan: data.plan, active_job_limit: data.active_job_limit, active_job_count: count,
    remaining_job_slots: data.active_job_limit === null ? null : Math.max(0, data.active_job_limit - count), can_post_job: data.active_job_limit === null || count < data.active_job_limit };
}

export function jobQuotaMessage(quota: JobQuota): string {
  if (quota.active_job_limit === null) return 'Your Premium plan allows unlimited active job posts.';
  return `Your Basic plan allows up to ${quota.active_job_limit} active job posts. Close an existing post before creating or reopening another. Upgrade to Premium for unlimited active job posts.`;
}

export function jobQuotaUsage(quota: JobQuota): string {
  return quota.active_job_limit === null ? `${quota.active_job_count} active job posts · Unlimited` : `${quota.active_job_count}/${quota.active_job_limit} active job posts`;
}

export function jobQuotaAvailability(quota: JobQuota): string {
  if (quota.active_job_limit === null) return 'Unlimited posting with your active Premium plan.';
  return quota.can_post_job ? `${quota.remaining_job_slots} ${quota.remaining_job_slots === 1 ? 'slot' : 'slots'} available.` : 'Close an existing post before adding or reopening another.';
}

export function jobQuotaError(value: unknown): string | null {
  const data = value as { errors?: { active_job_limit?: unknown } } | null;
  const errors = data?.errors?.active_job_limit;
  if (!Array.isArray(errors) || typeof errors[0] !== 'string') return null;
  const message = errors[0].replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '').trim().slice(0, 600);
  return message || null;
}
