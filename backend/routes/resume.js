const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Helper to fetch full resume object
function getFullResumeByUserId(userId) {
  const resume = db.get('SELECT * FROM resumes WHERE user_id = ?', [userId]);
  if (!resume) return null;

  const education = db.all('SELECT * FROM education WHERE resume_id = ? ORDER BY id ASC', [resume.id]);
  const experience = db.all('SELECT * FROM experience WHERE resume_id = ? ORDER BY id ASC', [resume.id]);
  const projects = db.all('SELECT * FROM projects WHERE resume_id = ? ORDER BY id ASC', [resume.id]);
  const certifications = db.all('SELECT * FROM certifications WHERE resume_id = ? ORDER BY id ASC', [resume.id]);
  const skills = db.all('SELECT * FROM skills WHERE resume_id = ? ORDER BY id ASC', [resume.id]);
  const achievements = db.all('SELECT * FROM achievements WHERE resume_id = ? ORDER BY id ASC', [resume.id]);

  return {
    ...resume,
    education,
    experience,
    projects,
    certifications,
    skills,
    achievements
  };
}

// GET /api/resume
router.get('/', authenticateToken, (req, res) => {
  try {
    const fullResume = getFullResumeByUserId(req.user.id);
    if (!fullResume) {
      return res.json({
        success: true,
        data: {
          resume: null,
          message: 'No resume found for this user.'
        }
      });
    }

    return res.json({
      success: true,
      data: { resume: fullResume }
    });
  } catch (error) {
    console.error('Fetch resume error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve resume details.'
    });
  }
});

// POST /api/resume
router.post('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const full_name = body.full_name || body.fullName || '';
    const email = body.email || '';
    const phone = body.phone || '';
    const location = body.location || '';
    const linkedin = body.linkedin || '';
    const github = body.github || '';
    const portfolio = body.portfolio || '';
    const summary = body.summary || '';
    const objective = body.objective || '';

    // Normalize education (array or single object)
    let education = body.education || [];
    if (!Array.isArray(education) && typeof education === 'object') {
      education = [education];
    }

    // Normalize experience (array or single object)
    let experience = body.experience || [];
    if (!Array.isArray(experience) && typeof experience === 'object') {
      experience = [experience];
    }

    // Normalize projects (array or single object)
    let projects = body.projects || [];
    if (!projects.length && body.project) {
      projects = Array.isArray(body.project) ? body.project : [body.project];
    }

    // Normalize certifications (array or string)
    let certifications = body.certifications || [];
    if (!certifications.length && body.certification) {
      if (typeof body.certification === 'string' && body.certification.trim()) {
        certifications = [{ certificate_name: body.certification.trim() }];
      } else if (Array.isArray(body.certification)) {
        certifications = body.certification;
      }
    }

    const skills = body.skills || [];
    const achievements = body.achievements || [];

    let resume = db.get('SELECT id FROM resumes WHERE user_id = ?', [userId]);

    if (!resume) {
      db.run(`
        INSERT INTO resumes (user_id, full_name, email, phone, location, linkedin, github, portfolio, summary, objective)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        full_name || '',
        email || '',
        phone || '',
        location || '',
        linkedin || '',
        github || '',
        portfolio || '',
        summary || '',
        objective || ''
      ]);
      resume = db.get('SELECT id FROM resumes WHERE user_id = ?', [userId]);
    } else {
      db.run(`
        UPDATE resumes
        SET full_name = ?, email = ?, phone = ?, location = ?, linkedin = ?, github = ?, portfolio = ?, summary = ?, objective = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        full_name || '',
        email || '',
        phone || '',
        location || '',
        linkedin || '',
        github || '',
        portfolio || '',
        summary || '',
        objective || '',
        resume.id
      ]);
    }

    const resumeId = resume.id;

    // Replace education entries
    db.run('DELETE FROM education WHERE resume_id = ?', [resumeId]);
    for (const edu of education) {
      if (edu.degree || edu.university || edu.college) {
        db.run(`
          INSERT INTO education (resume_id, degree, college, university, start_year, end_year, cgpa)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          resumeId,
          edu.degree || '',
          edu.college || '',
          edu.university || '',
          edu.start_year || '',
          edu.end_year || '',
          edu.cgpa || ''
        ]);
      }
    }

    // Replace experience entries
    db.run('DELETE FROM experience WHERE resume_id = ?', [resumeId]);
    for (const exp of experience) {
      const jobTitle = exp.job_title || exp.jobTitle || '';
      if (exp.company || jobTitle) {
        db.run(`
          INSERT INTO experience (resume_id, company, job_title, start_date, end_date, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          resumeId,
          exp.company || '',
          jobTitle,
          exp.start_date || '',
          exp.end_date || '',
          exp.description || ''
        ]);
      }
    }

    // Replace projects entries
    db.run('DELETE FROM projects WHERE resume_id = ?', [resumeId]);
    for (const proj of projects) {
      const projName = proj.project_name || proj.name || '';
      if (projName) {
        db.run(`
          INSERT INTO projects (resume_id, project_name, technologies, description, project_url)
          VALUES (?, ?, ?, ?, ?)
        `, [
          resumeId,
          projName,
          proj.technologies || '',
          proj.description || '',
          proj.project_url || ''
        ]);
      }
    }

    // Replace certifications entries
    db.run('DELETE FROM certifications WHERE resume_id = ?', [resumeId]);
    for (const cert of certifications) {
      if (cert.certificate_name) {
        db.run(`
          INSERT INTO certifications (resume_id, certificate_name, issuing_org, year)
          VALUES (?, ?, ?, ?)
        `, [
          resumeId,
          cert.certificate_name || '',
          cert.issuing_org || '',
          cert.year || ''
        ]);
      }
    }

    // Replace skills entries
    db.run('DELETE FROM skills WHERE resume_id = ?', [resumeId]);
    for (const skill of skills) {
      const skillName = typeof skill === 'string' ? skill.trim() : (skill.skill_name || '').trim();
      const cat = typeof skill === 'object' && skill.category ? skill.category : 'General';
      if (skillName) {
        db.run(`
          INSERT INTO skills (resume_id, category, skill_name)
          VALUES (?, ?, ?)
        `, [resumeId, cat, skillName]);
      }
    }

    // Replace achievements entries
    db.run('DELETE FROM achievements WHERE resume_id = ?', [resumeId]);
    for (const ach of achievements) {
      const desc = typeof ach === 'string' ? ach.trim() : (ach.description || '').trim();
      if (desc) {
        db.run(`
          INSERT INTO achievements (resume_id, description)
          VALUES (?, ?)
        `, [resumeId, desc]);
      }
    }

    const updatedResume = getFullResumeByUserId(userId);

    return res.json({
      success: true,
      data: {
        resume: updatedResume,
        message: 'Resume saved successfully!'
      }
    });
  } catch (error) {
    console.error('Save resume error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save resume changes.'
    });
  }
});

