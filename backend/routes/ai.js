const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const db = require('../database');
const { authenticateToken, optionalAuth } = require('./auth');

const router = express.Router();

let aiClient = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Clean JSON response helper from model text
function parseGeminiJson(rawText, fallbackData) {
  try {
    const cleaned = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Failed to parse Gemini JSON output, using structured fallback:', err.message);
    return fallbackData;
  }
}

// POST /api/ai/analyze-resume
router.post('/analyze-resume', optionalAuth, async (req, res) => {
  try {
    let resumeData = req.body.resume;

    // If no resume passed in body, load user's saved resume from DB if authenticated
    if (!resumeData) {
      if (!req.user) {
        return res.status(400).json({
          success: false,
          message: 'No resume provided. Please provide resume data or sign in.'
        });
      }
      const resume = db.get('SELECT * FROM resumes WHERE user_id = ?', [req.user.id]);
      if (!resume) {
        return res.status(400).json({
          success: false,
          message: 'No resume found to analyze. Please fill in your resume first.'
        });
      }
      const education = db.all('SELECT * FROM education WHERE resume_id = ?', [resume.id]);
      const experience = db.all('SELECT * FROM experience WHERE resume_id = ?', [resume.id]);
      const projects = db.all('SELECT * FROM projects WHERE resume_id = ?', [resume.id]);
      const skills = db.all('SELECT * FROM skills WHERE resume_id = ?', [resume.id]);
      const certifications = db.all('SELECT * FROM certifications WHERE resume_id = ?', [resume.id]);
      const achievements = db.all('SELECT * FROM achievements WHERE resume_id = ?', [resume.id]);

      resumeData = {
        ...resume,
        education,
        experience,
        projects,
        skills,
        certifications,
        achievements
      };
    }

    const ai = getAiClient();

    // Fallback heuristic analysis if Gemini API key is not yet set or unavailable
    const fallbackAnalysis = generateHeuristicResumeAnalysis(resumeData);

    if (!ai) {
      return res.json({
        success: true,
        data: {
          ...fallbackAnalysis,
          source: 'CareerAI Intelligence Engine (Configured without external API key)'
        }
      });
    }

    const prompt = `
You are a senior technical hiring manager and ATS (Applicant Tracking System) specialist.
Analyze this candidate's resume thoroughly and objectively.

Candidate Resume Data:
${JSON.stringify(resumeData, null, 2)}

Evaluate:
1. Overall resume quality & impact score (0-100)
2. ATS compatibility score (0-100)
3. Grammar, professional tone, and structure
4. Skills relevance and depth
5. Key strengths (at least 3-4 specific points)
6. Real weaknesses or areas lacking metrics (at least 2-3 specific points)
7. Missing high-demand industry skills that would level up their profile
8. Actionable step-by-step suggestions for improvements

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "score": number,
  "atsScore": number,
  "strengths": ["string", "string", ...],
  "weaknesses": ["string", "string", ...],
  "missingSkills": ["string", "string", ...],
  "suggestions": ["string", "string", ...]
}
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const parsed = parseGeminiJson(response.text, fallbackAnalysis);

      return res.json({
        success: true,
        data: {
          score: typeof parsed.score === 'number' ? parsed.score : fallbackAnalysis.score,
          atsScore: typeof parsed.atsScore === 'number' ? parsed.atsScore : fallbackAnalysis.atsScore,
          strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : fallbackAnalysis.strengths,
          weaknesses: Array.isArray(parsed.weaknesses) && parsed.weaknesses.length > 0 ? parsed.weaknesses : fallbackAnalysis.weaknesses,
          missingSkills: Array.isArray(parsed.missingSkills) && parsed.missingSkills.length > 0 ? parsed.missingSkills : fallbackAnalysis.missingSkills,
          suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0 ? parsed.suggestions : fallbackAnalysis.suggestions,
          source: 'Gemini 3.8 Flash'
        }
      });
    } catch (apiError) {
      console.warn('Gemini API call failed, falling back to local intelligence:', apiError.message);
      return res.json({
        success: true,
        data: {
          ...fallbackAnalysis,
          source: 'CareerAI Rule-Based Intelligence'
        }
      });
    }
  } catch (error) {
    console.error('Analyze resume error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze resume.'
    });
  }
});

// POST /api/ai/career-recommendation
router.post('/career-recommendation', authenticateToken, async (req, res) => {
  try {
    let resumeData = req.body.resume;

    if (!resumeData) {
      const resume = db.get('SELECT * FROM resumes WHERE user_id = ?', [req.user.id]);
      if (!resume) {
        return res.status(400).json({
          success: false,
          message: 'No resume found for career recommendations.'
        });
      }
      const education = db.all('SELECT * FROM education WHERE resume_id = ?', [resume.id]);
      const experience = db.all('SELECT * FROM experience WHERE resume_id = ?', [resume.id]);
      const projects = db.all('SELECT * FROM projects WHERE resume_id = ?', [resume.id]);
      const skills = db.all('SELECT * FROM skills WHERE resume_id = ?', [resume.id]);
      resumeData = { ...resume, education, experience, projects, skills };
    }

    const ai = getAiClient();
    const fallbackRecommendation = generateHeuristicCareerRecommendation(resumeData);

    if (!ai) {
      return res.json({
        success: true,
        data: fallbackRecommendation
      });
    }

    const prompt = `
You are a senior tech career strategist and executive coach.
Analyze this candidate's profile:
${JSON.stringify(resumeData, null, 2)}

Provide tailored career path recommendations, skill gap analysis, a 4-week learning roadmap, recommended portfolio projects, and top technical interview topics.

Respond ONLY with valid JSON matching this schema:
{
  "recommendedRoles": ["string", "string", "string"],
  "skillGaps": ["string", "string", "string"],
  "roadmap": [
    { "week": "Week 1", "focus": "string", "tasks": ["string", "string"] },
    { "week": "Week 2", "focus": "string", "tasks": ["string", "string"] },
    { "week": "Week 3", "focus": "string", "tasks": ["string", "string"] },
    { "week": "Week 4", "focus": "string", "tasks": ["string", "string"] }
  ],
  "projects": ["string", "string", "string"],
  "interviewTopics": ["string", "string", "string"]
}
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const parsed = parseGeminiJson(response.text, fallbackRecommendation);

      return res.json({
        success: true,
        data: parsed
      });
    } catch (apiError) {
      console.warn('Gemini Career Recommendation call failed, using fallback:', apiError.message);
      return res.json({
        success: true,
        data: fallbackRecommendation
      });
    }
  } catch (error) {
    console.error('Career recommendation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate career recommendations.'
    });
  }
});

