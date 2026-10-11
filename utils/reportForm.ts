import { containsMarkup, sanitizePlainText } from './plainTextInput';

export const REPORT_REASONS = [
  { key: 'scam', label: 'Scam or Fraud', icon: 'security' },
  { key: 'fake_job', label: 'Fake Job or Inaccurate Info', icon: 'error-outline' },
  { key: 'underpaid', label: 'Underpaid / Rate Discrepancy', icon: 'payments' },
  { key: 'abuse', label: 'Abuse or Harassment', icon: 'person-outline' },
  { key: 'unsafe', label: 'Unsafe Workplace', icon: 'health-and-safety' },
  { key: 'other', label: 'Other Concern', icon: 'help-outline' },
] as const;

export type ReportReason = typeof REPORT_REASONS[number]['key'];

function reportId(value?: string): string | null {
  if (value == null || value === '') return null;
  const id = value.trim();
  if (!/^[1-9]\d*$/.test(id)) throw new Error('The report target is invalid. Return to the details page and try again.');
  return id;
}

export function buildReportPayload(input: {
  reason: string; description: string; targetName?: string;
  jobId?: string; reportedUserId?: string; targetType?: string;
}) {
  const reason = REPORT_REASONS.find((item) => item.key === input.reason);
  if (!reason) throw new Error('Please select a valid report reason.');
  const description = sanitizePlainText(input.description);
  if (!description) throw new Error('Please provide a brief explanation of the issue.');
  if (description.length > 2000) throw new Error('Please keep your explanation within 2,000 characters.');
  if (containsMarkup(description)) throw new Error('Please use plain text in your explanation. HTML tags are not allowed.');
  const jobId = reportId(input.jobId);
  const reportedUserId = reportId(input.reportedUserId);
  if (input.targetType === 'job' && !jobId) throw new Error('The job is unavailable. Return to the listing and try again.');
  const targetName = sanitizePlainText(input.targetName || 'DiskarTech');
  const subjectTarget = containsMarkup(targetName) ? 'DiskarTech' : targetName || 'DiskarTech';
  return {
    job_id: jobId, reported_user_id: reportedUserId, report_type: reason.key,
    subject: `${reason.label} - ${subjectTarget}`.slice(0, 255), description,
  };
}
