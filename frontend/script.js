/**
 * CareerAI – Frontend Application Logic
 * Vanilla JavaScript connecting to Express REST APIs
 */

// State Management
const AppState = {
  token: localStorage.getItem('careerai_token') || null,
  user: null,
  currentView: 'landing',
  resume: null,
  activeInterview: null,
  interviewHistory: [],
  allJobs: [],
  userApplications: []
};

// API Base URL
const API_BASE = '/api';

// Helper for API requests
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (AppState.token) {
    headers['Authorization'] = `Bearer ${AppState.token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Token invalid or expired
        if (AppState.token) {
          showToast('Session expired. Please sign in again.', 'error');
          logoutUser();
        }
      }
      throw new Error(data.message || 'An error occurred during API request.');
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// View Navigation
function navigateTo(viewName) {
  AppState.currentView = viewName;

  // Hide all views
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => v.classList.remove('active-view'));

  // Show target view
  const target = document.getElementById(`view${capitalize(viewName)}`);
  if (target) {
    target.classList.add('active-view');
  }

  // Update Nav links
  const navBtns = document.querySelectorAll('.nav-link');
  navBtns.forEach(btn => btn.classList.remove('active'));

  const activeBtn = document.getElementById(`nav${capitalize(viewName)}Btn`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // View specific loaders
  if (viewName === 'dashboard') {
    loadDashboardStats();
  } else if (viewName === 'builder') {
    loadUserResume();
  } else if (viewName === 'jobs') {
    loadJobs();
  } else if (viewName === 'tracker') {
    loadApplications();
  } else if (viewName === 'skillgap') {
    initSkillGapView();
  }

  // Close mobile nav if open
  const navLinks = document.getElementById('navLinks');
  if (navLinks) navLinks.classList.remove('mobile-open');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toggleMobileNav() {
  const navLinks = document.getElementById('navLinks');
  if (navLinks) {
    navLinks.classList.toggle('mobile-open');
  }
}

// Modal Management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

function switchModal(fromModal, toModal) {
  closeModal(fromModal);
  openModal(toModal);
}

function openLoginModal() { openModal('modalLogin'); }
function openRegisterModal() { openModal('modalRegister'); }

// ==================== AUTHENTICATION ====================

async function initAuth() {
  if (!AppState.token) {
    updateAuthUI(false);
    return;
  }

  try {
    const res = await apiRequest('/auth/me');
    if (res.success && res.data.user) {
      AppState.user = res.data.user;
      updateAuthUI(true);
    } else {
      logoutUser();
    }
  } catch (err) {
    logoutUser();
  }
}

function updateAuthUI(isLoggedIn) {
  const guestActions = document.getElementById('guestActions');
  const authActions = document.getElementById('authActions');
  const navUserName = document.getElementById('navUserName');
  const navUserAvatar = document.getElementById('navUserAvatar');
  const authOnlyLinks = document.querySelectorAll('.auth-only');

  if (isLoggedIn && AppState.user) {
    guestActions.style.display = 'none';
    authActions.style.display = 'flex';
    authOnlyLinks.forEach(el => el.style.display = 'block');

    navUserName.innerText = AppState.user.name;
    navUserAvatar.innerText = AppState.user.name.charAt(0).toUpperCase();

    const welcome = document.getElementById('dashWelcomeTitle');
    if (welcome) welcome.innerText = `Welcome back, ${AppState.user.name}!`;
  } else {
    guestActions.style.display = 'flex';
    authActions.style.display = 'none';
    authOnlyLinks.forEach(el => el.style.display = 'none');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('btnLoginSubmit');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Signing in...';

  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res.success) {
      AppState.token = res.data.token;
      AppState.user = res.data.user;
      localStorage.setItem('careerai_token', res.data.token);
      updateAuthUI(true);
      closeModal('modalLogin');
      showToast(`Welcome, ${res.data.user.name}!`, 'success');
      navigateTo('dashboard');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const submitBtn = document.getElementById('btnRegSubmit');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Creating account...';

  try {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    if (res.success) {
      AppState.token = res.data.token;
      AppState.user = res.data.user;
      localStorage.setItem('careerai_token', res.data.token);
      updateAuthUI(true);
      closeModal('modalRegister');
      showToast('Account created successfully!', 'success');
      navigateTo('builder');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Create Account';
  }
}

async function quickDemoLogin() {
  document.getElementById('loginEmail').value = 'demo@careerai.com';
  document.getElementById('loginPassword').value = 'password123';
  
  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@careerai.com', password: 'password123' })
    });

    if (res.success) {
      AppState.token = res.data.token;
      AppState.user = res.data.user;
      localStorage.setItem('careerai_token', res.data.token);
      updateAuthUI(true);
      showToast('Signed in as Demo User (Alex Morgan)', 'success');
      navigateTo('dashboard');
    }
  } catch (err) {
    showToast('Demo login failed: ' + err.message, 'error');
  }
}

function quickFillDemoCredentials() {
  document.getElementById('loginEmail').value = 'demo@careerai.com';
  document.getElementById('loginPassword').value = 'password123';
}

function logoutUser() {
  AppState.token = null;
  AppState.user = null;
  localStorage.removeItem('careerai_token');
  updateAuthUI(false);
  showToast('Logged out successfully.', 'info');
  navigateTo('landing');
}

// ==================== DASHBOARD ====================

async function loadDashboardStats() {
  if (!AppState.token) return;

  try {
    const res = await apiRequest('/resume/dashboard-stats');
    if (res.success && res.data) {
      const stats = res.data;

      // Update stat cards
      document.getElementById('statCompletionVal').innerText = `${stats.completionScore}%`;
      document.getElementById('statSkillsVal').innerText = stats.skillsCount;
      document.getElementById('statAppsVal').innerText = stats.applications.total;
      document.getElementById('statInterviewVal').innerText = stats.interviewStats.bestScore || '--';

      // Render recommended jobs preview
      const jobsContainer = document.getElementById('dashRecommendedJobsList');
      if (stats.recommendedJobs && stats.recommendedJobs.length > 0) {
        jobsContainer.innerHTML = stats.recommendedJobs.map(job => `
          <div style="border-bottom: 1px solid var(--slate-100); padding: 0.75rem 0; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(job.title)}</div>
              <div style="font-size: 0.825rem; color: var(--slate-500);">${escapeHtml(job.company)} • ${escapeHtml(job.location)}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge ${job.matchPct >= 70 ? 'badge-success' : 'badge-primary'}">${job.matchPct}% Match</span>
            </div>
          </div>
        `).join('');
      } else {
        jobsContainer.innerHTML = '<p style="color: var(--slate-500); font-size: 0.9rem;">Add your skills to the resume builder to view matching jobs.</p>';
      }

      // Render recent applications
      const appsContainer = document.getElementById('dashRecentAppsList');
      if (stats.recentApplications && stats.recentApplications.length > 0) {
        appsContainer.innerHTML = stats.recentApplications.map(app => `
          <div style="border-bottom: 1px solid var(--slate-100); padding: 0.75rem 0; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(app.title)}</div>
              <div style="font-size: 0.825rem; color: var(--slate-500);">${escapeHtml(app.company)}</div>
            </div>
            <span class="badge badge-primary">${escapeHtml(app.status)}</span>
          </div>
        `).join('');
      } else {
        appsContainer.innerHTML = '<p style="color: var(--slate-500); font-size: 0.9rem;">No applications tracked yet. Browse jobs to apply.</p>';
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ==================== RESUME BUILDER ====================

function toggleAccordion(id) {
  const body = document.getElementById(id);
  const icon = document.getElementById(`icon-${id}`);
  if (body) {
    body.classList.toggle('open');
    if (icon) {
      icon.innerText = body.classList.contains('open') ? '▼' : '►';
    }
  }
}

async function loadUserResume() {
  if (!AppState.token) {
    loadSampleResumeData();
    return;
  }

  try {
    const res = await apiRequest('/resume');
    if (res.success && res.data.resume) {
      populateResumeForm(res.data.resume);
    } else {
      loadSampleResumeData();
    }
  } catch (err) {
    loadSampleResumeData();
  }
}

function populateResumeForm(resume) {
  AppState.resume = resume;

  // Personal Info
  document.getElementById('resFullName').value = resume.full_name || '';
  document.getElementById('resEmail').value = resume.email || '';
  document.getElementById('resPhone').value = resume.phone || '';
  document.getElementById('resLocation').value = resume.location || '';
  document.getElementById('resLinkedIn').value = resume.linkedin || '';
  document.getElementById('resGitHub').value = resume.github || '';
  document.getElementById('resPortfolio').value = resume.portfolio || '';

  // Career
  document.getElementById('resSummary').value = resume.summary || '';
  document.getElementById('resObjective').value = resume.objective || '';

  // Education
  const eduContainer = document.getElementById('educationList');
  eduContainer.innerHTML = '';
  if (resume.education && resume.education.length > 0) {
    resume.education.forEach(edu => addEducationEntry(edu));
  } else {
    addEducationEntry();
  }

  // Experience
  const expContainer = document.getElementById('experienceList');
  expContainer.innerHTML = '';
  if (resume.experience && resume.experience.length > 0) {
    resume.experience.forEach(exp => addExperienceEntry(exp));
  } else {
    addExperienceEntry();
  }

  // Projects
  const projContainer = document.getElementById('projectsList');
  projContainer.innerHTML = '';
  if (resume.projects && resume.projects.length > 0) {
    resume.projects.forEach(proj => addProjectEntry(proj));
  } else {
    addProjectEntry();
  }

  // Skills
  if (resume.skills && resume.skills.length > 0) {
    const prog = resume.skills.filter(s => s.category === 'Programming Languages').map(s => s.skill_name).join(', ');
    const web = resume.skills.filter(s => s.category === 'Web Technologies').map(s => s.skill_name).join(', ');
    const db = resume.skills.filter(s => s.category === 'Databases').map(s => s.skill_name).join(', ');
    const tools = resume.skills.filter(s => s.category === 'Tools').map(s => s.skill_name).join(', ');
    const other = resume.skills.filter(s => s.category === 'Other Skills' || s.category === 'General').map(s => s.skill_name).join(', ');

    document.getElementById('skillsProg').value = prog;
    document.getElementById('skillsWeb').value = web;
    document.getElementById('skillsDb').value = db;
    document.getElementById('skillsTools').value = tools;
    document.getElementById('skillsOther').value = other;
  }

  // Certifications
  const certContainer = document.getElementById('certificationsList');
  certContainer.innerHTML = '';
  if (resume.certifications && resume.certifications.length > 0) {
    resume.certifications.forEach(cert => addCertificationEntry(cert));
  }

  // Achievements
  const achContainer = document.getElementById('achievementsList');
  achContainer.innerHTML = '';
  if (resume.achievements && resume.achievements.length > 0) {
    resume.achievements.forEach(ach => addAchievementEntry(ach));
  }

  updateLivePreview();
}

function loadSampleResumeData() {
  const sample = {
    full_name: 'Alex Morgan',
    email: 'alex.morgan@careerai.dev',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    linkedin: 'https://linkedin.com/in/alexmorgan-dev',
    github: 'https://github.com/alexmorgan',
    portfolio: 'https://alexmorgan.dev',
    summary: 'Results-driven Full Stack Engineer with 4+ years of experience designing high-performance cloud applications, responsive user interfaces, and scalable RESTful microservices. Passionate about AI-driven developer productivity and clean system architecture.',
    objective: 'Seeking a Senior Full Stack Engineer role to build impactful software products utilizing React, Node.js, and generative AI.',
    education: [
      { degree: 'B.S. in Computer Science', college: 'School of Engineering', university: 'University of California, Berkeley', start_year: '2017', end_year: '2021', cgpa: '3.85 / 4.0' }
    ],
    experience: [
      { company: 'Starlight Cloud Systems', job_title: 'Full Stack Software Engineer', start_date: '2021-08', end_date: 'Present', description: 'Architected multi-tenant SaaS dashboards serving 85,000+ monthly active users. Reduced API response times by 38% through query optimization and Redis caching. Led migration to automated CI/CD testing pipelines.' },
      { company: 'Orbit Interactive', job_title: 'Frontend Developer Intern', start_date: '2020-05', end_date: '2020-08', description: 'Built reusable React design system components with 100% unit test coverage. Collaborated with UX designers to improve core web vitals and mobile responsiveness by 40%.' }
    ],
    projects: [
      { project_name: 'TaskFlow AI Project Management', technologies: 'React, Node.js, Express, SQLite, Gemini API', description: 'Collaborative task planner featuring intelligent task prioritization, automated sprint summaries, and real-time activity timelines.', project_url: 'https://github.com/alexmorgan/taskflow-ai' },
      { project_name: 'Real-Time Telemetry Dashboard', technologies: 'JavaScript, HTML5, CSS3, WebSockets, Chart.js', description: 'High-throughput sensor metrics visualizer processing 5,000 events/sec with dynamic interactive graphs.', project_url: 'https://github.com/alexmorgan/telemetry-dash' }
    ],
    skills: [
      { category: 'Programming Languages', skill_name: 'JavaScript' },
      { category: 'Programming Languages', skill_name: 'TypeScript' },
      { category: 'Programming Languages', skill_name: 'Python' },
      { category: 'Web Technologies', skill_name: 'React' },
      { category: 'Web Technologies', skill_name: 'Node.js' },
      { category: 'Web Technologies', skill_name: 'Express.js' },
      { category: 'Web Technologies', skill_name: 'HTML5' },
      { category: 'Web Technologies', skill_name: 'CSS3' },
      { category: 'Web Technologies', skill_name: 'Tailwind CSS' },
      { category: 'Databases', skill_name: 'SQLite' },
      { category: 'Databases', skill_name: 'PostgreSQL' },
      { category: 'Databases', skill_name: 'MongoDB' },
      { category: 'Tools', skill_name: 'Git' },
      { category: 'Tools', skill_name: 'Docker' },
      { category: 'Tools', skill_name: 'Vite' },
      { category: 'Other Skills', skill_name: 'REST APIs' },
      { category: 'Other Skills', skill_name: 'System Design' }
    ],
    certifications: [
      { certificate_name: 'AWS Certified Cloud Practitioner', issuing_org: 'Amazon Web Services', year: '2023' },
      { certificate_name: 'Meta Front-End Developer Professional Certificate', issuing_org: 'Meta', year: '2022' }
    ],
    achievements: [
      { description: 'Awarded 1st place in CalHacks 2021 for automated developer workflow tool with 1,200+ collegiate participants.' },
      { description: 'Published technical article on scalable Express architecture viewed over 40,000 times on dev.to.' }
    ]
  };

  populateResumeForm(sample);
  showToast('Loaded sample resume data.', 'info');
}

// Dynamic entry builders
function addEducationEntry(data = {}) {
  const container = document.getElementById('educationList');
  const id = 'edu_' + Date.now() + Math.random().toString(36).substr(2, 4);

  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.id = id;
  div.innerHTML = `
    <button type="button" class="item-delete-btn" onclick="removeDynamicItem('${id}')">✕ Delete</button>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Degree / Certificate</label>
        <input type="text" class="form-control edu-degree" value="${escapeAttr(data.degree || '')}" placeholder="B.S. in Computer Science" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">University / College</label>
        <input type="text" class="form-control edu-university" value="${escapeAttr(data.university || data.college || '')}" placeholder="UC Berkeley" oninput="updateLivePreview()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Start Year</label>
        <input type="text" class="form-control edu-start" value="${escapeAttr(data.start_year || '')}" placeholder="2017" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">End Year</label>
        <input type="text" class="form-control edu-end" value="${escapeAttr(data.end_year || '')}" placeholder="2021" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">CGPA / Grade</label>
        <input type="text" class="form-control edu-cgpa" value="${escapeAttr(data.cgpa || '')}" placeholder="3.8 / 4.0" oninput="updateLivePreview()">
      </div>
    </div>
  `;
  container.appendChild(div);
  updateLivePreview();
}

function addExperienceEntry(data = {}) {
  const container = document.getElementById('experienceList');
  const id = 'exp_' + Date.now() + Math.random().toString(36).substr(2, 4);

  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.id = id;
  div.innerHTML = `
    <button type="button" class="item-delete-btn" onclick="removeDynamicItem('${id}')">✕ Delete</button>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Company Name</label>
        <input type="text" class="form-control exp-company" value="${escapeAttr(data.company || '')}" placeholder="Tech Corp" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">Job Title</label>
        <input type="text" class="form-control exp-title" value="${escapeAttr(data.job_title || '')}" placeholder="Software Engineer" oninput="updateLivePreview()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="text" class="form-control exp-start" value="${escapeAttr(data.start_date || '')}" placeholder="2021-08" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">End Date</label>
        <input type="text" class="form-control exp-end" value="${escapeAttr(data.end_date || '')}" placeholder="Present" oninput="updateLivePreview()">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Key Responsibilities & Quantified Achievements</label>
      <textarea class="form-control exp-desc" rows="3" placeholder="Describe your key impact, technologies used, and measurable results..." oninput="updateLivePreview()">${escapeHtml(data.description || '')}</textarea>
    </div>
  `;
  container.appendChild(div);
  updateLivePreview();
}

function addProjectEntry(data = {}) {
  const container = document.getElementById('projectsList');
  const id = 'proj_' + Date.now() + Math.random().toString(36).substr(2, 4);

  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.id = id;
  div.innerHTML = `
    <button type="button" class="item-delete-btn" onclick="removeDynamicItem('${id}')">✕ Delete</button>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Project Name</label>
        <input type="text" class="form-control proj-name" value="${escapeAttr(data.project_name || '')}" placeholder="e.g. AI Workflow Platform" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">Technologies Used</label>
        <input type="text" class="form-control proj-tech" value="${escapeAttr(data.technologies || '')}" placeholder="React, Node.js, SQLite" oninput="updateLivePreview()">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Project URL / GitHub</label>
      <input type="url" class="form-control proj-url" value="${escapeAttr(data.project_url || '')}" placeholder="https://github.com/..." oninput="updateLivePreview()">
    </div>
    <div class="form-group">
      <label class="form-label">Description & Architecture</label>
      <textarea class="form-control proj-desc" rows="2" placeholder="Explain the problem solved, architecture choices, and metrics..." oninput="updateLivePreview()">${escapeHtml(data.description || '')}</textarea>
    </div>
  `;
  container.appendChild(div);
  updateLivePreview();
}

function addCertificationEntry(data = {}) {
  const container = document.getElementById('certificationsList');
  const id = 'cert_' + Date.now() + Math.random().toString(36).substr(2, 4);

  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.id = id;
  div.innerHTML = `
    <button type="button" class="item-delete-btn" onclick="removeDynamicItem('${id}')">✕ Delete</button>
    <div class="form-row">
      <div class="form-group" style="flex: 2;">
        <label class="form-label">Certificate Name</label>
        <input type="text" class="form-control cert-name" value="${escapeAttr(data.certificate_name || '')}" placeholder="AWS Certified Architect" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">Issuing Org</label>
        <input type="text" class="form-control cert-org" value="${escapeAttr(data.issuing_org || '')}" placeholder="Amazon" oninput="updateLivePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">Year</label>
        <input type="text" class="form-control cert-year" value="${escapeAttr(data.year || '')}" placeholder="2023" oninput="updateLivePreview()">
      </div>
    </div>
  `;
  container.appendChild(div);
  updateLivePreview();
}

function addAchievementEntry(data = {}) {
  const container = document.getElementById('achievementsList');
  const id = 'ach_' + Date.now() + Math.random().toString(36).substr(2, 4);

  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.id = id;
  div.innerHTML = `
    <button type="button" class="item-delete-btn" onclick="removeDynamicItem('${id}')">✕ Delete</button>
    <div class="form-group">
      <label class="form-label">Achievement Description</label>
      <input type="text" class="form-control ach-desc" value="${escapeAttr(data.description || '')}" placeholder="1st place in National Hackathon with 1,000+ competitors" oninput="updateLivePreview()">
    </div>
  `;
  container.appendChild(div);
  updateLivePreview();
}

function removeDynamicItem(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  updateLivePreview();
}

function gatherResumeFormData() {
  // Collect education
  const education = [];
  document.querySelectorAll('#educationList .dynamic-item').forEach(el => {
    const degree = el.querySelector('.edu-degree').value.trim();
    const university = el.querySelector('.edu-university').value.trim();
    const start_year = el.querySelector('.edu-start').value.trim();
    const end_year = el.querySelector('.edu-end').value.trim();
    const cgpa = el.querySelector('.edu-cgpa').value.trim();
    if (degree || university) {
      education.push({ degree, university, start_year, end_year, cgpa });
    }
  });

  // Collect experience
  const experience = [];
  document.querySelectorAll('#experienceList .dynamic-item').forEach(el => {
    const company = el.querySelector('.exp-company').value.trim();
    const job_title = el.querySelector('.exp-title').value.trim();
    const start_date = el.querySelector('.exp-start').value.trim();
    const end_date = el.querySelector('.exp-end').value.trim();
    const description = el.querySelector('.exp-desc').value.trim();
    if (company || job_title) {
      experience.push({ company, job_title, start_date, end_date, description });
    }
  });

  // Collect projects
  const projects = [];
  document.querySelectorAll('#projectsList .dynamic-item').forEach(el => {
    const project_name = el.querySelector('.proj-name').value.trim();
    const technologies = el.querySelector('.proj-tech').value.trim();
    const project_url = el.querySelector('.proj-url').value.trim();
    const description = el.querySelector('.proj-desc').value.trim();
    if (project_name) {
      projects.push({ project_name, technologies, project_url, description });
    }
  });

  // Collect skills
  const skills = [];
  const parseSkills = (input, category) => {
    return input.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(skill_name => ({ category, skill_name }));
  };

  skills.push(...parseSkills(document.getElementById('skillsProg').value, 'Programming Languages'));
  skills.push(...parseSkills(document.getElementById('skillsWeb').value, 'Web Technologies'));
  skills.push(...parseSkills(document.getElementById('skillsDb').value, 'Databases'));
  skills.push(...parseSkills(document.getElementById('skillsTools').value, 'Tools'));
  skills.push(...parseSkills(document.getElementById('skillsOther').value, 'Other Skills'));

  // Collect certifications
  const certifications = [];
  document.querySelectorAll('#certificationsList .dynamic-item').forEach(el => {
    const certificate_name = el.querySelector('.cert-name').value.trim();
    const issuing_org = el.querySelector('.cert-org').value.trim();
    const year = el.querySelector('.cert-year').value.trim();
    if (certificate_name) {
      certifications.push({ certificate_name, issuing_org, year });
    }
  });

  // Collect achievements
  const achievements = [];
  document.querySelectorAll('#achievementsList .dynamic-item').forEach(el => {
    const description = el.querySelector('.ach-desc').value.trim();
    if (description) {
      achievements.push({ description });
    }
  });

  return {
    full_name: document.getElementById('resFullName').value.trim(),
    email: document.getElementById('resEmail').value.trim(),
    phone: document.getElementById('resPhone').value.trim(),
    location: document.getElementById('resLocation').value.trim(),
    linkedin: document.getElementById('resLinkedIn').value.trim(),
    github: document.getElementById('resGitHub').value.trim(),
    portfolio: document.getElementById('resPortfolio').value.trim(),
    summary: document.getElementById('resSummary').value.trim(),
    objective: document.getElementById('resObjective').value.trim(),
    education,
    experience,
    projects,
    skills,
    certifications,
    achievements
  };
}

// Live ATS Preview Renderer
function updateLivePreview() {
  const data = gatherResumeFormData();

  // Header
  document.getElementById('prevName').innerText = data.full_name || 'YOUR NAME';
  
  const contacts = [];
  if (data.location) contacts.push(data.location);
  if (data.email) contacts.push(data.email);
  if (data.phone) contacts.push(data.phone);
  document.getElementById('prevContacts').innerHTML = contacts.join(' • ') || 'City, State • email@domain.com • Phone';

  const links = [];
  if (data.linkedin) links.push(`<a href="${escapeAttr(data.linkedin)}" target="_blank">LinkedIn</a>`);
  if (data.github) links.push(`<a href="${escapeAttr(data.github)}" target="_blank">GitHub</a>`);
  if (data.portfolio) links.push(`<a href="${escapeAttr(data.portfolio)}" target="_blank">Portfolio</a>`);
  document.getElementById('prevLinks').innerHTML = links.join(' • ') || '';

  // Summary
  const prevSecSummary = document.getElementById('prevSectionSummary');
  if (data.summary) {
    prevSecSummary.style.display = 'block';
    document.getElementById('prevSummaryText').innerText = data.summary;
  } else {
    prevSecSummary.style.display = 'none';
  }

  // Experience
  const prevSecExp = document.getElementById('prevSectionExperience');
  if (data.experience.length > 0) {
    prevSecExp.style.display = 'block';
    document.getElementById('prevExperienceEntries').innerHTML = data.experience.map(exp => `
      <div class="resume-entry">
        <div class="resume-entry-header">
          <span>${escapeHtml(exp.company)}</span>
          <span>${escapeHtml(exp.start_date || '')} – ${escapeHtml(exp.end_date || 'Present')}</span>
        </div>
        <div class="resume-entry-sub">
          <span>${escapeHtml(exp.job_title)}</span>
        </div>
        <div class="resume-entry-desc">${escapeHtml(exp.description)}</div>
      </div>
    `).join('');
  } else {
    prevSecExp.style.display = 'none';
  }

  // Education
  const prevSecEdu = document.getElementById('prevSectionEducation');
  if (data.education.length > 0) {
    prevSecEdu.style.display = 'block';
    document.getElementById('prevEducationEntries').innerHTML = data.education.map(edu => `
      <div class="resume-entry">
        <div class="resume-entry-header">
          <span>${escapeHtml(edu.university || edu.college)}</span>
          <span>${escapeHtml(edu.start_year || '')} – ${escapeHtml(edu.end_year || '')}</span>
        </div>
        <div class="resume-entry-sub">
          <span>${escapeHtml(edu.degree)}</span>
          <span>${edu.cgpa ? 'GPA: ' + escapeHtml(edu.cgpa) : ''}</span>
        </div>
      </div>
    `).join('');
  } else {
    prevSecEdu.style.display = 'none';
  }

  // Projects
  const prevSecProj = document.getElementById('prevSectionProjects');
  if (data.projects.length > 0) {
    prevSecProj.style.display = 'block';
    document.getElementById('prevProjectsEntries').innerHTML = data.projects.map(proj => `
      <div class="resume-entry">
        <div class="resume-entry-header">
          <span>${escapeHtml(proj.project_name)} ${proj.technologies ? `<span style="font-weight:400; font-size:0.8rem; color:var(--slate-600);">| ${escapeHtml(proj.technologies)}</span>` : ''}</span>
          ${proj.project_url ? `<a href="${escapeAttr(proj.project_url)}" target="_blank" style="font-size:0.8rem;">Link ↗</a>` : ''}
        </div>
        <div class="resume-entry-desc">${escapeHtml(proj.description)}</div>
      </div>
    `).join('');
  } else {
    prevSecProj.style.display = 'none';
  }

  // Skills
  const prevSecSkills = document.getElementById('prevSectionSkills');
  if (data.skills.length > 0) {
    prevSecSkills.style.display = 'block';
    const grouped = {};
    data.skills.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s.skill_name);
    });

    document.getElementById('prevSkillsEntries').innerHTML = Object.entries(grouped).map(([cat, skills]) => `
      <div><strong>${escapeHtml(cat)}:</strong> ${escapeHtml(skills.join(', '))}</div>
    `).join('');
  } else {
    prevSecSkills.style.display = 'none';
  }

  // Certifications
  const prevSecCert = document.getElementById('prevSectionCertifications');
  if (data.certifications.length > 0) {
    prevSecCert.style.display = 'block';
    document.getElementById('prevCertEntries').innerHTML = data.certifications.map(cert => `
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.25rem;">
        <span><strong>${escapeHtml(cert.certificate_name)}</strong> — ${escapeHtml(cert.issuing_org)}</span>
        <span>${escapeHtml(cert.year)}</span>
      </div>
    `).join('');
  } else {
    prevSecCert.style.display = 'none';
  }

  // Achievements
  const prevSecAch = document.getElementById('prevSectionAchievements');
  if (data.achievements.length > 0) {
    prevSecAch.style.display = 'block';
    document.getElementById('prevAchievementsEntries').innerHTML = data.achievements.map(ach => `
      <li>${escapeHtml(ach.description)}</li>
    `).join('');
  } else {
    prevSecAch.style.display = 'none';
  }
}

async function saveCurrentResume() {
  if (!AppState.token) {
    showToast('Please sign in or use Demo Login to save your resume to the cloud.', 'info');
    openLoginModal();
    return;
  }

  const payload = gatherResumeFormData();
  const btn = document.getElementById('btnSaveResume');
  btn.disabled = true;
  btn.innerText = 'Saving...';

  try {
    const res = await apiRequest('/resume', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      AppState.resume = res.data.resume;
      showToast('Resume saved successfully!', 'success');
    }
  } catch (err) {
    showToast('Failed to save resume: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '💾 Save Resume';
  }
}

function printResumePreview() {
  window.print();
}

function triggerAnalyzeFromBuilder() {
  navigateTo('analysis');
  runAiResumeAnalysis();
}

// ==================== AI RESUME ANALYSIS ====================

async function runAiResumeAnalysis() {
  const loading = document.getElementById('analysisLoadingState');
  const results = document.getElementById('analysisResultContainer');
  const btn = document.getElementById('btnRunAnalysis');

  loading.style.display = 'block';
  results.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const resumeData = gatherResumeFormData();
    const res = await apiRequest('/ai/analyze-resume', {
      method: 'POST',
      body: JSON.stringify({ resume: resumeData })
    });

    if (res.success && res.data) {
      renderAnalysisResults(res.data);
    }
  } catch (err) {
    showToast('AI Analysis error: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
    if (btn) btn.disabled = false;
  }
}

function renderAnalysisResults(data) {
  const results = document.getElementById('analysisResultContainer');
  results.style.display = 'block';

  // Quality score circular gauge
  const qualityScore = data.score || 85;
  document.getElementById('valQualityScore').innerText = qualityScore;
  const qualityDeg = Math.round((qualityScore / 100) * 360);
  document.getElementById('circleOverallScore').style.setProperty('--score-deg', qualityDeg);

  // ATS score circular gauge
  const atsScore = data.atsScore || 88;
  document.getElementById('valAtsScore').innerText = atsScore;
  const atsDeg = Math.round((atsScore / 100) * 360);
  document.getElementById('circleAtsScore').style.setProperty('--score-deg', atsDeg);

  // Engine source
  if (data.source) {
    document.getElementById('analysisSourceTag').innerText = `Engine: ${data.source}`;
  }

  // Strengths
  const strengthsList = document.getElementById('analysisStrengthsList');
  strengthsList.innerHTML = (data.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

  // Weaknesses
  const weaknessesList = document.getElementById('analysisWeaknessesList');
  weaknessesList.innerHTML = (data.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join('');

  // Missing Skills Tags
  const skillsContainer = document.getElementById('analysisMissingSkillsTags');
  skillsContainer.innerHTML = (data.missingSkills || []).map(s => `
    <span class="skill-tag" style="background:#fef3c7; color:#92400e; border-color:#fde68a;">+ ${escapeHtml(s)}</span>
  `).join('');

  // Suggestions
  const suggestionsList = document.getElementById('analysisSuggestionsList');
  suggestionsList.innerHTML = (data.suggestions || []).map((s, idx) => `
    <div style="background:var(--slate-50); padding:0.85rem; border-radius:var(--radius-sm); border-left:3px solid var(--primary); font-size:0.9rem;">
      <strong>Step ${idx + 1}:</strong> ${escapeHtml(s)}
    </div>
  `).join('');
}

// ==================== JOBS FINDER & MATCHING ====================

async function loadJobs() {
  try {
    let endpoint = '/jobs';
    if (AppState.token) {
      endpoint = '/jobs/recommended';
    }

    const res = await apiRequest(endpoint);
    if (res.success && res.data) {
      AppState.allJobs = res.data.jobs || [];
      filterAndRenderJobs();
    }
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

function filterAndRenderJobs() {
  const query = document.getElementById('jobSearchTitle').value.toLowerCase().trim();
  const location = document.getElementById('jobSearchLocation').value.toLowerCase().trim();
  const exp = document.getElementById('jobFilterExp').value;
  const onlyMatched = document.getElementById('toggleOnlyMatched').checked;

  const filtered = AppState.allJobs.filter(job => {
    const matchTitle = !query || job.title.toLowerCase().includes(query) || job.required_skills.toLowerCase().includes(query);
    const matchLoc = !location || job.location.toLowerCase().includes(location);
    const matchExp = exp === 'all' || job.experience_level.toLowerCase() === exp.toLowerCase();
    const matchPct = !onlyMatched || (job.matchPercentage && job.matchPercentage >= 50);

    return matchTitle && matchLoc && matchExp && matchPct;
  });

  const countEl = document.getElementById('jobsResultCount');
  if (countEl) countEl.innerText = `Showing ${filtered.length} jobs`;

  const container = document.getElementById('jobsListContainer');
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h3>No jobs matched your current criteria</h3>
        <p>Try resetting filters or expanding your search terms.</p>
        <button class="btn btn-secondary btn-sm" onclick="resetJobFilters()" style="margin-top: 1rem;">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(job => {
    const matchPct = job.matchPercentage !== undefined ? job.matchPercentage : 75;
    let matchClass = 'match-high';
    if (matchPct < 50) matchClass = 'match-low';
    else if (matchPct < 75) matchClass = 'match-mid';

    const requiredSkills = (job.required_skills || '').split(',').map(s => s.trim());
    const matchedSkills = job.matchingSkills || [];

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${escapeHtml(job.title)}</div>
            <div class="job-company">${escapeHtml(job.company)}</div>
          </div>
          <span class="match-pill ${matchClass}">🎯 ${matchPct}% Match</span>
        </div>

        <div class="job-meta">
          <span>📍 ${escapeHtml(job.location)}</span>
          <span>💰 ${escapeHtml(job.salary)}</span>
          <span>💼 ${escapeHtml(job.experience_level)} Level</span>
        </div>

        <p style="font-size:0.9rem; margin-bottom:1rem;">${escapeHtml(job.description)}</p>

        <div style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--slate-500); margin-bottom: 0.35rem;">REQUIRED SKILLS:</div>
          <div class="skills-tag-container">
            ${requiredSkills.map(s => {
              const isMatched = matchedSkills.some(m => m.toLowerCase() === s.toLowerCase());
              return `<span class="skill-tag" style="${isMatched ? 'background:#dcfce7; color:#166534; border-color:#bbf7d0; font-weight:600;' : ''}">${escapeHtml(s)} ${isMatched ? '✓' : ''}</span>`;
            }).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="applyJob(${job.id}, 'Saved')">Save Job</button>
          <button class="btn btn-primary btn-sm" onclick="applyJob(${job.id}, 'Applied')">Apply Now</button>
        </div>
      </div>
    `;
  }).join('');
}

