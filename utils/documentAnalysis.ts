export const normalizeAiResult = (value: unknown): boolean | null => {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return null;
};

export function getDocumentAnalysisStatus(
  field: 'valid_id_path' | 'certificate_path' | 'school_id' | 'coe',
  uploaded: boolean,
  result: unknown,
): { verdict: 'missing' | 'pending' | 'valid' | 'invalid'; label: string } {
  if (!uploaded) return { verdict: 'missing', label: 'Not uploaded' };
  const valid = normalizeAiResult(result);
  if (valid === null) return { verdict: 'pending', label: 'Pending analysis' };
  const document = { valid_id_path: 'ID', certificate_path: 'Certificate', school_id: 'School ID', coe: 'COR/COE' }[field];
  return { verdict: valid ? 'valid' : 'invalid', label: `${valid ? 'Valid' : 'Invalid'} ${document}` };
}
