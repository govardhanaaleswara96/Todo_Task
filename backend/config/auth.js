export const COOKIE_NAME = 'todo_session';
export const SESSION_SECONDS = 60 * 60;
export const JWT_ISSUER = 'todo-api';
export const JWT_AUDIENCE = 'todo-web';

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
  };
}

export function validateAuthConfig() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in backend/.env.');
  }
  if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')) {
    throw new Error('GOOGLE_CLIENT_ID must be a Google Web application client ID.');
  }
}
