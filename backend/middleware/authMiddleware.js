import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { COOKIE_NAME, JWT_ISSUER, JWT_AUDIENCE } from '../config/auth.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: 'Please sign in with Google.' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      });
    } catch {
      return res.status(401).json({ success: false, message: 'Your session is invalid or expired. Please sign in again.' });
    }
    if (typeof payload.sub !== 'string' || !mongoose.isObjectIdOrHexString(payload.sub)) {
      return res.status(401).json({ success: false, message: 'Invalid session.' });
    }
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: 'Account not found. Please sign in again.' });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
