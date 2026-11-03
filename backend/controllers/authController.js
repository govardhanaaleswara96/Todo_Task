import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyGoogleToken } from '../services/googleService.js';
import { COOKIE_NAME, SESSION_SECONDS, JWT_ISSUER, JWT_AUDIENCE, cookieOptions } from '../config/auth.js';

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function authError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// The optional verifier is injected only by integration tests, never by API input.
export function createGoogleLogin(verifier = verifyGoogleToken) {
  return async function googleLogin(req, res, next) {
    try {
      const { credential } = req.body || {};
      if (typeof credential !== 'string' || !credential.trim() || credential.length > 16000) {
        throw authError('A Google ID token is required.', 400);
      }
      const payload = await verifier(credential);
      if (!payload || typeof payload.sub !== 'string' || !payload.sub ||
          payload.email_verified !== true || typeof payload.email !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        throw authError('Google must provide a verified email address.');
      }
      const email = payload.email.trim().toLowerCase();
      let user = await User.findOne({ googleId: payload.sub }).select('+googleId');
      if (!user) {
        user = await User.findOne({ email }).select('+googleId');
        if (user) {
          if (user.googleId && user.googleId !== payload.sub) {
            throw authError('This email is already linked to a different Google account.', 409);
          }
          // Google is authoritative for Gmail and verified Workspace accounts.
          // Do not silently link a legacy account based on a third-party email.
          if (!email.endsWith('@gmail.com') && !payload.hd) {
            throw authError('This existing email cannot be linked automatically. Use a Google account with a Google-managed email.', 409);
          }
          user.googleId = payload.sub;
          await user.save();
        } else {
          // Upsert by stable Google subject also handles simultaneous first logins.
          const name = typeof payload.name === 'string' && payload.name.trim()
            ? payload.name.trim().slice(0, 100) : email.split('@')[0].slice(0, 100);
          user = await User.findOneAndUpdate(
            { googleId: payload.sub },
            { $setOnInsert: { googleId: payload.sub, email, name } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
          );
        }
      }
      const token = jwt.sign({}, process.env.JWT_SECRET, {
        algorithm: 'HS256', subject: user.id,
        issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: SESSION_SECONDS,
      });
      res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_SECONDS * 1000 });
      // The JWT stays in the HttpOnly cookie, not in JSON or browser storage.
      res.json({ success: true, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  };
}

export function getProfile(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ success: true, message: 'Signed out.' });
}
