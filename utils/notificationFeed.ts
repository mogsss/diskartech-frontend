export interface NotificationFeedItem {
  id: string;
  type?: string;
  title?: string;
  message?: unknown;
  targetId?: string | number;
  applicationId?: string | number;
  jobId?: string | number;
  senderId?: string | number;
  rawApplication?: { id: string | number; status?: string; job_id?: string | number; student?: { user_id?: string | number } };
  firestoreDocId?: string;
  mergedIds?: string[];
  read?: boolean;
  timestampMs?: number;
  timestamp?: string;
}

// The apply-job endpoint returns the created application under `data`.
// A job ID cannot be used as an application ID when routing or merging alerts.
export function getCreatedApplicationId(response: {
  data?: { id?: unknown }; application?: { id?: unknown }; application_id?: unknown; id?: unknown;
}): string | undefined {
  for (const value of [response.data?.id, response.application?.id, response.application_id, response.id]) {
    const id = String(value ?? '').trim();
    if (/^[1-9]\d*$/.test(id)) return id;
  }
  return undefined;
}

const normalizedMessage = (value: unknown) => typeof value === 'string'
  ? value.trim().replace(/\s+/g, ' ').toLowerCase()
  : '';

const isNewApplicant = (n: NotificationFeedItem) =>
  n.type?.trim().toLowerCase() === 'application' && n.title?.trim().toLowerCase() === 'new applicant';

function resolveLegacyApplicant<T extends NotificationFeedItem>(n: T, applications: NotificationFeedItem[]): T {
  if (!n.firestoreDocId || !isNewApplicant(n) || n.applicationId != null || n.targetId == null || n.senderId == null) return n;

  // Older app versions stored the job ID in target_id. Resolve it using the
  // job, sender, message and submission time, never the displayed name alone.
  const matchesSubmission = (app: NotificationFeedItem) =>
    String(app.senderId ?? app.rawApplication?.student?.user_id ?? '') === String(n.senderId) &&
    normalizedMessage(app.message) !== '' && normalizedMessage(app.message) === normalizedMessage(n.message) &&
    !!app.timestampMs && !!n.timestampMs && Math.abs(app.timestampMs - n.timestampMs) <= 5 * 60 * 1000;
  const candidates = applications.filter((app) =>
    String(app.jobId ?? app.rawApplication?.job_id ?? '') === String(n.targetId) && matchesSubmission(app)
  );
  // Ambiguous matches (for example, cancelled and resubmitted applications)
  // remain separate rather than linking a notification to the wrong applicant.
  if (candidates.length > 1) return n;
  const directMatches = candidates.length ? candidates : applications.filter((app) =>
    String(app.rawApplication?.id ?? app.applicationId ?? app.targetId ?? '') === String(n.targetId) && matchesSubmission(app)
  );
  if (directMatches.length !== 1) return n;
  const applicationId = directMatches[0].rawApplication?.id ?? directMatches[0].applicationId ?? directMatches[0].targetId;
  return applicationId == null ? n : { ...n, applicationId, targetId: applicationId };
}

export function getNotificationDedupeKey(n: NotificationFeedItem): string {
  // An unresolved legacy job ID must never merge with an unrelated application
  // that happens to have the same numeric ID.
  if (n.firestoreDocId && isNewApplicant(n) && n.applicationId == null && n.senderId != null) return n.id;
  const title = (n.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let type = (n.type || '').trim().toLowerCase();
  if (type === 'application_status') type = 'application';

  // API status summaries and live alerts describe the same application event,
  // even when one message is JSX and the other is plain text.
  const applicationId = n.rawApplication?.id ?? n.applicationId ?? n.targetId;
  if (type === 'application' && applicationId != null && String(applicationId).trim()) {
    return `${type}|${title}|${applicationId}`;
  }

  const text = typeof n.message === 'string'
    ? n.message.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  if (text) return `${type}|${title}|${text}`;
  if (n.targetId != null) return `${type}|${title}|${n.targetId}`;
  return n.id;
}

export function mergeNotificationSources<T extends NotificationFeedItem>(...sources: T[][]) {
  const map = new Map<string, T & { mergedIds: string[] }>();
  const applications = sources.flat().filter((n) => !n.firestoreDocId && isNewApplicant(n) && n.rawApplication);
  for (const source of sources) {
    for (const item of source) {
      const n = resolveLegacyApplicant(item, applications);
      const key = getNotificationDedupeKey(n);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...n, mergedIds: n.mergedIds || [n.id] });
        continue;
      }

      // A synthetic API summary may default to read. The actual live alert
      // determines whether the merged notification still needs attention.
      const read = n.firestoreDocId
        ? (existing.firestoreDocId ? existing.read === true && n.read === true : n.read)
        : (existing.firestoreDocId ? existing.read : existing.read || n.read);
      map.set(key, {
        ...existing,
        ...n,
        id: existing.id,
        targetId: existing.targetId ?? n.targetId,
        rawApplication: existing.rawApplication || n.rawApplication,
        mergedIds: Array.from(new Set([...existing.mergedIds, ...(n.mergedIds || [n.id])])),
        read,
        timestampMs: Math.max(existing.timestampMs || 0, n.timestampMs || 0),
        timestamp: (existing.timestampMs || 0) > (n.timestampMs || 0) ? existing.timestamp : n.timestamp,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
}
