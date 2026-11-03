import { Router } from 'express';
import { createGoogleLogin, getProfile, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export function createAuthRoutes(verifier) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post('/google', createGoogleLogin(verifier));
  router.get('/profile', requireAuth, getProfile);
  router.post('/logout', logout);
  return router;
}
