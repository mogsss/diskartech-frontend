import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Avatar from '@/components/ui/Avatar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';
import { formatDate } from '@/utils/helpers';
import { useInterviewCallAvailability } from '@/hooks/useInterviewCallAvailability';

type IconName = keyof typeof MaterialIcons.glyphMap;

export function ApplicantActionButton({ label, icon, onPress, disabled = false, loading = false, variant = 'outline', size = 'default' }: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'default' | 'large';
}) {
  const { colors, isDark } = useDarkMode();
  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? (isDark ? (size === 'large' ? '#FCA5A5' : colors.accent) : '#B91C1C') : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      activeOpacity={0.7}
      className={size === 'large' ? 'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-3.5' : 'flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3'}
      style={{ minHeight: size === 'large' ? 52 : 48, borderColor: variant === 'primary' ? colors.primary : colors.border, backgroundColor: variant === 'primary' ? colors.primary : size === 'large' ? colors.surface : variant === 'danger' ? (isDark ? 'rgba(220,38,38,0.08)' : '#FEF2F2') : (isDark ? colors.background : '#F8FAFC'), opacity: disabled || loading ? 0.5 : 1 }}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : icon ? <MaterialIcons name={icon} size={17} color={textColor} /> : null}
      <Text className={size === 'large' ? 'text-[15px] font-semibold text-center shrink leading-6' : 'text-[13px] font-semibold text-center shrink leading-[22px]'} style={{ color: textColor }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, icon, children, headerAccessory }: { title: string; icon: IconName; children: React.ReactNode; headerAccessory?: React.ReactNode }) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={16} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <Text className="flex-1 text-base leading-6 font-semibold" style={{ color: colors.text }}>{title}</Text>
        {headerAccessory}
      </View>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | number }) {
  const { colors } = useDarkMode();
  return (
    <View className="flex-1 gap-1">
      <Text className="text-[11px] leading-4 font-medium uppercase tracking-wide" style={{ color: colors.textSecondary }}>{label}</Text>
      <Text className="text-sm leading-6 font-medium" style={{ color: colors.text }}>{value || 'Not provided'}</Text>
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
  messaging: boolean;
  onMessage: () => void;
  onComplete: () => void;
  onTerminate: () => void;
  onReview: () => void;
  onPreviewCertificate: () => void;
  onApproveCertificate: () => void;
  onDownloadCertificate: () => void;
  onEditInterview: () => void;
  onJoinInterview: () => void;
  onOpenResume: () => void;
}

export default function ApplicantDetailsContent({ application, contractReview, avatarUri, studentAddress, availableDaysText, loadingCert, approvingCert, disabled, completing, messaging, onMessage, onComplete, onTerminate, onReview, onPreviewCertificate, onApproveCertificate, onDownloadCertificate, onEditInterview, onJoinInterview, onOpenResume }: ApplicantDetailsContentProps) {
  const { colors, isDark } = useDarkMode();
  const student = application.student || {};
  const job = application.job || {};
  const employerLocation = [job.employer?.detailed_address, job.employer?.location].filter(Boolean).join(', ');
  const householdLocation = [job.household?.detailed_address, job.household?.location].filter(Boolean).join(', ');
  const workplace = job.location || employerLocation || householdLocation;
  const status = String(application.status || 'pending').toLowerCase();
  const availability = useInterviewCallAvailability(application.id, status === 'interview');
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
  const statusBadge = (
    <View className="self-start shrink-0 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: isPositive ? (isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5') : isNegative ? (isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2') : subtleBackground }}>
      <Text className="text-xs leading-4 font-semibold" style={{ color: statusColor }}>{STATUS_LABELS[status] || status}</Text>
    </View>
  );

  return (
    <>
      <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={student.student_name} size={56} />
          <View className="flex-1 gap-1">
            <Text className="text-xl leading-7 font-bold" style={{ color: colors.text }}>{student.student_name || 'Student applicant'}</Text>
            <Text className="text-[13px] leading-[22px]" style={{ color: colors.textSecondary }}>{student.course || student.student_school_name || 'Working student'}</Text>
          </View>
          <TouchableOpacity
            onPress={onMessage}
            disabled={disabled || messaging}
            accessibilityRole="button"
            accessibilityLabel="Message student"
            accessibilityState={{ disabled: disabled || messaging, busy: messaging }}
            activeOpacity={0.7}
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2', opacity: disabled || messaging ? 0.5 : 1 }}
          >
            {messaging ? <ActivityIndicator size="small" color={isDark ? colors.accent : '#B91C1C'} /> : <MaterialIcons name="chat-bubble-outline" size={20} color={isDark ? colors.accent : '#B91C1C'} />}
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-3 border-t mt-4 pt-3" style={{ borderColor: colors.border }}>
          <Detail label="Applied" value={application.created_at ? formatDate(application.created_at) : 'Not provided'} />
          <Detail label="Application" value={`#${application.id}`} />
        </View>
      </View>

      <Section title="Applied position" icon="work-outline" headerAccessory={statusBadge}>
        <Text className="text-[17px] leading-6 font-semibold mb-1" style={{ color: colors.text }}>{job.title || 'Job position'}</Text>
        {job.category ? <Text className="text-[13px] leading-[22px] mb-3" style={{ color: colors.textSecondary }}>{job.category}</Text> : null}
        <View className="flex-row gap-3">
          <Detail label="Posted rate" value={job.salary ? `\u20B1${Number(job.salary).toLocaleString('en-PH')} ${getSalaryUnit(job.salary_type)}` : 'Not provided'} />
          <Detail label="Workplace" value={workplace} />
        </View>
      </Section>

      {isConcluded && <Section title="Student performance" icon="star-outline">
        {contractReview?.has_reviewed ? <>
          <View className="flex-row items-center gap-1.5 mb-2">
            <MaterialIcons name="star" size={18} color="#F59E0B" />
            <Text className="text-[15px] leading-6 font-semibold" style={{ color: colors.text }}>{Number(contractReview.my_review?.rating || 0).toFixed(1)} / 5</Text>
            <Text className="text-[13px] ml-2" style={{ color: colors.textSecondary }}>Your rating</Text>
          </View>
          {contractReview.my_review?.feedback ? <Text className="text-[13px] leading-[22px] mb-3" style={{ color: colors.textSecondary }}>{contractReview.my_review.feedback}</Text> : null}
        </> : <Text className="text-[13px] leading-[22px] mb-3" style={{ color: colors.textSecondary }}>Share your experience with the student&apos;s diligence, punctuality, and work attitude.</Text>}
        <View className="flex-row"><ApplicantActionButton label={contractReview?.has_reviewed ? 'View full review' : 'Rate working student'} icon="star-outline" onPress={onReview} disabled={disabled} variant={contractReview?.has_reviewed ? 'outline' : 'primary'} /></View>
      </Section>}

      {(isAccepted || isConcluded) && (
        <Section title="Employment contract" icon="handshake">
          <View className="flex-row gap-3 mb-3">
            <Detail label="Start date" value={application.start_date} />
            <Detail label="End / Duration" value={application.end_date || 'Project-based / Ongoing'} />
          </View>
          <View className="rounded-xl border p-3 gap-3" style={{ backgroundColor: subtleBackground, borderColor: colors.border }}>
            <Detail label="Work schedule" value={application.work_schedule || 'Flexible'} />
            <Detail label="Agreed compensation" value={`\u20B1${Number(application.agreed_rate || job.salary || 0).toLocaleString('en-PH')} ${getSalaryUnit(job.salary_type)}`} />
          </View>
          {application.contract_terms ? <View className="mt-3"><Detail label="Contract & termination terms" value={application.contract_terms} /></View> : null}
          {application.special_instructions ? <View className="mt-3"><Detail label="First day instructions" value={application.special_instructions} /></View> : null}
          {status === 'terminated' ? <View className="mt-3"><Detail label="Reason for termination" value={application.termination_reason || 'No reason provided'} /></View> : null}
          {isConcluded && <Text className="text-[13px] leading-[22px] mt-3" style={{ color: colors.textSecondary }}>{status === 'completed' ? 'This contract is complete. You can review certificate requests below.' : 'This contract has ended.'}</Text>}
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
            <Text className="text-[13px] leading-[22px] font-semibold" style={{ color: certificateApproved ? successColor : colors.text }}>{certificateApproved ? 'Issued & ready' : 'Awaiting your approval'}</Text>
          </View>
          <Text className="text-[13px] leading-[22px] mb-3" style={{ color: colors.textSecondary }}>{certificateApproved ? 'The certificate has been signed and issued to the student. You can view it or save a PDF copy.' : 'The student requested proof of employment. Preview the certificate, then add your signature to issue it.'}</Text>
          {(certificateApproved ? application.certificate_issued_at : application.certificate_requested_at) && <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>{certificateApproved ? 'Issued' : 'Requested'} {formatDate(certificateApproved ? application.certificate_issued_at : application.certificate_requested_at)}</Text>}
          <View className="flex-row gap-2">
            <ApplicantActionButton label={certificateApproved ? 'View certificate' : 'Preview'} icon="visibility" onPress={onPreviewCertificate} disabled={disabled} loading={loadingCert} />
            <ApplicantActionButton label={certificateApproved ? 'Save PDF' : 'Approve & issue'} icon={certificateApproved ? 'file-download' : 'draw'} onPress={certificateApproved ? onDownloadCertificate : onApproveCertificate} variant="primary" disabled={disabled || loadingCert} loading={approvingCert} />
          </View>
        </Section>
      )}

      {status === 'interview' && <Section title="Scheduled interview" icon="event-available">
        <View className="flex-row gap-3 mb-3">
          <Detail label="Date" value={application.interview_date} />
          <Detail label="Time" value={application.interview_time} />
        </View>
        <Detail label={application.interview_type === 'online' ? 'Interview method' : 'Interview venue'} value={application.interview_type === 'online' ? 'DiskarTech video call' : application.interview_location || 'Not set'} />
        {application.interview_type === 'online' && <View className="mt-3"><ApplicantActionButton label="Enter Interview Room" icon="videocam" onPress={onJoinInterview} disabled={disabled || !availability.canJoin} variant="primary" /><Text className="text-xs text-center leading-5 mt-2" style={{ color: colors.textSecondary }}>{availability.message}</Text></View>}
        {availability.canEdit && <View className="flex-row mt-3"><ApplicantActionButton label="Edit interview" icon="edit-calendar" onPress={onEditInterview} disabled={disabled} /></View>}
      </Section>}

      <Section title="Student information" icon="person-outline">
        <View className="gap-3">
          <Detail label="Age" value={student.age ? `${student.age} years old` : 'Not provided'} />
          <Detail label="Address" value={studentAddress || 'Not provided'} />
        </View>
        <View className="gap-3 border-t mt-4 pt-4" style={{ borderColor: colors.border }}>
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
          <Text className="text-base leading-6 font-semibold" style={{ color: colors.text }}>Resume</Text>
          <Text className="text-[13px] leading-[22px]" numberOfLines={1} ellipsizeMode="middle" style={{ color: colors.textSecondary }}>
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