// DELETE /api/resume
router.delete('/', authenticateToken, (req, res) => {
  try {
    const resume = db.get('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);
    if (resume) {
      db.run('DELETE FROM education WHERE resume_id = ?', [resume.id]);
      db.run('DELETE FROM experience WHERE resume_id = ?', [resume.id]);
      db.run('DELETE FROM projects WHERE resume_id = ?', [resume.id]);
      db.run('DELETE FROM certifications WHERE resume_id = ?', [resume.id]);
      db.run('DELETE FROM skills WHERE resume_id = ?', [resume.id]);
      db.run('DELETE FROM achievements WHERE resume_id = ?', [resume.id]);
      db.run('DELETE FROM resumes WHERE id = ?', [resume.id]);
    }

    return res.json({
      success: true,
      message: 'Resume deleted successfully.'
    });
  } catch (error) {
    console.error('Delete resume error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete resume.'
    });
  }
});

// GET /api/resume/dashboard-stats
router.get('/dashboard-stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const resume = getFullResumeByUserId(userId);

    // Calculate completion percentage
    let completionScore = 0;
    if (resume) {
      if (resume.full_name && resume.email && resume.phone) completionScore += 20;
      if (resume.summary || resume.objective) completionScore += 15;
      if (resume.education && resume.education.length > 0) completionScore += 15;
      if (resume.experience && resume.experience.length > 0) completionScore += 20;
      if (resume.skills && resume.skills.length >= 3) completionScore += 15;
      if (resume.projects && resume.projects.length > 0) completionScore += 15;
    }

    const skillsCount = resume && resume.skills ? resume.skills.length : 0;

    // Applications count
    const apps = db.all(`
      SELECT a.id, a.status, a.applied_at, j.title, j.company, j.location, j.salary
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.user_id = ?
      ORDER BY a.applied_at DESC
    `, [userId]);

    const appStats = {
      total: apps.length,
      saved: apps.filter(a => a.status === 'Saved').length,
      applied: apps.filter(a => a.status === 'Applied').length,
      interview: apps.filter(a => a.status === 'Interview').length,
      selected: apps.filter(a => a.status === 'Selected').length,
      rejected: apps.filter(a => a.status === 'Rejected').length
    };

    // Interviews count and scores
    const interviews = db.all(`
      SELECT id, job_role, experience_level, interview_type, status, overall_score, technical_score, communication_score, created_at
      FROM interviews
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    let bestScore = 0;
    let latestScore = null;
    const completed = interviews.filter(i => i.status === 'completed' && i.overall_score);
    if (completed.length > 0) {
      latestScore = completed[0].overall_score;
      bestScore = Math.max(...completed.map(i => i.overall_score));
    }

    // Recommended jobs quick calculation
    const allJobs = db.all('SELECT * FROM jobs');
    const userSkillNames = resume && resume.skills 
      ? resume.skills.map(s => s.skill_name.toLowerCase()) 
      : [];

    const scoredJobs = allJobs.map(job => {
      const reqSkills = job.required_skills.split(',').map(s => s.trim().toLowerCase());
      const matched = reqSkills.filter(s => userSkillNames.some(u => u.includes(s) || s.includes(u)));
      const matchPct = reqSkills.length > 0 ? Math.round((matched.length / reqSkills.length) * 100) : 0;
      return {
        ...job,
        matchPct
      };
    }).sort((a, b) => b.matchPct - a.matchPct);

    return res.json({
      success: true,
      data: {
        completionScore,
        skillsCount,
        applications: appStats,
        recentApplications: apps.slice(0, 5),
        interviewStats: {
          total: interviews.length,
          completed: completed.length,
          bestScore,
          latestScore,
          recent: interviews.slice(0, 3)
        },
        recommendedJobs: scoredJobs.slice(0, 4)
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics.'
    });
  }
});

module.exports = router;
