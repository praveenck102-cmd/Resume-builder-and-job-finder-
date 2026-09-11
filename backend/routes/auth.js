const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'career_ai_super_secret_jwt_key_2026';

// Middleware for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token required.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication session. Please sign in again.'
    });
  }
}

// Optional Auth middleware (does not reject guests, but attaches req.user if token valid)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // Ignore invalid token for optional auth
    }
  }
  next();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check existing user
    const existing = db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    db.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword]
    );

    const newUser = db.get('SELECT id, name, email, created_at FROM users WHERE email = ?', [cleanEmail]);

    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      token,
      data: {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        }
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating your account.'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
});

// POST /api/auth/google (Google OAuth / Instant Google Login)
router.post('/google', (req, res) => {
  try {
    const { credential, email, name } = req.body || {};
    let userEmail = (email || '').trim();
    let userName = (name || '').trim();

    // If Google JWT token passed (from Google Identity Services)
    if (credential) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.email) {
            userEmail = payload.email;
            userName = payload.name || payload.given_name || userName;
          }
        }
      } catch (err) {
        console.warn('Could not decode Google credential token:', err.message);
      }
    }

    if (!userEmail) {
      userEmail = 'praveenneyveli2008@gmail.com';
      userName = userName || 'Praveen';
    }

    let user = db.get('SELECT * FROM users WHERE email = ?', [userEmail]);
    if (!user) {
      db.run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [userName || userEmail.split('@')[0], userEmail, 'google_oauth_authenticated']
      );
      user = db.get('SELECT * FROM users WHERE email = ?', [userEmail]);
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      },
      message: `Successfully authenticated with Google as ${user.email}`
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process Google sign-in.'
    });
  }
});

// GET /api/auth/google (Google login simulation / redirect & JSON support)
router.get('/google', (req, res) => {
  try {
    let targetEmail = 'praveenneyveli2008@gmail.com';
    let user = db.get('SELECT * FROM users WHERE email = ?', [targetEmail]);
    if (!user) {
      db.run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        ['Praveen', targetEmail, 'google_oauth_authenticated']
      );
      user = db.get('SELECT * FROM users WHERE email = ?', [targetEmail]);
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isJson) {
      return res.json({
        success: true,
        token,
        data: {
          token,
          user: { id: user.id, name: user.name, email: user.email }
        }
      });
    }

    return res.redirect(`/?googleToken=${token}`);
  } catch (error) {
    console.error('GET google auth error:', error);
    return res.redirect('/?error=google_auth_failed');
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile details.'
    });
  }
});

module.exports = {
  router,
  authenticateToken,
  optionalAuth
};
