export interface ApplicationTrailRecord {
  status: string;
  appliedAt?: string | null;
  hiredAt?: string | null;
  terminatedAt?: string | null;
  interviewDate?: string | null;
  interviewTime?: string | null;
  interviewEndedAt?: string | null;
}

export interface ApplicationTrailStep {
  key: string;
  title: string;
  description: string;
  state: 'recorded' | 'current' | 'upcoming';
  occurredAt?: string | null;
}

const statusDetails: Record<string, { label: string; title: string; description: string }> = {
  pending: { label: 'Pending', title: 'Awaiting review', description: 'Your application is waiting for the hirer to review.' },
  viewed: { label: 'Viewed', title: 'Application viewed', description: 'The hirer has viewed your application. Watch for an update or message.' },
  shortlisted: { label: 'Shortlisted', title: 'Shortlisted', description: 'You are being considered for this role. The hirer may contact you about the next step.' },
  interview: { label: 'Interview', title: 'Interview scheduled', description: 'Review the interview details below and coordinate with the hirer.' },
  accepted: { label: 'Accepted', title: 'Application accepted', description: 'Review your employment details below and confirm the work arrangements with the hirer.' },
  rejected: { label: 'Not selected', title: 'Application not selected', description: 'The hirer did not select this application. You can explore other opportunities.' },
  cancelled: { label: 'Cancelled', title: 'Application cancelled', description: 'This application was cancelled. You can apply again if the job is still available.' },
  completed: { label: 'Completed', title: 'Work completed', description: 'Your employment contract is complete. You can request a certificate and rate your hirer below.' },
  terminated: { label: 'Contract concluded', title: 'Contract concluded', description: 'The hirer has ended this employment contract. Review the reason below.' },
};

/** Explicit milestones only: a later status does not prove a review or interview occurred. */
export function buildApplicationTrail(record: ApplicationTrailRecord) {
  const status = record.status.trim().toLowerCase();
  const details = statusDetails[status] ?? {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Status unavailable',
    title: 'Application update', description: 'Message the hirer for more information about your application.',
  };
  const scheduled = [record.interviewDate?.trim(), record.interviewTime?.trim()].filter(Boolean);
  const interviewDescription = scheduled.length
    ? `Scheduled for ${scheduled.join(' at ')}.`
    : 'Review the interview details below and coordinate with the hirer.';
  const steps: ApplicationTrailStep[] = [{
    key: 'submitted', title: 'Application submitted', description: 'Your application was sent to the hirer.',
    state: 'recorded', occurredAt: record.appliedAt,
  }];

  if (status !== 'interview' && (record.interviewDate || record.interviewEndedAt)) {
    steps.push({
      key: 'interview', title: record.interviewEndedAt ? 'Interview call ended' : 'Interview scheduled',
      description: record.interviewEndedAt ? 'The online interview call has ended.' : interviewDescription,
      state: 'recorded', occurredAt: record.interviewEndedAt,
    });
  }
  if (status !== 'accepted' && record.hiredAt) {
    steps.push({
      key: 'accepted', title: 'Application accepted', description: 'The hirer confirmed your employment offer.',
      state: 'recorded', occurredAt: record.hiredAt,
    });
  }

  steps.push({
    key: 'current', title: status === 'interview' && record.interviewEndedAt ? 'Interview call ended' : details.title,
    description: status === 'interview'
      ? record.interviewEndedAt ? 'The call has ended. Wait for the hirer\'s next update.' : interviewDescription
      : details.description,
    state: 'current',
    occurredAt: status === 'accepted' ? record.hiredAt
      : status === 'terminated' ? record.terminatedAt
        : status === 'interview' ? record.interviewEndedAt : undefined,
  });

  if (['pending', 'viewed', 'shortlisted'].includes(status) && !record.interviewDate && !record.interviewEndedAt) {
    steps.push({ key: 'interview-next', title: 'Interview, if needed', description: 'The hirer may invite you to an online or walk-in interview.', state: 'upcoming' });
  }
  if (['pending', 'viewed', 'shortlisted', 'interview'].includes(status)) {
    steps.push({ key: 'decision-next', title: 'Hiring decision', description: 'Wait for the hirer to update your application.', state: 'upcoming' });
  } else if (status === 'accepted') {
    steps.push({ key: 'completion-next', title: 'Complete the work', description: 'Follow the agreed schedule and coordinate with the hirer until the engagement is completed.', state: 'upcoming' });
  }

  return { label: details.label, steps };
}

/** Show saved timestamps in Philippine time; a record update is not a status transition date. */
export function formatTrailTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
