import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Avatar from '@/components/ui/Avatar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';
import { formatDate } from '@/utils/helpers';

type IconName = keyof typeof MaterialIcons.glyphMap;

export function ApplicantActionButton({ label, icon, onPress, disabled = false, loading = false, variant = 'outline' }: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const { colors, isDark } = useDarkMode();
  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? (isDark ? colors.accent : '#B91C1C') : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      activeOpacity={0.7}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3"
      style={{ minHeight: 48, borderColor: variant === 'primary' ? '#DC2626' : colors.border, backgroundColor: variant === 'primary' ? '#DC2626' : variant === 'danger' ? (isDark ? 'rgba(220,38,38,0.08)' : '#FEF2F2') : (isDark ? colors.background : '#F8FAFC'), opacity: disabled || loading ? 0.5 : 1 }}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : <MaterialIcons name={icon} size={17} color={textColor} />}
      <Text className="text-xs font-semibold text-center shrink" style={{ color: textColor }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={16} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | number }) {
  const { colors } = useDarkMode();
  return (
    <View className="flex-1 gap-1">
      <Text className="text-[10px] font-medium uppercase tracking-wide" style={{ color: colors.textSecondary }}>{label}</Text>
      <Text className="text-xs leading-5 font-medium" style={{ color: colors.text }}>{value || 'Not provided'}</Text>
    </View>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending review', viewed: 'Viewed', shortlisted: 'Shortlisted', interview: 'For interview',
  accepted: 'Hired / Active', rejected: 'Rejected', cancelled: 'Cancelled', completed: 'Completed', terminated: 'Terminated',
};

interface ApplicantDetailsContentProps {
  application: any;
  contractReview: any;
  avatarUri?: string;
  studentAddress: string;
  availableDaysText: string;
  loadingCert: boolean;
  approvingCert: boolean;
  disabled: boolean;
  completing: boolean;
  onComplete: () => void;
  onTerminate: () => void;
  onReview: () => void;
  onPreviewCertificate: () => void;
  onApproveCertificate: () => void;
  onDownloadCertificate: () => void;
  onEditInterview: () => void;
  onOpenResume: () => void;
}

export default function ApplicantDetailsContent({ application, contractReview, avatarUri, studentAddress, availableDaysText, loadingCert, approvingCert, disabled, completing, onComplete, onTerminate, onReview, onPreviewCertificate, onApproveCertificate, onDownloadCertificate, onEditInterview, onOpenResume }: ApplicantDetailsContentProps) {
  const { colors, isDark } = useDarkMode();
  const student = application.student || {};
  const job = application.job || {};
  const status = String(application.status || 'pending').toLowerCase();
  const isAccepted = status === 'accepted';
  const isConcluded = status === 'terminated' || status === 'completed';
  const successColor = isDark ? '#6EE7B7' : '#047857';
  const isPositive = isAccepted || status === 'completed';
  const isNegative = ['terminated', 'rejected', 'cancelled'].includes(status);
  const statusColor = isPositive ? successColor : isNegative ? (isDark ? colors.accent : '#B91C1C') : colors.textSecondary;
  const subtleBackground = isDark ? colors.background : '#F8FAFC';
  const resumePath = student.student_resume || student.resume || student.resume_path;
  const resumeFilename = resumePath ? String(resumePath).split(/[?#]/)[0].split('/').pop() || 'Uploaded resume' : '';
  const certificateRequested = application.certificate_status === 'requested';
  const certificateApproved = application.certificate_status === 'approved';

  return (
    <>
      <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={student.student_name} size={56} />
          <View className="flex-1 gap-1">
            <Text className="text-lg font-bold" style={{ color: colors.text }}>{student.student_name || 'Student applicant'}</Text>
            <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>{student.course || student.student_school_name || 'Working student'}</Text>
          </View>
        </View>
        <View className="self-start rounded-lg px-2.5 py-1.5 mt-3" style={{ backgroundColor: isPositive ? (isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5') : isNegative ? (isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2') : subtleBackground }}>
          <Text className="text-[11px] font-semibold" style={{ color: statusColor }}>{STATUS_LABELS[status] || status}</Text>
        </View>
        <View className="flex-row gap-3 border-t mt-4 pt-3" style={{ borderColor: colors.border }}>
          <Detail label="Applied" value={application.created_at ? formatDate(application.created_at) : 'Not provided'} />
          <Detail label="Application" value={`#${application.id}`} />
        </View>
      </View>

      <Section title="Applied position" icon="work-outline">
        <Text className="text-base font-semibold mb-1" style={{ color: colors.text }}>{job.title || 'Job position'}</Text>
        {job.category ? <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>{job.category}</Text> : null}
        <View className="flex-row gap-3">
          <Detail label="Posted rate" value={job.salary ? `\u20B1${Number(job.salary).toLocaleString('en-PH')} ${getSalaryUnit(job.salary_type)}` : 'Not provided'} />
          <Detail label="Workplace" value={job.location || job.employer?.location || job.household?.location} />
        </View>
      </Section>

      {(isAccepted || isConcluded) && (
        <Section title="Employment contract" icon="handshake">
          <View className="flex-row gap-3 mb-3">
            <Detail label="Start date" value={application.start_date} />
            <Detail label="End / Duration" value={application.end_date || 'Project-based / Ongoing'} />
          </View>
          <View className="rounded-xl border p-3 gap-3" style={{ backgroundColor: subtleBackground, borderColor: colors.border }}>
            <Detail label="Work schedule" value={application.work_schedule || 'Flexible'} />
            <Detail label="Agreed compensation" value={`\u20B1${Number(application.agreed_rate || job.salary || 0).toLocaleString('en-PH')}`} />
          </View>
          {application.contract_terms ? <View className="mt-3"><Detail label="Contract & termination terms" value={application.contract_terms} /></View> : null}
          {application.special_instructions ? <View className="mt-3"><Detail label="First day instructions" value={application.special_instructions} /></View> : null}
          {status === 'terminated' ? <View className="mt-3"><Detail label="Reason for termination" value={application.termination_reason || 'No reason provided'} /></View> : null}
          {isConcluded && <Text className="text-xs leading-5 mt-3" style={{ color: colors.textSecondary }}>{status === 'completed' ? 'This contract is complete. You can rate the student and review certificate requests below.' : 'This contract has ended. You can rate the student below.'}</Text>}
          {isAccepted && <View className="flex-row gap-2 border-t mt-4 pt-3" style={{ borderColor: colors.border }}>
            <ApplicantActionButton label="Complete contract" icon="task-alt" onPress={onComplete} disabled={disabled} loading={completing} />
            <ApplicantActionButton label="Terminate" icon="remove-circle-outline" onPress={onTerminate} variant="danger" disabled={disabled} />
          </View>}
        </Section>
      )}

      {(isAccepted || isConcluded) && (certificateRequested || certificateApproved) && (
        <Section title="Certificate of employment" icon="workspace-premium">
          <View className="flex-row items-center gap-2 mb-2">
            <MaterialIcons name={certificateApproved ? 'check-circle-outline' : 'hourglass-empty'} size={17} color={certificateApproved ? successColor : colors.textSecondary} />
            <Text className="text-xs font-semibold" style={{ color: certificateApproved ? successColor : colors.text }}>{certificateApproved ? 'Issued & ready' : 'Awaiting your approval'}</Text>
          </View>
          <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>{certificateApproved ? 'The certificate has been signed and issued to the student. You can view it or save a PDF copy.' : 'The student requested proof of employment. Preview the certificate, then add your signature to issue it.'}</Text>
          {(certificateApproved ? application.certificate_issued_at : application.certificate_requested_at) && <Text className="text-[11px] mb-3" style={{ color: colors.textSecondary }}>{certificateApproved ? 'Issued' : 'Requested'} {formatDate(certificateApproved ? application.certificate_issued_at : application.certificate_requested_at)}</Text>}
          <View className="flex-row gap-2">
            <ApplicantActionButton label={certificateApproved ? 'View certificate' : 'Preview'} icon="visibility" onPress={onPreviewCertificate} disabled={disabled} loading={loadingCert} />
            <ApplicantActionButton label={certificateApproved ? 'Save PDF' : 'Approve & issue'} icon={certificateApproved ? 'file-download' : 'draw'} onPress={certificateApproved ? onDownloadCertificate : onApproveCertificate} variant="primary" disabled={disabled || loadingCert} loading={approvingCert} />
          </View>
        </Section>
      )}

      {isConcluded && <Section title="Student performance" icon="star-outline">
        {contractReview?.has_reviewed ? <>
          <View className="flex-row items-center gap-1.5 mb-2">
            <MaterialIcons name="star" size={18} color="#F59E0B" />
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>{Number(contractReview.my_review?.rating || 0).toFixed(1)} / 5</Text>
            <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>Your rating</Text>
          </View>
          {contractReview.my_review?.feedback ? <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>{contractReview.my_review.feedback}</Text> : null}
        </> : <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>Share your experience with the student&apos;s diligence, punctuality, and work attitude.</Text>}
        <View className="flex-row"><ApplicantActionButton label={contractReview?.has_reviewed ? 'View full review' : 'Rate working student'} icon="star-outline" onPress={onReview} disabled={disabled} variant={contractReview?.has_reviewed ? 'outline' : 'primary'} /></View>
      </Section>}

      {status === 'interview' && <Section title="Scheduled interview" icon="event-available">
        <View className="flex-row gap-3 mb-3">
          <Detail label="Date" value={application.interview_date} />
          <Detail label="Time" value={application.interview_time} />
        </View>
        <Detail label={application.interview_type === 'online' ? 'Meeting link' : 'Interview venue'} value={application.interview_location || 'Not set'} />
        <View className="flex-row mt-3"><ApplicantActionButton label="Edit interview" icon="edit-calendar" onPress={onEditInterview} disabled={disabled} /></View>
      </Section>}

      <Section title="Personal details" icon="person-outline">
        <View className="mb-3"><Detail label="Age" value={student.age ? `${student.age} years old` : 'Not provided'} /></View>
        <Detail label="Address" value={studentAddress || 'Not provided'} />
      </Section>
      <Section title="School information" icon="school">
        <View className="gap-3">
          <Detail label="School" value={student.student_school_name} />
          <View className="flex-row gap-3"><Detail label="Course" value={student.course} /><Detail label="Year level" value={student.year_level} /></View>
          <Detail label="Available days" value={availableDaysText} />
        </View>
      </Section>
      <View className="flex-row items-center gap-3 rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <View className="w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: subtleBackground }}>
          <MaterialIcons name="description" size={18} color={colors.textSecondary} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold" style={{ color: colors.text }}>Resume</Text>
          <Text className="text-xs" numberOfLines={1} ellipsizeMode="middle" style={{ color: colors.textSecondary }}>
            {resumePath ? resumeFilename : 'No resume uploaded'}
          </Text>
        </View>
        {Boolean(resumePath) && (
          <TouchableOpacity
            onPress={onOpenResume}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="View resume"
            accessibilityHint="Opens the student's uploaded resume"
            accessibilityState={{ disabled }}
            activeOpacity={0.7}
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2', opacity: disabled ? 0.5 : 1 }}
          >
            <MaterialIcons name="visibility" size={20} color={isDark ? colors.accent : '#B91C1C'} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
