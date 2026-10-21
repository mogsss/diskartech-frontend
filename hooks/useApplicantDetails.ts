import api from '@/api/axios';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useApplicantDetails(applicationId?: string) {
  const [application, setApplication] = useState<any>(null);
  const [contractReview, setContractReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    if (!applicationId) {
      setLoading(false);
      return;
    }
    const fetchDetails = async (background = false) => {
      try {
        if (!background) setLoading(true);
        const response = await api.get(`/employer/applications/${applicationId}`);
        if (mounted && response.data?.status === 'success') setApplication(response.data.application);
        try {
          const review = await api.get(`/applications/${applicationId}/reviews`);
          if (mounted && review.data?.status === 'success') setContractReview(review.data.data);
        } catch { /* Reviews can be unavailable while the application remains usable. */ }
      } catch (error) {
        if (!background) console.error('Error fetching application details:', error);
      } finally {
        if (mounted && !background) setLoading(false);
      }
    };
    void fetchDetails();
    const interval = setInterval(() => { void fetchDetails(true); }, 2500);
    return () => { mounted = false; clearInterval(interval); };
  }, [applicationId]));

  const student = application?.student || {};
  const job = application?.job || {};
  const status = String(application?.status || '').toLowerCase();
  const studentAddress = [student.detailed_address, student.location].filter(Boolean).join(', ');
  let availableDaysText = 'N/A';
  try {
    if (student.available_days) {
      const days = typeof student.available_days === 'string' ? JSON.parse(student.available_days) : student.available_days;
      availableDaysText = Array.isArray(days) ? days.join(', ') : student.available_days;
    }
  } catch { availableDaysText = student.available_days || 'N/A'; }

  return {
    application, setApplication, contractReview, loading, student, job, status, studentAddress, availableDaysText,
    isReviewable: ['pending', 'viewed', 'shortlisted', 'interview'].includes(status),
  };
}
