import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Reserved for existing/future password accounts; never selected or serialized.
  password: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  createdAt: { type: Date, default: Date.now },
}, {
  toJSON: {
    transform(doc, result) {
      delete result.password;
      delete result.googleId;
      delete result.__v;
      return result;
    },
  },
});

export default mongoose.model('User', userSchema);