// POST /api/ai/skill-gap
router.post('/skill-gap', optionalAuth, async (req, res) => {
  try {
    const { currentSkills = [], targetRole = 'Full Stack Engineer' } = req.body;

    const ai = getAiClient();
    const fallbackSkillGap = generateHeuristicSkillGap(currentSkills, targetRole);

    if (!ai) {
      return res.json({
        success: true,
        data: fallbackSkillGap
      });
    }

    const prompt = `
Compare candidate's current skills against the target role: "${targetRole}".
Current Skills: ${JSON.stringify(currentSkills)}

Generate:
1. Complete list of industry-expected required skills for this target role
2. Missing skills categorized by priority ("High", "Medium", "Low")
3. A realistic, actionable 4-week step-by-step learning roadmap

Respond ONLY with valid JSON matching this schema:
{
  "currentSkills": ["string"],
  "requiredSkills": ["string"],
  "missingSkills": [
    { "skill": "string", "priority": "High" | "Medium" | "Low" }
  ],
  "roadmap": [
    { "week": "Week 1", "topic": "string", "details": "string" },
    { "week": "Week 2", "topic": "string", "details": "string" },
    { "week": "Week 3", "topic": "string", "details": "string" },
    { "week": "Week 4", "topic": "string", "details": "string" }
  ]
}
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const parsed = parseGeminiJson(response.text, fallbackSkillGap);

      return res.json({
        success: true,
        data: parsed
      });
    } catch (apiError) {
      console.warn('Gemini Skill Gap call failed, using fallback:', apiError.message);
      return res.json({
        success: true,
        data: fallbackSkillGap
      });
    }
  } catch (error) {
    console.error('Skill gap error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze skill gap.'
    });
  }
});

// Heuristic fallback generators
function generateHeuristicResumeAnalysis(resume) {
  const skillCount = resume.skills ? resume.skills.length : 0;
  const hasSummary = Boolean(resume.summary && resume.summary.length > 30);
  const hasExp = Boolean(resume.experience && resume.experience.length > 0);
  const hasEdu = Boolean(resume.education && resume.education.length > 0);
  const hasProjects = Boolean(resume.projects && resume.projects.length > 0);

  let score = 55;
  let atsScore = 60;

  if (hasSummary) { score += 10; atsScore += 10; }
  if (hasExp) { score += 15; atsScore += 15; }
  if (hasEdu) { score += 8; atsScore += 8; }
  if (hasProjects) { score += 8; atsScore += 5; }
  if (skillCount >= 6) { score += 4; atsScore += 2; }

  score = Math.min(score, 94);
  atsScore = Math.min(atsScore, 92);

  const strengths = [
    'Clean chronological structure aligns with ATS standard parsing engines.',
    `Highlighted ${skillCount}+ technical competencies across modern frameworks.`,
    'Included live portfolio, GitHub repository, and contact links for easy recruiter outreach.'
  ];

  if (hasExp) {
    strengths.push('Professional experience includes role definitions and technical ownership.');
  }

  const weaknesses = [
    'Some bullet points would benefit from stronger quantified business impact (e.g. % speedup, $ saved).',
    'Could incorporate more industry-standard technical keywords in the professional summary.'
  ];

  const missingSkills = [
    'Docker & Containerization',
    'CI/CD Pipelines (GitHub Actions / GitLab)',
    'Cloud Architecture (AWS / GCP / Azure)',
    'GraphQL or Microservices Architecture'
  ];

  const suggestions = [
    'Begin bullet points with strong action verbs (e.g., "Architected", "Accelerated", "Streamlined").',
    'Ensure all dates follow standard MMM YYYY formatting for maximum ATS parser fidelity.',
    'Highlight system performance benchmarks or user scale in project descriptions.',
    'Keep section headings standard (Summary, Experience, Education, Technical Skills).'
  ];

  return {
    score,
    atsScore,
    strengths,
    weaknesses,
    missingSkills,
    suggestions
  };
}

function generateHeuristicCareerRecommendation(resume) {
  return {
    recommendedRoles: [
      'Senior Full Stack Engineer',
      'Backend Microservices Architect',
      'Cloud Platform & DevOps Specialist',
      'AI Applications Developer'
    ],
    skillGaps: [
      'Kubernetes & Container Orchestration',
      'High-Throughput Distributed Caching (Redis/Kafka)',
      'System Design for Massive Scale',
      'LLM Agent Frameworks & Vector Databases'
    ],
    roadmap: [
      {
        week: 'Week 1',
        focus: 'Distributed Systems & Microservices',
        tasks: ['Study event-driven architectures', 'Implement Redis caching and message queues']
      },
      {
        week: 'Week 2',
        focus: 'Containers & Cloud Orchestration',
        tasks: ['Multi-stage Docker builds', 'Deploy test service on Kubernetes cluster']
      },
      {
        week: 'Week 3',
        focus: 'Production CI/CD & Observability',
        tasks: ['Configure automated GitHub Actions linting/tests', 'Integrate OpenTelemetry logging']
      },
      {
        week: 'Week 4',
        focus: 'Generative AI & Agent Workflows',
        tasks: ['Build Gemini API tool calling integration', 'Design structured response schemas']
      }
    ],
    projects: [
      'Distributed Task Scheduler with Redis & WebSockets',
      'Event-Driven Microservices E-Commerce Pipeline',
      'Real-Time Code Collaboration Platform with ATS Resume Parser'
    ],
    interviewTopics: [
      'CAP Theorem, ACID vs BASE, and Eventual Consistency',
      'Database Indexing, B-Trees, and Query Optimization',
      'Designing Scalable WebSocket and Real-time Architecture',
      'OAuth 2.0 PKCE and JWT Security Best Practices'
    ]
  };
}

function generateHeuristicSkillGap(currentSkills, targetRole) {
  const currentLower = (currentSkills || []).map(s => s.toLowerCase());

  const standardRoleSkills = {
    'Full Stack Engineer': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'SQL', 'Docker', 'Git', 'REST APIs', 'AWS'],
    'Frontend Developer': ['JavaScript', 'TypeScript', 'React', 'HTML5', 'CSS3', 'Tailwind CSS', 'Redux', 'Vite', 'Performance Optimization'],
    'Backend Engineer': ['Node.js', 'Express', 'Python', 'SQL', 'PostgreSQL', 'Redis', 'Docker', 'System Design', 'Microservices'],
    'AI / ML Engineer': ['Python', 'PyTorch', 'TensorFlow', 'Gemini API', 'Vector Databases', 'Docker', 'FastAPI', 'Data Pipelines'],
    'DevOps Engineer': ['Docker', 'Kubernetes', 'Linux', 'Terraform', 'CI/CD', 'AWS', 'Monitoring', 'Bash']
  };

  const expected = standardRoleSkills[targetRole] || standardRoleSkills['Full Stack Engineer'];

  const missing = [];
  for (const skill of expected) {
    if (!currentLower.some(c => c.includes(skill.toLowerCase()) || skill.toLowerCase().includes(c))) {
      let priority = 'Medium';
      if (['Docker', 'TypeScript', 'SQL', 'System Design', 'Python'].includes(skill)) priority = 'High';
      if (['Tailwind CSS', 'Vite', 'Bash'].includes(skill)) priority = 'Low';
      missing.push({ skill, priority });
    }
  }

  return {
    currentSkills,
    requiredSkills: expected,
    missingSkills: missing.length > 0 ? missing : [
      { skill: 'Kubernetes', priority: 'High' },
      { skill: 'System Design', priority: 'High' },
      { skill: 'Cloud Architecture (AWS)', priority: 'Medium' }
    ],
    roadmap: [
      { week: 'Week 1', topic: 'Core Missing Prerequisites', details: 'Deep dive into fundamental syntax, standard libraries, and architectural patterns.' },
      { week: 'Week 2', topic: 'Practical Implementation', details: 'Build a dedicated end-to-end sandbox project demonstrating hands-on proficiency.' },
      { week: 'Week 3', topic: 'Performance & Optimization', details: 'Apply profiling, benchmarking, automated testing, and security hardening.' },
      { week: 'Week 4', topic: 'Production Readiness & Interview Prep', details: 'Document architectural decisions and practice live whiteboard technical questions.' }
    ]
  };
}

module.exports = router;
