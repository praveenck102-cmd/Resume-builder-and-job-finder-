const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const db = require('../database');
const { authenticateToken } = require('./auth');

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

function parseGeminiJson(rawText, fallbackData) {
  try {
    const cleaned = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Failed to parse interview Gemini JSON output:', err.message);
    return fallbackData;
  }
}

// Question bank fallbacks
function getFallbackQuestions(jobRole, experienceLevel, interviewType) {
  const isSenior = experienceLevel === 'Senior' || experienceLevel === 'Lead';
  
  if (interviewType === 'Technical') {
    return [
      `How do you approach designing a scalable and fault-tolerant system architecture for a high-traffic ${jobRole} application?`,
      `Explain the trade-offs between relational (SQL) and non-relational (NoSQL) databases. When would you choose one over the other?`,
      `How do you identify, diagnose, and resolve memory leaks or severe performance bottlenecks in production code?`,
      `Walk us through how asynchronous execution, concurrency, or event loops work under the hood in your primary language or runtime.`,
      `What strategies and automated testing practices do you implement to ensure zero downtime and robust data consistency during deployments?`
    ];
  } else if (interviewType === 'Behavioral') {
    return [
      `Tell me about a time when you strongly disagreed with a product requirement or technical decision. How did you handle it and what was the outcome?`,
      `Describe a high-pressure situation where a production incident occurred under tight deadlines. How did you communicate and resolve it?`,
      `Give an example of a project where requirements changed midway through execution. How did you adapt your timeline and engineering plan?`,
      `How do you mentor junior teammates or collaborate with cross-functional stakeholders who have non-technical backgrounds?`,
      `Can you share a mistake you made in your engineering career, what you learned from it, and what safeguards you put in place afterward?`
    ];
  } else if (interviewType === 'HR') {
    return [
      `Why are you interested in this ${jobRole} role, and what excites you most about solving problems in this domain?`,
      `How do you prioritize competing priorities when multiple urgent tasks land on your desk simultaneously?`,
      `Where do you see your technical trajectory evolving over the next 3 to 5 years?`,
      `What type of team culture and work environment allows you to do your highest quality work?`,
      `How do you ensure healthy work-life balance and avoid burnout when managing demanding deliverables?`
    ];
  } else {
    // Mixed
    return [
      `Walk us through your technical background and what makes you well-suited for a ${experienceLevel}-level ${jobRole} role.`,
      `Technically speaking, what is one of the most complex architectural problems you solved recently, and why did you choose that approach?`,
      `Describe a challenging team conflict or disagreement you navigated, and how you ensured a constructive collaborative outcome.`,
      `How do you stay up-to-date with emerging tools, libraries, and AI technologies, and how do you evaluate whether to adopt them?`,
      `If given complete technical ownership of a brand new service, what would your step-by-step approach be from day one to launch?`
    ];
  }
}

// POST /api/interview/start
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      jobRole = 'Full Stack Engineer',
      experienceLevel = 'Mid',
      interviewType = 'Mixed'
    } = req.body;

    const ai = getAiClient();
    let questions = getFallbackQuestions(jobRole, experienceLevel, interviewType);

    if (ai) {
      const prompt = `
Generate exactly 5 realistic, high-quality interview questions for a candidate applying for:
Job Role: ${jobRole}
Experience Level: ${experienceLevel}
Interview Type: ${interviewType} (Technical, HR, Behavioral, or Mixed)

Make the questions progressive, starting from domain foundations up to practical scenario-based challenges.
Respond ONLY with a JSON array of 5 strings:
["Question 1...", "Question 2...", "Question 3...", "Question 4...", "Question 5..."]
`;
      try {
        const aiResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        const parsed = parseGeminiJson(aiResponse.text, questions);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          questions = parsed.slice(0, 5);
        }
      } catch (err) {
        console.warn('Gemini question generation error, using curated questions:', err.message);
      }
    }

    db.run(`
      INSERT INTO interviews (user_id, job_role, experience_level, interview_type, status, questions_json)
      VALUES (?, ?, ?, ?, 'in_progress', ?)
    `, [userId, jobRole, experienceLevel, interviewType, JSON.stringify(questions)]);

    const newInterview = db.get(
      'SELECT id, job_role, experience_level, interview_type, status, questions_json, created_at FROM interviews WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [userId]
    );

    return res.status(201).json({
      success: true,
      data: {
        interviewId: newInterview.id,
        jobRole,
        experienceLevel,
        interviewType,
        totalQuestions: questions.length,
        currentQuestionIndex: 0,
        question: questions[0]
      }
    });
  } catch (error) {
    console.error('Start interview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate mock interview session.'
    });
  }
});

