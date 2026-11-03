import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, default: '', maxlength: 1000 },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending', required: true },
}, { timestamps: true, versionKey: false });

// Supports the user-scoped list, sorted newest first.
todoSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Todo', todoSchema);
