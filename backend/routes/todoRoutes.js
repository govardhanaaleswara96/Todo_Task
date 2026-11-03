import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateTodoId, validateTodoInput } from '../middleware/todoValidation.js';
import { createTodo, getTodos, getTodo, updateTodo, deleteTodo } from '../controllers/todoController.js';

const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(requireAuth);
router.route('/').get(getTodos).post(validateTodoInput, createTodo);
router.route('/:id')
  .all(validateTodoId)
  .get(getTodo)
  .put(validateTodoInput, updateTodo)
  .delete(deleteTodo);

// Todo-specific failures stay separate from the existing auth error responses.
router.use((error, req, res, next) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid Todo data.' });
  }
  console.error('Todo request failed:', error.name);
  res.status(500).json({ success: false, message: 'Could not complete the Todo request. Please try again.' });
});

export default router;
