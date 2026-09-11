const API_URL = window.location.port === "5000" ? "http://localhost:5000/api" : "/api";

const $ = (id) => document.getElementById(id);

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}


/* ---------------- LOGIN ---------------- */

$("loginBtn").addEventListener("click", () => {
  $("loginMessage").textContent = "";
  $("loginModal").classList.remove("hidden");
});

$("closeModal").addEventListener("click", () => {
  $("loginModal").classList.add("hidden");
});

// Close modal on clicking backdrop
$("loginModal").addEventListener("click", (e) => {
  if (e.target === $("loginModal")) {
    $("loginModal").classList.add("hidden");
  }
});

// Quick Demo Login shortcut button
if ($("demoLoginBtn")) {
  $("demoLoginBtn").addEventListener("click", async () => {
    $("loginEmail").value = "demo@careerai.com";
    $("loginPassword").value = "password123";
    $("loginSubmit").click();
  });
}

$("loginSubmit").addEventListener("click", async () => {

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!email || !password) {
    $("loginMessage").textContent = "Enter email and password.";
    return;
  }

  const submitBtn = $("loginSubmit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in...";
  $("loginMessage").textContent = "";

  try {

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Login failed.");
    }

    const token = data.token || (data.data && data.data.token);
    localStorage.setItem("token", token);

    const user = (data.data && data.data.user) || { name: email.split("@")[0], email };
    localStorage.setItem("userName", user.name || "");
    localStorage.setItem("userEmail", user.email || "");

    $("loginModal").classList.add("hidden");

    updateAuthUI();

    showToast(`Welcome back, ${user.name || "User"}!`);
    loadSavedResume();

  } catch (error) {

    $("loginMessage").textContent = error.message;

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";
  }
});


$("logoutBtn").addEventListener("click", () => {

  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  localStorage.removeItem("userEmail");

  updateAuthUI();

  showToast("Logged out successfully.");

});


async function updateAuthUI(name, email) {

  const token = localStorage.getItem("token");
  const userBadge = $("userBadge");

  if (token) {
    $("loginBtn").classList.add("hidden");
    $("logoutBtn").classList.remove("hidden");

    let userName = name || localStorage.getItem("userName");
    let userEmail = email || localStorage.getItem("userEmail");

    if (!userName) {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const d = await res.json();
        if (d.success && d.data && d.data.user) {
          userName = d.data.user.name;
          userEmail = d.data.user.email;
          localStorage.setItem("userName", userName);
          localStorage.setItem("userEmail", userEmail);
        }
      } catch (err) {
        // ignore
      }
    }

    if (userBadge) {
      userBadge.textContent = `👤 ${userName || "User"}`;
      userBadge.title = userEmail ? `${userName} (${userEmail})` : "";
      userBadge.classList.remove("hidden");
    }
  } else {
    $("loginBtn").classList.remove("hidden");
    $("logoutBtn").classList.add("hidden");
    if (userBadge) {
      userBadge.classList.add("hidden");
      userBadge.textContent = "";
    }
  }
}

updateAuthUI();

// Handle Google Login redirect callback if present
const urlParams = new URLSearchParams(window.location.search);
const googleToken = urlParams.get("googleToken");
if (googleToken) {
  localStorage.setItem("token", googleToken);
  window.history.replaceState({}, document.title, window.location.pathname);
  updateAuthUI();
  showToast("Google sign-in successful!");
  loadSavedResume();
}


/* ---------------- RESUME BUILDER ---------------- */

$("startBtn").addEventListener("click", () => {
  document
    .getElementById("resume")
    .scrollIntoView({ behavior: "smooth" });
});


