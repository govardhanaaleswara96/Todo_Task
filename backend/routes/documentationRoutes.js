import { Router } from 'express';
import { getCatalog, getModule, exportAll } from '../controllers/documentationController.js';

const router = Router();
// Public by explicit product choice. Never expose arbitrary filesystem reads.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
router.get('/', getCatalog);
router.get('/export', exportAll);
router.get('/modules/:moduleId', getModule);
router.use((error, req, res, next) => {
  console.error('Documentation request failed:', error.name);
  res.status(500).json({ success: false, message: 'Could not load the project source. Please retry.' });
});

export default router;
