interface ApplicationRecord {
  job_id?: string | number | null;
  job?: { id?: string | number | null } | null;
  status?: string | null;
}

/** Cancelled history does not block reapplying; any other application still does. */
export function getAppliedJobIds(applications: readonly ApplicationRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const application of applications) {
    if (String(application.status ?? '').trim().toLowerCase() === 'cancelled') continue;
    const jobId = application.job_id ?? application.job?.id;
    if (jobId != null && String(jobId).trim() !== '') ids.add(String(jobId));
  }
  return ids;
}
