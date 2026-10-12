export type PasswordChangeValues = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeValues, string>>;

export function canChangePasswordForAccount(account: unknown, cachedAccount?: unknown): boolean {
  const metadata = account && typeof account === 'object' ? account as Record<string, unknown> : null;
  const cached = cachedAccount && typeof cachedAccount === 'object' ? cachedAccount as Record<string, unknown> : null;
  for (const details of [metadata, cached]) {
    if (details?.registered_with_google === true || details?.registered_with_google === 1 || details?.registered_with_google === '1' || details?.authentication_method === 'google') return false;
  }
  if (typeof metadata?.can_change_password === 'boolean') return metadata.can_change_password;
  return metadata?.authentication_method === 'password';
}

export function passwordChecks(password: string) {
  return [
    { label: 'At least 8 characters', valid: Array.from(password).length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'One number', valid: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*(),.?":{}|<>)', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];
}

function utf8Length(value: string) {
  return Array.from(value).reduce((bytes, character) => {
    const code = character.codePointAt(0)!;
    return bytes + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
}

export function validatePasswordChange(values: PasswordChangeValues): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  const controls = /[\u0000-\u001f\u007f]/;
  if (!values.current_password.trim()) errors.current_password = 'Enter your current DiskarTech password.';
  else if (Array.from(values.current_password).length > 4096 || controls.test(values.current_password)) errors.current_password = 'The current password contains unsupported characters.';
  if (!passwordChecks(values.password).every(check => check.valid)) errors.password = 'Please meet all password requirements.';
  else if (utf8Length(values.password) > 72) errors.password = 'Please choose a shorter password.';
  else if (controls.test(values.password)) errors.password = 'The password contains unsupported characters.';
  else if (values.password === values.current_password) errors.password = 'Choose a different password from your current password.';
  if (!values.password_confirmation) errors.password_confirmation = 'Confirm your new password.';
  else if (values.password_confirmation !== values.password) errors.password_confirmation = 'The password confirmation does not match.';
  return errors;
}
