/**
 * ClassLedger by Tarka - Principal Dashboard Module
 * Read-only dashboards for principals
 */

// Principal dashboard uses the same logic as admin but with read-only restrictions
// Import admin functions and override edit capabilities

let currentUser = null;

/**
 * Initialize principal dashboard
 */
async function initPrincipalDashboard() {
  // Check authentication
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'principal') {
    showAccessDenied();
    return;
  }
  
  // Setup UI
  setupHeader();
  await loadSchoolInfo();
  
  // Load overview statistics
  await loadOverviewStats();
  
  // Setup filters
  setupFilters();
  
  // Disable all edit buttons (read-only mode)
  disableEditButtons();
}

/**
 * Setup header with user info
 */
function setupHeader() {
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  
  if (userNameEl) userNameEl.textContent = currentUser.name;
  if (userRoleEl) userRoleEl.textContent = 'Principal';
}

/**
 * Load school information
 */
async function loadSchoolInfo() {
  try {
    const response = await apiGet('getSchool');
    if (response.success && response.data) {
      const schoolNameEl = document.getElementById('schoolName');
      if (schoolNameEl) {
        schoolNameEl.textContent = response.data.schoolName;
      }
    }
  } catch (error) {
    console.error('Load school error:', error);
  }
}

/**
 * Load overview statistics
 */
async function loadOverviewStats() {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get all classes
    const studentsResponse = await apiGet('getStudents', {});
    if (studentsResponse.success) {
      const classes = [...new Set(studentsResponse.data.map(s => s.class))];
      
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLate = 0;
      let totalStudents = 0;
      
      // Aggregate across all classes
      for (const className of classes) {
        const attendanceResponse = await apiGet('getTodayAttendance', {
          class: className,
          date: today
        });
        
        if (attendanceResponse.success) {
          const attendance = attendanceResponse.data || {};
          const classStudents = studentsResponse.data.filter(s => s.class === className);
          totalStudents += classStudents.length;
          
          Object.keys(attendance).forEach(studentId => {
            const att = attendance[studentId];
            if (att && att.checkIn) {
              const status = att.status;
              if (status === 'P') totalPresent++;
              if (status === 'A') totalAbsent++;
              if (status === 'L') totalLate++;
            }
          });
        }
      }
      
      renderOverviewStats({
        totalStudents,
        present: totalPresent,
        absent: totalAbsent,
        late: totalLate
      });
    }
  } catch (error) {
    console.error('Load overview error:', error);
  }
}

/**
 * Render overview statistics
 */
function renderOverviewStats(stats) {
  const container = document.getElementById('overviewStats');
  if (!container) return;
  
  const attendanceRate = stats.totalStudents > 0 
    ? ((stats.present / stats.totalStudents) * 100).toFixed(1)
    : 0;
  
  container.innerHTML = `
    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Total Students</div>
        <div class="summary-value">${stats.totalStudents}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Present Today</div>
        <div class="summary-value present">${stats.present}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Absent Today</div>
        <div class="summary-value absent">${stats.absent}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Late Today</div>
        <div class="summary-value late">${stats.late}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Attendance Rate</div>
        <div class="summary-value">${attendanceRate}%</div>
      </div>
    </div>
  `;
}

/**
 * Setup filters for reports
 */
async function setupFilters() {
  // Load all classes for dropdown
  await loadAllClasses();
  
  // Setup date selector
  const dateInput = document.getElementById('dateSelect');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;
    dateInput.addEventListener('change', async () => {
      if (document.getElementById('classSelect')?.value) {
        showSelectLoading('dateSelect');
        showLoading('reportContent', 'Loading report...');
        showLoading('absentStudents', 'Loading absent students...');
        showLoading('teacherAccountability', 'Loading teacher accountability...');
        
        try {
          await loadClassReport();
        } finally {
          hideSelectLoading('dateSelect');
        }
      }
    });
  }
  
  // Setup class selector
  const classSelect = document.getElementById('classSelect');
  if (classSelect) {
    classSelect.addEventListener('change', async () => {
      if (classSelect.value) {
        showSelectLoading('classSelect');
        showLoading('reportContent', 'Loading report...');
        showLoading('absentStudents', 'Loading absent students...');
        showLoading('teacherAccountability', 'Loading teacher accountability...');
        
        try {
          await loadClassReport();
        } finally {
          hideSelectLoading('classSelect');
        }
      } else {
        document.getElementById('reportContent').innerHTML = '<p class="text-center">Select a class and date to view report</p>';
        document.getElementById('absentStudents').innerHTML = '<p class="text-center">Select a class and date to view absent students</p>';
        document.getElementById('teacherAccountability').innerHTML = '<p class="text-center">Select a class and date to view teacher accountability</p>';
      }
    });
  }
  
  // Setup report date range
  setupReportRange();
}

