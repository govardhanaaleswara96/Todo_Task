import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/healthRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import todoRoutes from './routes/todoRoutes.js';
import documentationRoutes from './routes/documentationRoutes.js';

export function createApp({ googleVerifier } = {}) {
  const app = express();
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5174')
    .split(',').map((origin) => origin.trim()).filter(Boolean);

  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) { callback(null, !origin || allowedOrigins.includes(origin)); },
    credentials: true,
  }));
  // Cookie authentication requires CSRF protection. Browser mutations must come
  // from our allowlisted origin and use JSON (which requires a CORS preflight).
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('origin') && !allowedOrigins.includes(req.get('origin'))) {
        return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
      }
      // DELETE is already a non-simple, preflighted browser method and needs
      // no JSON body. Keep the existing JSON rule for all auth requests.
      const isTodoDelete = req.method === 'DELETE' && req.path.startsWith('/api/todos/');
      if (!req.is('application/json') && !isTodoDelete) {
        return res.status(415).json({ success: false, message: 'Use Content-Type: application/json.' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use('/api', healthRoutes);
  app.use('/api/auth', createAuthRoutes(googleVerifier));
  app.use('/api/todos', todoRoutes);
  app.use('/api/docs', documentationRoutes);
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
  });
  app.use((error, req, res, next) => {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This account already exists. Please try signing in again.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Account information is invalid.' });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, message: 'Invalid JSON request.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ success: false, message: 'Request is too large.' });
    }
    const status = error.status || 500;
    // Do not log tokens, credentials, or database connection strings.
    if (status >= 500) console.error('Request failed:', error.name);
    res.status(status).json({ success: false, message: status < 500 || status === 503
      ? (status === 503 ? 'Google sign-in is not configured or temporarily unavailable.' : error.message)
      : 'An unexpected server error occurred.' });
  });
  return app;
}

export default createApp();