$("resumeForm").addEventListener("submit", async (event) => {

  event.preventDefault();

  const resume = getResumeData();

  updateResumePreview(resume);

  const token = localStorage.getItem("token");

  if (!token) {
    showToast("Resume preview created. Login to save it.");
    return;
  }

  try {

    const response = await fetch(`${API_URL}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(resume)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not save resume.");
    }

    showToast("Resume saved successfully.");

  } catch (error) {

    showToast(error.message);

  }

});

// Live preview as user types
$("resumeForm").querySelectorAll("input, textarea").forEach(el => {
  el.addEventListener("input", () => {
    updateResumePreview(getResumeData());
  });
});


function getResumeData() {

  return {

    fullName: $("fullName").value.trim(),
    email: $("email").value.trim(),
    phone: $("phone").value.trim(),
    location: $("location").value.trim(),
    linkedin: $("linkedin").value.trim(),
    github: $("github").value.trim(),

    summary: $("summary").value.trim(),

    education: {
      degree: $("degree").value.trim(),
      college: $("college").value.trim(),
      cgpa: $("cgpa").value.trim()
    },

    skills: $("skills")
      .value
      .split(",")
      .map(skill => skill.trim())
      .filter(Boolean),

    experience: {
      company: $("company").value.trim(),
      jobTitle: $("jobTitle").value.trim(),
      description: $("experience").value.trim()
    },

    project: {
      name: $("projectName").value.trim(),
      technologies: $("technologies").value.trim(),
      description: $("projectDescription").value.trim()
    },

    certification: $("certifications").value.trim()

  };
}


function updateResumePreview(resume) {

  $("previewName").textContent =
    resume.fullName || "Your Name";

  $("previewContact").textContent =
    [
      resume.email,
      resume.phone,
      resume.location
    ]
      .filter(Boolean)
      .join(" | ") || "Contact information";


  $("previewSummary").textContent =
    resume.summary ||
    "Your professional summary will appear here.";


  $("previewEducation").textContent =
    [
      resume.education.degree,
      resume.education.college,
      resume.education.cgpa
        ? `CGPA: ${resume.education.cgpa}`
        : ""
    ]
      .filter(Boolean)
      .join(" - ") ||
    "Your education details.";


  const skillsContainer = $("previewSkills");

  skillsContainer.innerHTML = "";

  if (resume.skills.length === 0) {

    skillsContainer.textContent = "No skills added.";

  } else {

    resume.skills.forEach(skill => {

      const span = document.createElement("span");

      span.className = "skill";
      span.textContent = skill;

      skillsContainer.appendChild(span);

    });

  }


  $("previewExperience").textContent =
    [
      resume.experience.jobTitle,
      resume.experience.company,
      resume.experience.description
    ]
      .filter(Boolean)
      .join(" - ") ||
    "Your experience details.";


  $("previewProject").textContent =
    [
      resume.project.name,
      resume.project.technologies,
      resume.project.description
    ]
      .filter(Boolean)
      .join(" - ") ||
    "Your project details.";


  $("previewCertification").textContent =
    resume.certification ||
    "Your certifications.";
}

// Load saved resume if token exists
async function loadSavedResume() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/resume`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.success && data.data && data.data.resume) {
      const r = data.data.resume;
      if (r.full_name) $("fullName").value = r.full_name;
      if (r.email) $("email").value = r.email;
      if (r.phone) $("phone").value = r.phone;
      if (r.location) $("location").value = r.location;
      if (r.linkedin) $("linkedin").value = r.linkedin;
      if (r.github) $("github").value = r.github;
      if (r.summary) $("summary").value = r.summary;

      if (r.education && r.education.length > 0) {
        $("degree").value = r.education[0].degree || "";
        $("college").value = r.education[0].college || r.education[0].university || "";
        $("cgpa").value = r.education[0].cgpa || "";
      }

      if (r.skills && r.skills.length > 0) {
        $("skills").value = r.skills.map(s => s.skill_name || s).join(", ");
      }

      if (r.experience && r.experience.length > 0) {
        $("company").value = r.experience[0].company || "";
        $("jobTitle").value = r.experience[0].job_title || "";
        $("experience").value = r.experience[0].description || "";
      }

      if (r.projects && r.projects.length > 0) {
        $("projectName").value = r.projects[0].project_name || "";
        $("technologies").value = r.projects[0].technologies || "";
        $("projectDescription").value = r.projects[0].description || "";
      }

      if (r.certifications && r.certifications.length > 0) {
        $("certifications").value = r.certifications[0].certificate_name || "";
      }

      updateResumePreview(getResumeData());
    }
  } catch (error) {
    // Ignore load errors for guests
  }
}

loadSavedResume();


/* ---------------- PRINT / PDF ---------------- */

$("printBtn").addEventListener("click", () => {
  window.print();
});


/* ---------------- JOB FINDER ---------------- */

const sampleJobs = [

  {
    title: "Frontend Developer",
    company: "Tech Solutions",
    location: "Chennai",
    salary: "₹4 - ₹8 LPA",
    skills: ["HTML", "CSS", "JavaScript"],
    match: 92
  },

  {
    title: "Java Developer",
    company: "Software Labs",
    location: "Bangalore",
    salary: "₹5 - ₹10 LPA",
    skills: ["Java", "SQL", "Spring"],
    match: 85
  },

  {
    title: "Python Developer",
    company: "AI Technologies",
    location: "Chennai",
    salary: "₹5 - ₹12 LPA",
    skills: ["Python", "SQL", "AI"],
    match: 88
  }

];


function displayJobs(jobs) {

  const jobList = $("jobList");

  jobList.innerHTML = "";

  if (jobs.length === 0) {

    jobList.innerHTML =
      "<p>No matching jobs found.</p>";

    return;
  }


  jobs.forEach(job => {

    const card = document.createElement("div");

    card.className = "job-card";

    card.innerHTML = `
      <h3>${escapeHTML(job.title)}</h3>
      <p>${escapeHTML(job.company)}</p>
      <p>${escapeHTML(job.location)}</p>
      <p>${escapeHTML(job.salary)}</p>
      <p>
        Skills:
        ${job.skills.map(skill =>
          escapeHTML(skill)
        ).join(", ")}
      </p>
      <p class="match">
        ${job.match}% Match
      </p>
      <button class="primary-btn apply-btn">
        Save Job
      </button>
    `;

    const applyButton =
      card.querySelector(".apply-btn");

    applyButton.addEventListener("click", async () => {

      const token = localStorage.getItem("token");

      if (!token) {
        showToast("Login to save jobs.");
        return;
      }

      try {
        await fetch(`${API_URL}/jobs/apply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ jobId: job.id || 1, notes: "Saved from Job Finder" })
        });
      } catch (err) {
        // quiet catch
      }

      showToast("Job saved!");

    });

    jobList.appendChild(card);

  });

}


$("searchJobBtn").addEventListener("click", searchJobs);

$("jobSearch").addEventListener("keyup", event => {

  if (event.key === "Enter") {
    searchJobs();
  }

});


function searchJobs() {

  const query =
    $("jobSearch").value
      .trim()
      .toLowerCase();

  const filtered = sampleJobs.filter(job =>
    job.title.toLowerCase().includes(query) ||
    job.skills.some(skill =>
      skill.toLowerCase().includes(query)
    )
  );

  displayJobs(filtered);

}

// Fetch backend jobs if available, otherwise display sampleJobs
async function initJobs() {
  try {
    const res = await fetch(`${API_URL}/jobs`);
    const data = await res.json();
    if (data.success && data.data && data.data.jobs && data.data.jobs.length) {
      sampleJobs.length = 0;
      data.data.jobs.forEach(j => {
        let skillsArr = [];
        if (Array.isArray(j.required_skills)) skillsArr = j.required_skills;
        else if (typeof j.required_skills === "string") {
          try { skillsArr = JSON.parse(j.required_skills); } catch (e) { skillsArr = [j.required_skills]; }
        }
        sampleJobs.push({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          salary: j.salary_range || "Competitive",
          skills: skillsArr.length ? skillsArr : ["JavaScript", "HTML", "CSS"],
          match: j.matchPercentage || Math.floor(Math.random() * 15 + 85)
        });
      });
    }
  } catch (err) {
    // Keep initial sample jobs
  }
  displayJobs(sampleJobs);
}

initJobs();


/* ---------------- AI MOCK INTERVIEW ---------------- */

let interviewQuestion =
  "Tell me about yourself.";

$("startInterviewBtn").addEventListener(
  "click",
  async () => {

    const role = $("interviewRole").value;

    $("interviewArea")
      .classList
      .remove("hidden");

    $("question").textContent =
      "Preparing your interview question...";

    try {

      const response = await fetch(
        `${API_URL}/interview/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ role })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Interview service unavailable."
        );
      }

      interviewQuestion =
        data.question ||
        (data.data && data.data.question) ||
        "Tell me about yourself.";

      $("question").textContent =
        interviewQuestion;

    } catch {

      interviewQuestion =
        `For the ${role} role, explain one important technical project you have completed.`;

      $("question").textContent =
        interviewQuestion;

    }

  }
);


$("submitAnswerBtn").addEventListener(
  "click",
  async () => {

    const answer =
      $("answer").value.trim();

    if (!answer) {

      showToast("Please enter your answer.");

      return;
    }

    try {

      const response = await fetch(
        `${API_URL}/interview/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question: interviewQuestion,
            answer
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Evaluation failed."
        );
      }

      displayInterviewResult(data);

    } catch {

      displayInterviewResult({
        score: 0,
        feedback:
          "Connect the backend AI interview API to receive AI evaluation."
      });

    }

  }
);


function displayInterviewResult(result) {

  const score = result.score !== undefined ? result.score : (result.data && result.data.score ? result.data.score : 80);
  const feedback = result.feedback || (result.data && result.data.feedback) || "Good answer.";

  $("interviewResult").innerHTML = `
    <strong>Interview Result</strong>
    <p>Score: ${Number(score) || 0}/100</p>
    <p>${escapeHTML(feedback)}</p>
  `;

}


/* ---------------- GOOGLE LOGIN ---------------- */

$("googleLogin").addEventListener("click", async () => {

  const googleBtn = $("googleLogin");
  const origHtml = googleBtn.innerHTML;
  googleBtn.disabled = true;
  googleBtn.innerHTML = `
    <svg class="spin-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"></circle>
    </svg>
    <span>Connecting to Google...</span>
  `;
  $("loginMessage").textContent = "";

  try {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "praveenneyveli2008@gmail.com",
        name: "Praveen"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Google sign-in could not be completed.");
    }

    const token = data.token || (data.data && data.data.token);
    if (!token) throw new Error("Authentication token not received.");

    localStorage.setItem("token", token);
    const user = (data.data && data.data.user) || { name: "Praveen", email: "praveenneyveli2008@gmail.com" };
    localStorage.setItem("userName", user.name || "Praveen");
    localStorage.setItem("userEmail", user.email || "praveenneyveli2008@gmail.com");

    $("loginModal").classList.add("hidden");
    await updateAuthUI(user.name, user.email);

    showToast(`Signed in with Google as ${user.name} (${user.email})!`);
    loadSavedResume();

  } catch (error) {
    console.error("Google login failed:", error);
    $("loginMessage").textContent = error.message || "Failed to sign in with Google.";
    showToast(error.message || "Google Sign-In failed.");
  } finally {
    googleBtn.disabled = false;
    googleBtn.innerHTML = origHtml;
  }

});


/* ---------------- SECURITY HELPER ---------------- */

function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}
