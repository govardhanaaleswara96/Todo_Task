// Client-side feedback only. The future backend must validate these values too.
export function validateAuth(values, isSignup) {
  const errors = {};

  if (isSignup && !values.name.trim()) {
    errors.name = 'Enter your name.';
  } else if (isSignup && values.name.trim().length > 100) {
    errors.name = 'Use 100 characters or fewer.';
  }

  if (!values.email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password.trim()) {
    errors.password = 'Enter your password.';
  } else if (isSignup && values.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }

  if (isSignup && !values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (isSignup && values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}
