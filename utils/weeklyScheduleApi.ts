import api from '@/api/axios';

/** Prevent an older backend from accepting the summary while dropping exact hours. */
export async function supportsWeeklySchedules(): Promise<boolean> {
  try {
    const response = await api.get('/schedule-capabilities');
    return response.data?.weekly_schedule_version === 1;
  } catch (error: any) {
    if (error.response?.status === 404) return false;
    throw error;
  }
}