// POST /api/interview/answer
router.post('/answer', authenticateToken, async (req, res) => {
  try {
    const { interviewId, questionIndex, answer } = req.body;
    const userId = req.user.id;

    if (!interviewId || questionIndex === undefined || !answer) {
      return res.status(400).json({
        success: false,
        message: 'interviewId, questionIndex, and answer are required.'
      });
    }

    const interview = db.get(
      'SELECT * FROM interviews WHERE id = ? AND user_id = ?',
      [interviewId, userId]
    );

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview session not found.'
      });
    }

    const questions = JSON.parse(interview.questions_json || '[]');
    const currentQuestion = questions[questionIndex] || 'Interview question';

    const ai = getAiClient();
    let evaluation = evaluateAnswerHeuristically(currentQuestion, answer, interview.job_role);

    if (ai) {
      const prompt = `
You are an expert interviewer evaluating a candidate's answer for the role of "${interview.job_role}" (${interview.experience_level} level, ${interview.interview_type} interview).

Question: "${currentQuestion}"
Candidate's Answer: "${answer}"

Evaluate the response objectively on:
1. technicalCorrectness (1-10)
2. communication (1-10)
3. relevance (1-10)
4. confidence (1-10)
5. completeness (1-10)
6. overallScore (0-100)
7. feedback (2-3 sentences of constructive, specific critique)
8. idealResponseTip (1-2 sentences explaining what a top 5% candidate would highlight)

Respond ONLY with valid JSON matching:
{
  "technicalCorrectness": number,
  "communication": number,
  "relevance": number,
  "confidence": number,
  "completeness": number,
  "score": number,
  "feedback": "string",
  "idealResponseTip": "string"
}
`;
      try {
        const aiResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        const parsed = parseGeminiJson(aiResponse.text, evaluation);
        if (parsed && typeof parsed.score === 'number') {
          evaluation = parsed;
        }
      } catch (err) {
        console.warn('Gemini answer evaluation error, using fallback:', err.message);
      }
    }

    // Save answer and evaluation
    db.run(`
      INSERT INTO interview_answers (interview_id, question_index, question, user_answer, evaluation_json, score)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      interviewId,
      questionIndex,
      currentQuestion,
      answer,
      JSON.stringify(evaluation),
      evaluation.score || 80
    ]);

    const nextIndex = Number(questionIndex) + 1;
    const isCompleted = nextIndex >= questions.length;
    const nextQuestion = isCompleted ? null : questions[nextIndex];

    return res.json({
      success: true,
      data: {
        questionIndex,
        evaluation,
        isCompleted,
        nextQuestionIndex: isCompleted ? null : nextIndex,
        nextQuestion
      }
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to evaluate interview answer.'
    });
  }
});

// POST /api/interview/evaluate (Final Report)
router.post('/evaluate', authenticateToken, async (req, res) => {
  try {
    const { interviewId } = req.body;
    const userId = req.user.id;

    const interview = db.get(
      'SELECT * FROM interviews WHERE id = ? AND user_id = ?',
      [interviewId, userId]
    );

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview session not found.'
      });
    }

    const answers = db.all(
      'SELECT * FROM interview_answers WHERE interview_id = ? ORDER BY question_index ASC',
      [interviewId]
    );

    let totalScore = 0;
    let totalTech = 0;
    let totalComm = 0;
    const parsedEvaluations = [];

    for (const ans of answers) {
      try {
        const ev = JSON.parse(ans.evaluation_json);
        parsedEvaluations.push({
          question: ans.question,
          answer: ans.user_answer,
          evaluation: ev
        });
        totalScore += ev.score || 75;
        totalTech += (ev.technicalCorrectness || 7) * 10;
        totalComm += (ev.communication || 8) * 10;
      } catch (e) {
        totalScore += 75;
      }
    }

    const count = Math.max(answers.length, 1);
    const overallScore = Math.round(totalScore / count);
    const technicalScore = Math.round(totalTech / count);
    const communicationScore = Math.round(totalComm / count);

    const feedbackReport = {
      strengths: [
        'Articulated core engineering concepts with logical progression.',
        'Demonstrated strong relevance to the specific requirements of the role.',
        'Answered in a structured, professional tone suitable for corporate and startup environments.'
      ],
      weaknesses: [
        'Could include more concrete statistical metrics or scale metrics in past project examples.',
        'Ensure answers to behavioral questions adhere strictly to the STAR format (Situation, Task, Action, Result).'
      ],
      suggestions: [
        'Frame complex technical trade-offs by comparing at least two competing architectural approaches.',
        'Practice concise 2-minute elevator pitches for deep technical questions to keep recruiters engaged.',
        'Review distributed caching, database indexing, and CI/CD workflow questions prior to final rounds.'
      ]
    };

    // Update interview record
    db.run(`
      UPDATE interviews
      SET status = 'completed',
          overall_score = ?,
          technical_score = ?,
          communication_score = ?,
          feedback_json = ?
      WHERE id = ?
    `, [overallScore, technicalScore, communicationScore, JSON.stringify(feedbackReport), interviewId]);

    return res.json({
      success: true,
      data: {
        interviewId,
        jobRole: interview.job_role,
        experienceLevel: interview.experience_level,
        interviewType: interview.interview_type,
        overallScore,
        technicalScore,
        communicationScore,
        strengths: feedbackReport.strengths,
        weaknesses: feedbackReport.weaknesses,
        suggestions: feedbackReport.suggestions,
        questionsBreakdown: parsedEvaluations
      }
    });
  } catch (error) {
    console.error('Finalize interview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to finalize interview evaluation.'
    });
  }
});

// GET /api/interview/history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const history = db.all(
      `SELECT id, job_role, experience_level, interview_type, status, overall_score, technical_score, communication_score, feedback_json, created_at 
       FROM interviews 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    const formatted = history.map(item => {
      let feedback = null;
      try {
        feedback = JSON.parse(item.feedback_json);
      } catch (e) {}
      return {
        ...item,
        feedback
      };
    });

    return res.json({
      success: true,
      data: {
        total: formatted.length,
        history: formatted
      }
    });
  } catch (error) {
    console.error('Interview history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve interview history.'
    });
  }
});

