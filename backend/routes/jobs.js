const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// GET /api/jobs (Public with optional filters)
router.get('/', (req, res) => {
  try {
    const { title, location, skills, experience, salary } = req.query;
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (title) {
      query += ' AND LOWER(title) LIKE ?';
      params.push(`%${title.toLowerCase()}%`);
    }

    if (location) {
      query += ' AND LOWER(location) LIKE ?';
      params.push(`%${location.toLowerCase()}%`);
    }

    if (skills) {
      query += ' AND LOWER(required_skills) LIKE ?';
      params.push(`%${skills.toLowerCase()}%`);
    }

    if (experience && experience !== 'all') {
      query += ' AND LOWER(experience_level) = ?';
      params.push(experience.toLowerCase());
    }

    query += ' ORDER BY id DESC';

    const jobs = db.all(query, params);

    return res.json({
      success: true,
      data: {
        total: jobs.length,
        jobs
      }
    });
  } catch (error) {
    console.error('Fetch jobs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve jobs.'
    });
  }
});

// GET /api/jobs/recommended (Requires user authentication)
router.get('/recommended', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const resume = db.get('SELECT id FROM resumes WHERE user_id = ?', [userId]);

    let userSkills = [];
    if (resume) {
      const skillsRows = db.all('SELECT skill_name FROM skills WHERE resume_id = ?', [resume.id]);
      userSkills = skillsRows.map(s => s.skill_name.trim().toLowerCase());
    }

    const allJobs = db.all('SELECT * FROM jobs ORDER BY id DESC');

    const recommendedJobs = allJobs.map(job => {
      const requiredList = job.required_skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const matchingSkills = [];
      const missingSkills = [];

      for (const reqSkill of requiredList) {
        const lowerReq = reqSkill.toLowerCase();
        const hasSkill = userSkills.some(userSkill => 
          userSkill.includes(lowerReq) || lowerReq.includes(userSkill)
        );

        if (hasSkill) {
          matchingSkills.push(reqSkill);
        } else {
          missingSkills.push(reqSkill);
        }
      }

      const matchPercentage = requiredList.length > 0
        ? Math.round((matchingSkills.length / requiredList.length) * 100)
        : 0;

      return {
        ...job,
        matchPercentage,
        matchingSkills,
        missingSkills,
        recommendedSkills: missingSkills.slice(0, 3)
      };
    });

    // Sort by match percentage descending
    recommendedJobs.sort((a, b) => b.matchPercentage - a.matchPercentage);

    return res.json({
      success: true,
      data: {
        total: recommendedJobs.length,
        userSkillsCount: userSkills.length,
        jobs: recommendedJobs
      }
    });
  } catch (error) {
    console.error('Recommended jobs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate job recommendations.'
    });
  }
});

// GET /api/jobs/applications
router.get('/applications', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const applications = db.all(`
      SELECT 
        a.id, 
        a.user_id, 
        a.job_id, 
        a.status, 
        a.applied_at,
        j.title,
        j.company,
        j.location,
        j.salary,
        j.experience_level,
        j.required_skills,
        j.description
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.user_id = ?
      ORDER BY a.applied_at DESC
    `, [userId]);

    return res.json({
      success: true,
      data: {
        total: applications.length,
        applications
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve application history.'
    });
  }
});

// POST /api/jobs/applications (Save or Apply)
router.post('/applications', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId, status = 'Applied' } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required.'
      });
    }

    const job = db.get('SELECT id FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Specified job does not exist.'
      });
    }

    // Check if already applied or saved
    const existing = db.get(
      'SELECT id, status FROM applications WHERE user_id = ? AND job_id = ?',
      [userId, jobId]
    );

    if (existing) {
      db.run(
        'UPDATE applications SET status = ?, applied_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, existing.id]
      );
      return res.json({
        success: true,
        data: {
          id: existing.id,
          status,
          message: `Application status updated to ${status}.`
        }
      });
    }

    db.run(
      'INSERT INTO applications (user_id, job_id, status) VALUES (?, ?, ?)',
      [userId, jobId, status]
    );

    const newApp = db.get(
      'SELECT id, user_id, job_id, status, applied_at FROM applications WHERE user_id = ? AND job_id = ?',
      [userId, jobId]
    );

    return res.status(201).json({
      success: true,
      data: {
        ...newApp,
        message: `Successfully tracked as ${status}.`
      }
    });
  } catch (error) {
    console.error('Create application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit application tracking.'
    });
  }
});

// PATCH /api/jobs/applications/:id
router.patch('/applications/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const allowedStatuses = ['Saved', 'Applied', 'Interview', 'Selected', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
      });
    }

    const app = db.get('SELECT * FROM applications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'Application record not found.'
      });
    }

    db.run('UPDATE applications SET status = ? WHERE id = ?', [status, id]);

    return res.json({
      success: true,
      data: {
        id,
        status,
        message: `Application status changed to ${status}.`
      }
    });
  } catch (error) {
    console.error('Update application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update application.'
    });
  }
});

// DELETE /api/jobs/applications/:id
router.delete('/applications/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const app = db.get('SELECT id FROM applications WHERE id = ? AND user_id = ?', [id, userId]);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'Application record not found.'
      });
    }

    db.run('DELETE FROM applications WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Application removed from tracker.'
    });
  } catch (error) {
    console.error('Delete application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove application.'
    });
  }
});

module.exports = router;
