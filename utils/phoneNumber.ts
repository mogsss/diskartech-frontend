export const MOBILE_NUMBER_ERROR = 'Enter an 11-digit mobile number starting with 09 (e.g., 09123456789).';

export const isValidMobileNumber = (value: string): boolean =>
  value.length === 11 && /^09[0-9]{9}$/.test(value);
