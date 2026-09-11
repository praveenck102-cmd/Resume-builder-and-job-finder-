const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const db = require('./database');
const { router: authRouter } = require('./routes/auth');
const resumeRouter = require('./routes/resume');
const jobsRouter = require('./routes/jobs');
const aiRouter = require('./routes/ai');
const interviewRouter = require('./routes/interview');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'online',
      service: 'CareerAI Backend',
      timestamp: new Date().toISOString()
    }
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/resume', resumeRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/interview', interviewRouter);

// Serve frontend static assets
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint '${req.path}' not found.`
    });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

async function start() {
  try {
    await db.init();
    console.log('✅ SQLite database initialized successfully.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 CareerAI backend running at http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
