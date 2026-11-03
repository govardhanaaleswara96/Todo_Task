import mongoose from 'mongoose';

export function getHealth(req, res) {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    success: connected,
    message: 'React is connected to the Express backend!',
    database: connected ? 'connected' : 'disconnected',
  });
}