function resetJobFilters() {
  document.getElementById('jobSearchTitle').value = '';
  document.getElementById('jobSearchLocation').value = '';
  document.getElementById('jobFilterExp').value = 'all';
  document.getElementById('toggleOnlyMatched').checked = false;
  filterAndRenderJobs();
}

async function applyJob(jobId, status = 'Applied') {
  if (!AppState.token) {
    showToast('Please sign in to apply and track jobs.', 'info');
    openLoginModal();
    return;
  }

  try {
    const res = await apiRequest('/jobs/applications', {
      method: 'POST',
      body: JSON.stringify({ jobId, status })
    });

    if (res.success) {
      showToast(res.data.message || `Application tracked as ${status}!`, 'success');
      loadDashboardStats();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== AI MOCK INTERVIEW ====================

async function startInterviewSession() {
  if (!AppState.token) {
    showToast('Please sign in or use Demo Login to run AI Mock Interviews.', 'info');
    openLoginModal();
    return;
  }

  const jobRole = document.getElementById('interviewJobRole').value.trim() || 'Full Stack Engineer';
  const experienceLevel = document.getElementById('interviewExpLevel').value;
  const interviewType = document.getElementById('interviewType').value;
  const startBtn = document.getElementById('btnStartInterviewSession');

  startBtn.disabled = true;
  startBtn.innerText = 'Curating Questions with AI...';

  try {
    const res = await apiRequest('/interview/start', {
      method: 'POST',
      body: JSON.stringify({ jobRole, experienceLevel, interviewType })
    });

    if (res.success && res.data) {
      AppState.activeInterview = res.data;
      renderActiveInterviewScreen();
    }
  } catch (err) {
    showToast('Failed to start interview: ' + err.message, 'error');
  } finally {
    startBtn.disabled = false;
    startBtn.innerText = '🚀 Start Interview Session';
  }
}

function renderActiveInterviewScreen() {
  document.getElementById('interviewSetupScreen').style.display = 'none';
  document.getElementById('interviewReportScreen').style.display = 'none';
  const activeScreen = document.getElementById('interviewActiveScreen');
  activeScreen.style.display = 'block';

  const data = AppState.activeInterview;
  const qNum = (data.currentQuestionIndex || 0) + 1;
  document.getElementById('interviewProgressBadge').innerText = `Question ${qNum} of ${data.totalQuestions || 5}`;
  document.getElementById('interviewActiveRoleBadge').innerText = `${data.jobRole} (${data.experienceLevel})`;

  document.getElementById('interviewQuestionText').innerText = data.question;
  document.getElementById('interviewAnswerInput').value = '';
  document.getElementById('interviewAnswerWordCount').innerText = '0 words';

  // Hide previous feedback
  document.getElementById('interviewAnswerEvalBox').style.display = 'none';
  document.getElementById('btnSubmitAnswer').disabled = false;

  // Track word counter
  const input = document.getElementById('interviewAnswerInput');
  input.oninput = () => {
    const words = input.value.trim().split(/\s+/).filter(Boolean).length;
    document.getElementById('interviewAnswerWordCount').innerText = `${words} words`;
  };
}

async function submitInterviewAnswer() {
  const answer = document.getElementById('interviewAnswerInput').value.trim();
  if (!answer) {
    showToast('Please type your answer before submitting.', 'info');
    return;
  }

  const submitBtn = document.getElementById('btnSubmitAnswer');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Evaluating with Gemini...';

  try {
    const res = await apiRequest('/interview/answer', {
      method: 'POST',
      body: JSON.stringify({
        interviewId: AppState.activeInterview.interviewId,
        questionIndex: AppState.activeInterview.currentQuestionIndex,
        answer
      })
    });

    if (res.success && res.data) {
      renderAnswerEvaluation(res.data);
    }
  } catch (err) {
    showToast('Evaluation error: ' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Submit Answer';
  }
}

function renderAnswerEvaluation(data) {
  const evalBox = document.getElementById('interviewAnswerEvalBox');
  evalBox.style.display = 'block';

  const ev = data.evaluation;
  document.getElementById('evalScoreBadge').innerText = `Score: ${ev.score || 80}/100`;
  document.getElementById('evalTechVal').innerText = `${ev.technicalCorrectness || 8}/10`;
  document.getElementById('evalCommVal').innerText = `${ev.communication || 8}/10`;
  document.getElementById('evalRelevanceVal').innerText = `${ev.relevance || 9}/10`;
  document.getElementById('evalConfidenceVal').innerText = `${ev.confidence || 8}/10`;

  document.getElementById('evalFeedbackText').innerText = ev.feedback || 'Solid response with clear reasoning.';
  document.getElementById('evalIdealTip').innerText = ev.idealResponseTip || 'Incorporate concrete metrics and comparative trade-offs.';

  const nextBtn = document.getElementById('btnNextQuestion');
  if (data.isCompleted) {
    nextBtn.innerText = 'Generate Final Report 🏆';
    nextBtn.onclick = () => finalizeInterviewReport();
  } else {
    nextBtn.innerText = 'Next Question →';
    nextBtn.onclick = () => {
      AppState.activeInterview.currentQuestionIndex = data.nextQuestionIndex;
      AppState.activeInterview.question = data.nextQuestion;
      renderActiveInterviewScreen();
    };
  }
}

function goToNextQuestion() {
  // Handled dynamically by renderAnswerEvaluation
}

async function finalizeInterviewReport() {
  const nextBtn = document.getElementById('btnNextQuestion');
  nextBtn.disabled = true;
  nextBtn.innerText = 'Generating Final Report...';

  try {
    const res = await apiRequest('/interview/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        interviewId: AppState.activeInterview.interviewId
      })
    });

    if (res.success && res.data) {
      renderFinalInterviewReport(res.data);
      loadDashboardStats();
    }
  } catch (err) {
    showToast('Failed to finalize report: ' + err.message, 'error');
  }
}

function renderFinalInterviewReport(report) {
  document.getElementById('interviewActiveScreen').style.display = 'none';
  const reportScreen = document.getElementById('interviewReportScreen');
  reportScreen.style.display = 'block';

  document.getElementById('reportHeaderDesc').innerText = `Role: ${report.jobRole} (${report.experienceLevel} Level, ${report.interviewType} Interview)`;

  // Overall Score
  const score = report.overallScore || 85;
  document.getElementById('reportOverallVal').innerText = score;
  const deg = Math.round((score / 100) * 360);
  document.getElementById('circleInterviewOverall').style.setProperty('--score-deg', deg);

  // Technical & Communication Bars
  const tech = report.technicalScore || 88;
  const comm = report.communicationScore || 85;

  document.getElementById('reportTechPct').innerText = `${tech}%`;
  document.getElementById('reportTechBar').style.width = `${tech}%`;

  document.getElementById('reportCommPct').innerText = `${comm}%`;
  document.getElementById('reportCommBar').style.width = `${comm}%`;

  // Lists
  document.getElementById('reportStrengthsList').innerHTML = (report.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
  document.getElementById('reportWeaknessesList').innerHTML = (report.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join('');
  document.getElementById('reportSuggestionsList').innerHTML = (report.suggestions || []).map(sg => `<li>${escapeHtml(sg)}</li>`).join('');
}

function resetInterviewSetup() {
  document.getElementById('interviewReportScreen').style.display = 'none';
  document.getElementById('interviewActiveScreen').style.display = 'none';
  document.getElementById('interviewSetupScreen').style.display = 'block';
}

async function showInterviewHistoryModal() {
  if (!AppState.token) {
    showToast('Please sign in to view your interview history.', 'info');
    openLoginModal();
    return;
  }

  openModal('modalInterviewHistory');
  const list = document.getElementById('interviewHistoryModalList');
  list.innerHTML = '<p>Loading sessions...</p>';

  try {
    const res = await apiRequest('/interview/history');
    if (res.success && res.data.history.length > 0) {
      list.innerHTML = res.data.history.map(item => `
        <div style="background:var(--slate-50); border:1px solid var(--slate-200); padding:1rem; border-radius:var(--radius-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${escapeHtml(item.job_role)} (${escapeHtml(item.experience_level)})</strong>
            <span class="badge badge-success">Score: ${item.overall_score || '--'}/100</span>
          </div>
          <div style="font-size:0.825rem; color:var(--slate-500); margin-top:0.25rem;">
            Type: ${escapeHtml(item.interview_type)} • Date: ${new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<p style="color:var(--slate-500);">No past interviews found. Start your first practice session!</p>';
    }
  } catch (err) {
    list.innerHTML = '<p style="color:var(--danger);">Failed to load history.</p>';
  }
}

// ==================== SKILL GAP ANALYZER ====================

function initSkillGapView() {
  runSkillGapAnalysis();
}

async function runSkillGapAnalysis() {
  const targetRole = document.getElementById('targetRoleInput').value.trim() || 'Senior Full Stack Engineer';
  const resume = gatherResumeFormData();
  const currentSkills = resume.skills.map(s => s.skill_name);

  const btn = document.getElementById('btnAnalyzeSkillGap');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Analyzing...';
  }

  try {
    const res = await apiRequest('/ai/skill-gap', {
      method: 'POST',
      body: JSON.stringify({ currentSkills, targetRole })
    });

    if (res.success && res.data) {
      renderSkillGapResults(res.data);
    }
  } catch (err) {
    showToast('Failed to analyze skill gap: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⚡ Analyze Gap';
    }
  }
}

function renderSkillGapResults(data) {
  document.getElementById('skillGapResultsContainer').style.display = 'block';

  // Current Skills Tags
  const currentTags = document.getElementById('currentSkillsTags');
  currentTags.innerHTML = (data.currentSkills || []).map(s => `
    <span class="skill-tag" style="background:#dcfce7; color:#166534; border-color:#bbf7d0;">✓ ${escapeHtml(s)}</span>
  `).join('');

  // Missing Skills List
  const missingList = document.getElementById('missingSkillsPriorityList');
  missingList.innerHTML = (data.missingSkills || []).map(item => {
    let badgeClass = 'badge-primary';
    if (item.priority === 'High') badgeClass = 'badge-danger';
    if (item.priority === 'Medium') badgeClass = 'badge-warning';

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--slate-50); padding:0.65rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--slate-200);">
        <span style="font-weight:600; font-size:0.9rem;">${escapeHtml(item.skill)}</span>
        <span class="badge ${badgeClass}">${escapeHtml(item.priority)} Priority</span>
      </div>
    `;
  }).join('');

  // 4-Week Roadmap
  const roadmapGrid = document.getElementById('roadmapWeeksGrid');
  roadmapGrid.innerHTML = (data.roadmap || []).map(week => `
    <div style="background:var(--slate-50); border:1px solid var(--slate-200); border-radius:var(--radius-sm); padding:1rem; border-top:3px solid var(--primary);">
      <span class="badge badge-primary" style="margin-bottom:0.5rem;">${escapeHtml(week.week)}</span>
      <h4 style="font-size:0.95rem; margin-bottom:0.4rem;">${escapeHtml(week.topic || week.focus || '')}</h4>
      <p style="font-size:0.825rem; color:var(--slate-600);">${escapeHtml(week.details || (week.tasks ? week.tasks.join(', ') : ''))}</p>
    </div>
  `).join('');
}

// ==================== APPLICATION TRACKER ====================

async function loadApplications() {
  if (!AppState.token) {
    showToast('Please sign in to manage your application tracker.', 'info');
    openLoginModal();
    return;
  }

  const tableBody = document.getElementById('applicationsTableBody');
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">Loading applications...</td></tr>';

  try {
    const res = await apiRequest('/jobs/applications');
    if (res.success && res.data.applications) {
      AppState.userApplications = res.data.applications;
      renderApplicationsTable();
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--danger);">${err.message}</td></tr>`;
  }
}

function renderApplicationsTable() {
  const tableBody = document.getElementById('applicationsTableBody');
  const apps = AppState.userApplications;

  if (apps.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--slate-500);">
          No tracked applications yet. Browse the Job Finder to add jobs to your tracker.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = apps.map(app => `
    <tr>
      <td><strong>${escapeHtml(app.title)}</strong></td>
      <td>${escapeHtml(app.company)}</td>
      <td>${escapeHtml(app.location)}</td>
      <td>${escapeHtml(app.salary)}</td>
      <td>
        <select class="form-control" style="padding:0.3rem 0.5rem; font-size:0.825rem; width:auto;" onchange="updateAppStatus(${app.id}, this.value)">
          <option value="Saved" ${app.status === 'Saved' ? 'selected' : ''}>Saved</option>
          <option value="Applied" ${app.status === 'Applied' ? 'selected' : ''}>Applied</option>
          <option value="Interview" ${app.status === 'Interview' ? 'selected' : ''}>Interview</option>
          <option value="Selected" ${app.status === 'Selected' ? 'selected' : ''}>Selected</option>
          <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </td>
      <td style="font-size:0.825rem; color:var(--slate-500);">${new Date(app.applied_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteApplication(${app.id})">Remove</button>
      </td>
    </tr>
  `).join('');
}

async function updateAppStatus(id, newStatus) {
  try {
    const res = await apiRequest(`/jobs/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });

    if (res.success) {
      showToast(`Status updated to ${newStatus}`, 'success');
      loadDashboardStats();
    }
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'error');
  }
}

async function deleteApplication(id) {
  if (!confirm('Remove this application from tracker?')) return;

  try {
    const res = await apiRequest(`/jobs/applications/${id}`, {
      method: 'DELETE'
    });

    if (res.success) {
      showToast('Application removed.', 'info');
      AppState.userApplications = AppState.userApplications.filter(a => a.id !== id);
      renderApplicationsTable();
      loadDashboardStats();
    }
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

// Utility escape functions
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  initAuth();
  updateLivePreview();
});
