import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

export async function verifyGoogleToken(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error('Google sign-in is not configured on the server.');
    error.status = 503;
    throw error;
  }

  try {
    // Verifies Google's signature, issuer, expiration, and our expected audience.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch {
    const error = new Error('Google sign-in could not be verified. Please try again.');
    error.status = 401;
    throw error;
  }
}
