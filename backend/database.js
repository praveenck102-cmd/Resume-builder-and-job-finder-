const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(process.cwd(), 'database');
const DB_FILE = path.join(DB_DIR, 'careerai.db');

let db = null;
let SQL = null;

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  }
}

async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Could not read existing database file, creating fresh one:', err.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      location TEXT,
      linkedin TEXT,
      github TEXT,
      portfolio TEXT,
      summary TEXT,
      objective TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL,
      degree TEXT,
      college TEXT,
      university TEXT,
      start_year TEXT,
      end_year TEXT,
      cgpa TEXT,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experience (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL,
      company TEXT,
      job_title TEXT,
      start_date TEXT,
      end_date TEXT,
      description TEXT,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL,
      project_name TEXT,
      technologies TEXT,
      description TEXT,
      project_url TEXT,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL,
      certificate_name TEXT,
      issuing_org TEXT,
      year TEXT,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL,
      category TEXT,
      skill_name TEXT,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resume_id INTEGER NOT NULL,
      description TEXT,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      salary TEXT NOT NULL,
      experience_level TEXT NOT NULL,
      required_skills TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_role TEXT NOT NULL,
      experience_level TEXT NOT NULL,
      interview_type TEXT NOT NULL,
      status TEXT NOT NULL,
      overall_score INTEGER,
      technical_score INTEGER,
      communication_score INTEGER,
      feedback_json TEXT,
      questions_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interview_id INTEGER NOT NULL,
      question_index INTEGER NOT NULL,
      question TEXT NOT NULL,
      user_answer TEXT,
      evaluation_json TEXT,
      score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    );
  `);

  // Seed sample jobs if empty
  const jobCountStmt = db.prepare('SELECT COUNT(*) as count FROM jobs');
  let jobCount = 0;
  if (jobCountStmt.step()) {
    jobCount = jobCountStmt.getAsObject().count;
  }
  jobCountStmt.free();

  if (jobCount === 0) {
    seedSampleJobs();
  }

  // Seed default demo user if not existing
  const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  let userCount = 0;
  if (userCountStmt.step()) {
    userCount = userCountStmt.getAsObject().count;
  }
  userCountStmt.free();

  if (userCount === 0) {
    seedDemoUser();
  }

  saveDatabase();
  return db;
}

function seedSampleJobs() {
  const sampleJobs = [
    {
      title: 'Senior Full Stack Engineer',
      company: 'CloudScale Technologies',
      location: 'San Francisco, CA (Remote)',
      salary: '$140,000 - $175,000',
      experience_level: 'Senior',
      required_skills: 'React, Node.js, TypeScript, PostgreSQL, Docker, AWS',
      description: 'Build enterprise-grade scalable cloud platforms. Lead architectural design and collaborate with product teams to deliver robust distributed solutions.'
    },
    {
      title: 'Frontend React Developer',
      company: 'Nexus Digital Media',
      location: 'New York, NY (Hybrid)',
      salary: '$95,000 - $125,000',
      experience_level: 'Mid',
      required_skills: 'JavaScript, React, HTML5, CSS3, Tailwind CSS, Redux, REST API',
      description: 'Develop responsive, pixel-perfect user interfaces for next-generation content creators and streaming applications.'
    },
    {
      title: 'Backend Node.js Architect',
      company: 'FinFlow Global',
      location: 'Austin, TX (Remote)',
      salary: '$150,000 - $185,000',
      experience_level: 'Senior',
      required_skills: 'Node.js, Express.js, Microservices, Redis, SQLite, MongoDB, System Design',
      description: 'Design and optimize high-throughput financial transaction processing services with sub-second latencies and 99.99% uptime.'
    },
    {
      title: 'AI Solutions Engineer',
      company: 'Cognitive Dynamics AI',
      location: 'Seattle, WA (Remote)',
      salary: '$130,000 - $165,000',
      experience_level: 'Mid',
      required_skills: 'Python, JavaScript, Gemini API, LLMs, REST API, Prompt Engineering, Docker',
      description: 'Integrate cutting-edge generative AI capabilities and agents into customer workflows and enterprise SaaS suites.'
    },
    {
      title: 'Junior Web Developer',
      company: 'Apex Creative Studio',
      location: 'Chicago, IL (On-site)',
      salary: '$65,000 - $80,000',
      experience_level: 'Entry',
      required_skills: 'HTML5, CSS3, JavaScript, Git, REST API, Responsive Design',
      description: 'Join a vibrant agency crafting interactive web portals, client landing pages, and dynamic web applications.'
    },
    {
      title: 'Cloud DevOps Specialist',
      company: 'Vanguard Systems',
      location: 'Boston, MA (Hybrid)',
      salary: '$120,000 - $150,000',
      experience_level: 'Mid',
      required_skills: 'Docker, Kubernetes, CI/CD, AWS, Linux, Terraform, Git',
      description: 'Implement automated CI/CD pipelines, container orchestration, and multi-region infrastructure as code.'
    },
    {
      title: 'Data Platform Engineer',
      company: 'Insight Analytics Labs',
      location: 'San Jose, CA (Remote)',
      salary: '$135,000 - $170,000',
      experience_level: 'Senior',
      required_skills: 'Python, SQL, PostgreSQL, Data Pipelines, Docker, AWS, Node.js',
      description: 'Design large-scale data ingestion and transformation pipelines powering mission-critical real-time business intelligence.'
    },
    {
      title: 'Mobile App Developer (React Native)',
      company: 'Pulse Health Technologies',
      location: 'Denver, CO (Remote)',
      salary: '$105,000 - $135,000',
      experience_level: 'Mid',
      required_skills: 'React Native, JavaScript, TypeScript, REST API, Redux, Mobile UI',
      description: 'Deliver intuitive mobile health tracking applications with seamless Bluetooth device synchronization.'
    },
    {
      title: 'Cybersecurity Associate',
      company: 'Sentinel Defense Group',
      location: 'Washington, DC (Hybrid)',
      salary: '$90,000 - $115,000',
      experience_level: 'Mid',
      required_skills: 'Linux, Networking, Python, Security Auditing, OWASP, Cloud Security',
      description: 'Monitor vulnerability vectors, perform penetration testing simulations, and strengthen application-level security.'
    },
    {
      title: 'Full Stack JavaScript Engineer',
      company: 'Elevate Commerce',
      location: 'Atlanta, GA (Remote)',
      salary: '$110,000 - $140,000',
      experience_level: 'Mid',
      required_skills: 'JavaScript, TypeScript, React, Node.js, Express.js, SQLite, CSS3',
      description: 'Create lightning-fast omnichannel shopping experiences and frictionless checkout funnels for global retail brands.'
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO jobs (title, company, location, salary, experience_level, required_skills, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const job of sampleJobs) {
    stmt.run([job.title, job.company, job.location, job.salary, job.experience_level, job.required_skills, job.description]);
  }
  stmt.free();
}

function seedDemoUser() {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);

  db.run(`
    INSERT INTO users (name, email, password)
    VALUES ('Alex Morgan', 'demo@careerai.com', '${hashedPassword}');
  `);

  const userStmt = db.prepare("SELECT id FROM users WHERE email = 'demo@careerai.com'");
  let userId = 1;
  if (userStmt.step()) {
    userId = userStmt.getAsObject().id;
  }
  userStmt.free();

  // Create sample resume for demo user
  db.run(`
    INSERT INTO resumes (user_id, full_name, email, phone, location, linkedin, github, portfolio, summary, objective)
    VALUES (
      ${userId},
      'Alex Morgan',
      'demo@careerai.com',
      '+1 (555) 234-5678',
      'San Francisco, CA',
      'https://linkedin.com/in/alexmorgan-dev',
      'https://github.com/alexmorgan',
      'https://alexmorgan.dev',
      'Results-driven Full Stack Engineer with 3+ years of experience designing high-performance web applications, responsive user interfaces, and scalable RESTful microservices. Passionate about AI-driven developer productivity and clean system architecture.',
      'Seeking a challenging Senior Full Stack Developer role to leverage modern JavaScript, cloud infrastructure, and AI technologies to build impactful software products.'
    );
  `);

  const resumeStmt = db.prepare(`SELECT id FROM resumes WHERE user_id = ${userId}`);
  let resumeId = 1;
  if (resumeStmt.step()) {
    resumeId = resumeStmt.getAsObject().id;
  }
  resumeStmt.free();

  // Add education
  db.run(`
    INSERT INTO education (resume_id, degree, college, university, start_year, end_year, cgpa)
    VALUES 
    (${resumeId}, 'B.S. in Computer Science', 'School of Engineering', 'University of California, Berkeley', '2017', '2021', '3.85 / 4.0');
  `);

  // Add experience
  db.run(`
    INSERT INTO experience (resume_id, company, job_title, start_date, end_date, description)
    VALUES 
    (${resumeId}, 'Starlight Cloud Systems', 'Full Stack Software Engineer', '2021-08', 'Present', 'Architected multi-tenant SaaS dashboards serving 85,000+ monthly active users. Reduced API response times by 38% through query optimization and caching. Integrated automated CI/CD testing pipelines.'),
    (${resumeId}, 'Orbit Interactive', 'Frontend Developer Intern', '2020-05', '2020-08', 'Built reusable React design system components with 100% unit test coverage. Collaborated with UX designers to improve core web vitals and mobile responsiveness.');
  `);

  // Add projects
  db.run(`
    INSERT INTO projects (resume_id, project_name, technologies, description, project_url)
    VALUES 
    (${resumeId}, 'TaskFlow AI Project Management', 'React, Node.js, Express, SQLite, Gemini API', 'Collaborative task planner featuring intelligent task prioritization and automated sprint summaries using AI.', 'https://github.com/alexmorgan/taskflow-ai'),
    (${resumeId}, 'Real-Time Telemetry Dashboard', 'JavaScript, HTML5, CSS3, WebSockets, Chart.js', 'High-throughput sensor metrics visualizer processing 5,000 events/sec with dynamic interactive graphs.', 'https://github.com/alexmorgan/telemetry-dash');
  `);

  // Add skills
  const skillsData = [
    { cat: 'Programming Languages', name: 'JavaScript' },
    { cat: 'Programming Languages', name: 'TypeScript' },
    { cat: 'Programming Languages', name: 'Python' },
    { cat: 'Web Technologies', name: 'React' },
    { cat: 'Web Technologies', name: 'Node.js' },
    { cat: 'Web Technologies', name: 'Express.js' },
    { cat: 'Web Technologies', name: 'HTML5' },
    { cat: 'Web Technologies', name: 'CSS3' },
    { cat: 'Web Technologies', name: 'Tailwind CSS' },
    { cat: 'Databases', name: 'SQLite' },
    { cat: 'Databases', name: 'PostgreSQL' },
    { cat: 'Databases', name: 'MongoDB' },
    { cat: 'Tools', name: 'Git' },
    { cat: 'Tools', name: 'Docker' },
    { cat: 'Tools', name: 'Webpack / Vite' },
    { cat: 'Other Skills', name: 'REST APIs' },
    { cat: 'Other Skills', name: 'System Design' }
  ];

  for (const s of skillsData) {
    db.run(`INSERT INTO skills (resume_id, category, skill_name) VALUES (${resumeId}, '${s.cat}', '${s.name}')`);
  }

  // Add certifications
  db.run(`
    INSERT INTO certifications (resume_id, certificate_name, issuing_org, year)
    VALUES 
    (${resumeId}, 'AWS Certified Cloud Practitioner', 'Amazon Web Services', '2023'),
    (${resumeId}, 'Meta Front-End Developer Professional Certificate', 'Meta / Coursera', '2022');
  `);

  // Add achievements
  db.run(`
    INSERT INTO achievements (resume_id, description)
    VALUES 
    (${resumeId}, 'Awarded 1st place in CalHacks 2021 for automated developer workflow tool with 1,200+ collegiate participants.'),
    (${resumeId}, 'Published technical article on scalable Express architecture viewed over 40,000 times on dev.to.');
  `);

  // Seed a sample application
  db.run(`
    INSERT INTO applications (user_id, job_id, status)
    VALUES 
    (${userId}, 1, 'Applied'),
    (${userId}, 2, 'Interview'),
    (${userId}, 3, 'Saved');
  `);

  // Seed sample mock interview
  db.run(`
    INSERT INTO interviews (user_id, job_role, experience_level, interview_type, status, overall_score, technical_score, communication_score, feedback_json)
    VALUES (
      ${userId},
      'Full Stack Engineer',
      'Mid',
      'Mixed',
      'completed',
      88,
      90,
      86,
      '{"strengths":["Strong architectural fundamentals","Clear explanation of async JavaScript"],"weaknesses":["Could give more concrete metrics in behavioral scenarios"],"suggestions":["Structure responses using the STAR method consistently."]}'
    );
  `);
}

// Helper wrapper functions
const dbService = {
  init: initDatabase,
  getDb: () => db,
  save: saveDatabase,

  // Execute a query without returning data
  run: (sql, params = []) => {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
    saveDatabase();
  },

  // Return a single object
  get: (sql, params = []) => {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  },

  // Return an array of objects
  all: (sql, params = []) => {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
};

module.exports = dbService;
