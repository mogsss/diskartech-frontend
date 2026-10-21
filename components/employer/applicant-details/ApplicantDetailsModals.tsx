import CertificateModal from '@/components/common/CertificateModal';
import DigitalSignatureModal from '@/components/employer/modals/DigitalSignatureModal';
import HireModal from '@/components/employer/modals/HireModal';
import InterviewModal from '@/components/employer/modals/InterviewModal';
import TerminateContractModal from '@/components/employer/modals/TerminateContractModal';
import DocumentViewerModal from '@/components/ui/modals/DocumentViewerModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import type { useApplicantActions } from '@/hooks/useApplicantActions';
import type { useApplicantDetails } from '@/hooks/useApplicantDetails';
import type { useApplicantDocuments } from '@/hooks/useApplicantDocuments';
import { resolveOwnerFromJob } from '@/utils/chat';
import React from 'react';

interface ApplicantDetailsModalsProps {
  details: ReturnType<typeof useApplicantDetails>;
  actions: ReturnType<typeof useApplicantActions>;
  documents: ReturnType<typeof useApplicantDocuments>;
}

export default function ApplicantDetailsModals({ details, actions, documents }: ApplicantDetailsModalsProps) {
  const { application, student, job } = details;
  const notice = <NotificationModal {...actions.notification} />;
  return <>
    <HireModal visible={actions.hireVisible} onClose={actions.closeHire} onSubmit={actions.hire}
      studentName={student.student_name} jobTitle={job.title} defaultRate={job.salary?.toString()}
      defaultSalaryType={job.salary_type} defaultWorkDays={job.available_days} defaultWorkHours={job.time_slot} defaultScheduleSlots={job.schedule_slots} />
    <TerminateContractModal visible={actions.terminateVisible} onClose={actions.closeTerminate} onSubmit={actions.terminate}
      notification={actions.terminateVisible ? notice : null} studentName={student.student_name} jobTitle={job.title} />
    <InterviewModal visible={actions.interviewVisible} onClose={actions.closeInterview} onSubmit={actions.sendInterview}
      loading={actions.busyAction === 'interview'} initialType={application.interview_type === 'online' ? 'online' : 'walk-in'}
      notification={actions.interviewVisible ? notice : null} date={actions.interviewDate} setDate={actions.setInterviewDate}
      time={actions.interviewTime} setTime={actions.setInterviewTime} location={actions.interviewLocation}
      setLocation={actions.setInterviewLocation} defaultAddress={actions.defaultInterviewAddress} />
    <DigitalSignatureModal visible={documents.signatureVisible} onClose={documents.closeSignature} onSubmit={documents.confirmSignature}
      notification={documents.signatureVisible ? notice : null} studentName={student.student_name} jobTitle={job.title}
      signerName={resolveOwnerFromJob(job).owner_name || ''} loading={documents.approvingCertificate} />
    <CertificateModal visible={documents.certificateVisible} onClose={documents.closeCertificate} data={documents.certificateData} />
    <NotificationModal visible={actions.hireSuccessVisible && !actions.hireVisible} title="Applicant Hired!"
      message="The employment contract has been established. You can now coordinate with the student."
      iconName="check-circle" iconColor="#16A34A" iconBgColor="bg-emerald-50" primaryButtonText="Done" onPrimaryPress={actions.closeHireSuccess} />
    {!actions.interviewVisible && !actions.terminateVisible && !documents.signatureVisible && !actions.hireVisible && notice}
    <DocumentViewerModal visible={documents.resumeVisible} onClose={documents.closeResume} title="Student Resume"
      uri={documents.resumeUrl} filename={documents.resumeFilename} refreshUri={documents.refreshResume} />
  </>;
}