// Helper for heuristic evaluation
function evaluateAnswerHeuristically(question, answer, jobRole) {
  const wordCount = answer.trim().split(/\s+/).length;
  let score = 70;
  let technicalCorrectness = 7;
  let communication = 7;
  let relevance = 8;
  let confidence = 7;
  let completeness = 7;

  if (wordCount >= 30) {
    score += 8;
    communication += 1;
    completeness += 1;
  }
  if (wordCount >= 70) {
    score += 7;
    technicalCorrectness += 1;
    confidence += 1;
  }
  if (wordCount < 15) {
    score -= 15;
    completeness -= 3;
    confidence -= 2;
  }

  score = Math.min(Math.max(score, 45), 96);
  technicalCorrectness = Math.min(Math.max(technicalCorrectness, 4), 10);
  communication = Math.min(Math.max(communication, 5), 10);
  relevance = Math.min(Math.max(relevance, 5), 10);
  confidence = Math.min(Math.max(confidence, 4), 10);
  completeness = Math.min(Math.max(completeness, 3), 10);

  return {
    technicalCorrectness,
    communication,
    relevance,
    confidence,
    completeness,
    score,
    feedback: `Good attempt with clear reasoning. For ${jobRole}, adding specific quantitative milestones or explaining trade-offs will make your response stand out.`,
    idealResponseTip: 'Highlight the decision framework you used, mention specific metrics (e.g. latency, scale), and summarize the business outcome.'
  };
}

module.exports = router;
