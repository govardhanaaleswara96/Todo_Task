import mongoose from 'mongoose';

export function validateTodoId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid Todo ID. Use a 24-character MongoDB ObjectId.' });
  }
  next();
}

export function validateTodoInput(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, message: 'Send a JSON object containing Todo fields.' });
  }
  const fields = Object.keys(body);
  const allowed = ['title', 'description', 'status'];
  if (fields.some((field) => !allowed.includes(field))) {
    return res.status(400).json({ success: false, message: 'Only title, description, and status can be supplied.' });
  }
  if (req.method === 'PUT' && !fields.length) {
    return res.status(400).json({ success: false, message: 'Provide at least one field to update.' });
  }

  const errors = {};
  const input = {};
  const has = (field) => Object.hasOwn(body, field);
  if (req.method === 'POST' || has('title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.title = 'Title is required and must be a nonblank string.';
    else if (body.title.trim().length > 120) errors.title = 'Title must be 120 characters or fewer.';
    else input.title = body.title.trim();
  }
  if (has('description')) {
    if (typeof body.description !== 'string') errors.description = 'Description must be a string.';
    else if (body.description.trim().length > 1000) errors.description = 'Description must be 1000 characters or fewer.';
    else input.description = body.description.trim();
  }
  if (has('status')) {
    if (!['Pending', 'Completed'].includes(body.status)) errors.status = 'Status must be Pending or Completed.';
    else input.status = body.status;
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Invalid Todo fields.', errors });
  }
  // Pass only validated values to Mongoose. Ownership always comes from the JWT.
  req.todoInput = input;
  next();
}
