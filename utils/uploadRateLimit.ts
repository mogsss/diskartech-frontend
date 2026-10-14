/** Build safe upload cooldown copy without displaying provider errors or request data. */
export function getUploadRateLimitNotice(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { retry_after?: unknown }; headers?: Record<string, unknown> } } | null)?.response;
  if (response?.status !== 429) return null;
  const value = response.data?.retry_after ?? response.headers?.['retry-after'];
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  const seconds = Number.isFinite(parsed) && parsed > 0 && parsed <= 3600 ? Math.ceil(parsed) : 60;
  return {
    title: 'Please wait before uploading',
    message: `Too many uploads. Try again in ${seconds} seconds. Your current files have not been replaced.`,
    iconName: 'schedule' as const,
  };
}
