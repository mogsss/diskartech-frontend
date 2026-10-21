import api from '@/api/axios';
import type { CertificateData } from '@/components/common/CertificateModal';
import type { useApplicantActions } from '@/hooks/useApplicantActions';
import { applicantErrorMessage, notifyApplicant, type ApplicantContext } from '@/utils/applicantDetails';
import { mediaFilename, resolveMediaUrl } from '@/utils/media';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking } from 'react-native';

type DocumentOptions = ApplicantContext & Pick<ReturnType<typeof useApplicantActions>, 'showNotice' | 'withBusyAction' | 'closeWhenIdle'>;

export function useApplicantDocuments({ applicationId, application, setApplication, showNotice, withBusyAction, closeWhenIdle }: DocumentOptions) {
  const [certificateVisible, setCertificateVisible] = useState(false);
  const [certificateData, setCertificateData] = useState<CertificateData | null>(null);
  const [signatureVisible, setSignatureVisible] = useState(false);
  const [approvingCertificate, setApprovingCertificate] = useState(false);
  const [loadingCertificate, setLoadingCertificate] = useState(false);
  const [resumeVisible, setResumeVisible] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);

  const confirmSignature = (signature: string) => withBusyAction('certificate', async () => {
    try {
      setApprovingCertificate(true);
      const response = await api.post(`/employer/applications/${applicationId}/approve-certificate`, { signature });
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');
      setSignatureVisible(false);
      showNotice('Certificate Issued', 'The official Certificate of Employment has been digitally signed and issued to the student.', true);
      setApplication((previous: any) => ({ ...previous, certificate_status: 'approved', certificate_issued_at: new Date().toISOString(), employer_signature: signature }));
      await notifyApplicant(application, applicationId, 'Certificate of Employment Ready! 📜', `Your Working Student Certificate of Employment for "${application?.job?.title || 'your job'}" has been digitally signed and approved! You can view or download the PDF now!`);
    } catch (error) { showNotice('Notice', applicantErrorMessage(error, 'Unable to approve certificate at this time.')); }
    finally { setApprovingCertificate(false); }
  });

  const previewCertificate = async () => {
    try {
      setLoadingCertificate(true);
      const response = await api.get(`/applications/${applicationId}/certificate-data`);
      if (response.data?.certificate) {
        setCertificateData(response.data.certificate);
        setCertificateVisible(true);
      } else { showNotice('Notice', 'Certificate details could not be loaded.'); }
    } catch { showNotice('Notice', 'Unable to load certificate details at this time.'); }
    finally { setLoadingCertificate(false); }
  };

  const downloadCertificate = async () => {
    const base = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'https://diskartech-backend.onrender.com';
    const url = `${base}/certificate/${applicationId}/view`;
    try { await WebBrowser.openBrowserAsync(url); }
    catch {
      try { await Linking.openURL(url); }
      catch { showNotice('Notice', 'Unable to open the certificate PDF at this time.'); }
    }
  };

  const refreshResume = async () => {
    const response = await api.get(`/employer/applications/${applicationId}`);
    return resolveMediaUrl(response.data?.application?.student?.student_resume);
  };
  const openResume = async () => {
    const student = application?.student || {};
    if (!(student.student_resume || student.resume || student.resume_path)) {
      showNotice('Notice', 'No resume uploaded by this student.'); return;
    }
    try {
      const uri = await refreshResume();
      if (!uri) throw new Error('Resume unavailable');
      setResumeUrl(uri);
      setResumeFilename(mediaFilename(uri) || 'Student Resume');
      setResumeVisible(true);
    } catch { showNotice('Document Unavailable', 'Unable to load this resume. Please try again.'); }
  };

  return {
    certificateVisible, certificateData, loadingCertificate, approvingCertificate, previewCertificate, downloadCertificate,
    closeCertificate: () => setCertificateVisible(false),
    signatureVisible, openSignature: () => setSignatureVisible(true), closeSignature: () => closeWhenIdle(() => setSignatureVisible(false)), confirmSignature,
    resumeVisible, resumeUrl, resumeFilename, openResume, refreshResume, closeResume: () => setResumeVisible(false),
  };
}
