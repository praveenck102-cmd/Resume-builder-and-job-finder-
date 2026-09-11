import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();

const require = createRequire(import.meta.url);
const db = require('./backend/database.js');
const { router: authRouter } = require('./backend/routes/auth.js');
const resumeRouter = require('./backend/routes/resume.js');
const jobsRouter = require('./backend/routes/jobs.js');
const aiRouter = require('./backend/routes/ai.js');
const interviewRouter = require('./backend/routes/interview.js');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'online',
      service: 'CareerAI Full Stack Server',
      timestamp: new Date().toISOString()
    }
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/resume', resumeRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/interview', interviewRouter);

// Static assets
const frontendDir = path.join(process.cwd(), 'frontend');
app.use(express.static(frontendDir));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API route '${req.path}' not found`
    });
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});

async function run() {
  try {
    await db.init();
    console.log('✅ Database connected and ready.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 CareerAI server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to boot CareerAI server:', err);
    process.exit(1);
  }
}

run();
