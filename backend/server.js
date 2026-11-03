import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { validateAuthConfig } from './config/auth.js';
import User from './models/User.js';

const port = Number(process.env.PORT) || 5001;

async function startServer() {
  try {
    validateAuthConfig();
    // Only accept requests after the database connection succeeds.
    await connectDB();
    await User.init(); // Ensure unique email and Google ID indexes exist.
    if (!process.env.GOOGLE_CLIENT_ID) console.warn('Google login requires GOOGLE_CLIENT_ID in backend/.env.');
    const server = app.listen(port, () => {
      console.log(`Backend running at http://localhost:${port}`);
    });
    server.on('error', (error) => {
      console.error('Server could not start:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    console.error('Check MONGODB_URI in backend/.env and make sure MongoDB is running.');
    process.exit(1);
  }
}

startServer();
