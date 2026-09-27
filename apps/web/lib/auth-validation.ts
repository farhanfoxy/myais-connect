export interface ValidationResult<T> {
  data?: T;
  errors: Record<string, string>;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateLogin(email: string, password: string): ValidationResult<{ email: string; password: string }> {
  const errors: Record<string, string> = {};
  const normalizedEmail = email.trim().toLowerCase();
  if (!emailPattern.test(normalizedEmail)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  return Object.keys(errors).length ? { errors } : { data: { email: normalizedEmail, password }, errors };
}

export function validateRegistration(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): ValidationResult<{ fullName: string; email: string; password: string }> {
  const login = validateLogin(input.email, input.password);
  const errors = { ...login.errors };
  const fullName = normalizeFullName(input.fullName);
  if (fullName.length < 2) errors.fullName = 'Full name must be at least 2 characters.';
  if (input.password !== input.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return Object.keys(errors).length ? { errors } : {
    data: { fullName, email: input.email.trim().toLowerCase(), password: input.password },
    errors,
  };
}

export function validateEmail(email: string): ValidationResult<{ email: string }> {
  const normalized = email.trim().toLowerCase();
  const errors: Record<string, string> = {};
  if (!emailPattern.test(normalized)) errors.email = 'Enter a valid email address.';
  return Object.keys(errors).length ? { errors } : { data: { email: normalized }, errors };
}

export function validatePasswordReset(password: string, confirmation: string): ValidationResult<{ password: string }> {
  const errors: Record<string, string> = {};
  if (!password) errors.password = 'Enter a new password.';
  if (password !== confirmation) errors.confirmPassword = 'Passwords do not match.';
  return Object.keys(errors).length ? { errors } : { data: { password }, errors };
}