/**
 * Load all classes for the school
 */
async function loadAllClasses() {
  try {
    console.log('Loading all classes for school...');
    
    // Use getAllClasses endpoint
    const response = await apiGet('getAllClasses', {});
    
    // Fallback: if getAllClasses not available, get all students and extract classes
    if (!response.success || !response.data || response.data.length === 0) {
      console.log('getAllClasses not available, trying getStudents without class...');
      const studentsResponse = await apiGet('getStudents', {});
      if (studentsResponse.success && studentsResponse.data) {
        const classes = [...new Set(studentsResponse.data.map(s => s.class))].sort();
        populateClassDropdown(classes);
        return;
      }
    }
    
    if (response.success && response.data) {
      populateClassDropdown(response.data);
    } else {
      console.error('Failed to load classes:', response);
    }
  } catch (error) {
    console.error('Load classes error:', error);
  }
}

/**
 * Populate class dropdown with classes
 */
function populateClassDropdown(classes) {
  const classSelect = document.getElementById('classSelect');
  const reportClassSelect = document.getElementById('reportClassSelect');
  
  if (classSelect) {
    classSelect.innerHTML = '<option value="">Select Class</option>';
    classes.forEach(className => {
      const option = document.createElement('option');
      option.value = className;
      option.textContent = className;
      classSelect.appendChild(option);
    });
    console.log(`✅ Populated ${classes.length} classes in dropdown`);
  }
  
  // Also populate report class selector
  if (reportClassSelect) {
    reportClassSelect.innerHTML = '<option value="">Select Class</option>';
    classes.forEach(className => {
      const option = document.createElement('option');
      option.value = className;
      option.textContent = className;
      reportClassSelect.appendChild(option);
    });
  }
}

/**
 * Load class report for selected date (reuse admin function)
 */
async function loadClassReport() {
  // Reuse admin dashboard function
  if (typeof loadClassReport === 'function' && window.loadClassReport) {
    await window.loadClassReport();
  } else {
    // If admin.js is loaded, use it
    const classSelect = document.getElementById('classSelect');
    const dateSelect = document.getElementById('dateSelect');
    if (classSelect && dateSelect && classSelect.value && dateSelect.value) {
      // Trigger admin's loadClassReport
      if (window.loadClassReport) {
        await window.loadClassReport();
      }
    }
  }
}

/**
 * Setup report date range (reuse admin function)
 */
function setupReportRange() {
  // Reuse admin dashboard function if available
  if (typeof setupReportRange === 'function' && window.setupReportRange) {
    window.setupReportRange();
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrincipalDashboard);
} else {
  initPrincipalDashboard();
}

/**
 * Disable all edit buttons (read-only mode)
 */
function disableEditButtons() {
  const editButtons = document.querySelectorAll('button[data-action="edit"]');
  editButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });
  
  // Show read-only badge
  const header = document.querySelector('header');
  if (header) {
    const badge = document.createElement('span');
    badge.textContent = 'Read-Only Mode';
    badge.style.cssText = 'background: var(--warning-color); color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem;';
    header.querySelector('.user-info')?.appendChild(badge);
  }
}

/**
 * Load class-wise report
 */
async function loadClassReport(className, date) {
  try {
    const response = await apiGet('getTodayAttendance', {
      class: className,
      date: date || new Date().toISOString().split('T')[0]
    });
    
    if (response.success) {
      return response.data;
    }
  } catch (error) {
    console.error('Load class report error:', error);
  }
  return {};
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  alert.textContent = message;
  
  const container = document.querySelector('.container');
  if (container) {
    container.insertBefore(alert, container.firstChild);
    
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrincipalDashboard);
} else {
  initPrincipalDashboard();
}

