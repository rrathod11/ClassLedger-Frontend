/**
 * ClassLedger by Tarka - Principal Dashboard Module
 * Read-only dashboards for principals
 */

// Principal dashboard uses the same logic as admin but with read-only restrictions
// Import admin functions and override edit capabilities

let currentUser = null;
let selectedClass = null;
let selectedDate = null;

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
    selectedDate = today;
    dateInput.value = today;
    dateInput.max = today;
    dateInput.addEventListener('change', async (e) => {
      selectedDate = e.target.value;
      if (selectedClass) {
        showSelectLoading('dateSelect');
        showLoading('reportContent', 'Loading report...');
        showLoading('absentStudents', 'Loading absent students...');
        showLoading('teacherAccountability', 'Loading teacher accountability...');
        
        try {
          await loadClassReport();
        } catch (error) {
          console.error('Error loading class report:', error);
          showToast('Error loading report. Please try again.', 'error');
        } finally {
          hideSelectLoading('dateSelect');
        }
      }
    });
  }
  
  // Setup class selector
  const classSelect = document.getElementById('classSelect');
  if (classSelect) {
    classSelect.addEventListener('change', async (e) => {
      selectedClass = e.target.value;
      if (selectedClass) {
        // Ensure date is set (default to today if not set)
        if (!selectedDate) {
          selectedDate = new Date().toISOString().split('T')[0];
          const dateInput = document.getElementById('dateSelect');
          if (dateInput) {
            dateInput.value = selectedDate;
          }
        }
        
        // Show loading indicator
        showSelectLoading('classSelect');
        showLoading('reportContent', 'Loading report...');
        showLoading('absentStudents', 'Loading absent students...');
        showLoading('teacherAccountability', 'Loading teacher accountability...');
        
        try {
          await loadClassReport();
        } catch (error) {
          console.error('Error loading class report:', error);
          showToast('Error loading report. Please try again.', 'error');
        } finally {
          hideSelectLoading('classSelect');
        }
      } else {
        // Clear content when no class selected
        const reportContentEl = document.getElementById('reportContent');
        const absentStudentsEl = document.getElementById('absentStudents');
        const teacherAccountabilityEl = document.getElementById('teacherAccountability');
        
        if (reportContentEl) reportContentEl.innerHTML = '<p class="text-center">Select a class and date to view report</p>';
        if (absentStudentsEl) absentStudentsEl.innerHTML = '<p class="text-center">Select a class and date to view absent students</p>';
        if (teacherAccountabilityEl) teacherAccountabilityEl.innerHTML = '<p class="text-center">Select a class and date to view teacher accountability</p>';
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
 * Load class report for selected date
 */
async function loadClassReport() {
  if (!selectedClass) {
    showToast('Please select a class first', 'warning');
    return;
  }
  
  if (!selectedDate) {
    // Auto-set to today if not set
    selectedDate = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('dateSelect');
    if (dateInput) {
      dateInput.value = selectedDate;
    }
  }
  
  try {
    // Show loading for all sections
    const reportContentEl = document.getElementById('reportContent');
    const absentStudentsEl = document.getElementById('absentStudents');
    const teacherAccountabilityEl = document.getElementById('teacherAccountability');
    
    if (reportContentEl) showLoading('reportContent', 'Loading attendance statistics...');
    if (absentStudentsEl) showLoading('absentStudents', 'Loading absent students...');
    if (teacherAccountabilityEl) showLoading('teacherAccountability', 'Loading teacher accountability...');
    
    // Load students first to get WhatsApp settings
    const studentsResponse = await apiGet('getStudents', {
      class: selectedClass
    });
    
    // Load absent students
    const absentResponse = await apiGet('getAbsentStudents', {
      class: selectedClass,
      date: selectedDate
    });
    
    // Load attendance data
    const attendanceResponse = await apiGet('getTodayAttendance', {
      class: selectedClass,
      date: selectedDate
    });
    
    if (absentResponse.success && attendanceResponse.success && studentsResponse.success) {
      // Merge WhatsApp settings into absent students
      const studentsMap = {};
      (studentsResponse.data || []).forEach(s => {
        studentsMap[s.studentId] = s;
      });
      
      const absentWithSettings = (absentResponse.data || []).map(absent => ({
        ...absent,
        whatsappAlertEnabled: studentsMap[absent.studentId]?.whatsappAlertEnabled || false
      }));
      
      renderAbsentStudents(absentWithSettings);
      renderAttendanceStats(attendanceResponse.data || {}, 'reportContent');
      renderTeacherAccountability(attendanceResponse.data || {});
    } else {
      showToast('Error loading report data', 'error');
    }
  } catch (error) {
    console.error('Load report error:', error);
    showToast('Error loading report. Please try again.', 'error');
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
 * Render absent students list
 */
function renderAbsentStudents(absentStudents) {
  const container = document.getElementById('absentStudents');
  if (!container) return;
  
  if (absentStudents.length === 0) {
    container.innerHTML = '<p class="text-center">No absent students</p>';
    return;
  }
  
  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Roll</th>
          <th>Name</th>
          <th>Section</th>
          <th>Parent Mobile</th>
        </tr>
      </thead>
      <tbody>
        ${absentStudents.map(student => `
          <tr>
            <td>${student.roll}</td>
            <td>${student.name}</td>
            <td>${student.section}</td>
            <td>${student.parentMobile || 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Render attendance statistics
 */
function renderAttendanceStats(attendanceData, containerId = 'reportContent') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let present = 0;
  let absent = 0;
  let late = 0;
  let total = 0;
  
  // Get total students for this class
  const studentIds = new Set();
  Object.keys(attendanceData).forEach(studentId => {
    studentIds.add(studentId);
    const att = attendanceData[studentId];
    if (att && att.checkIn) {
      total++;
      const status = att.status;
      if (status === 'P') present++;
      if (status === 'A') absent++;
      if (status === 'L') late++;
    }
  });
  
  container.innerHTML = `
    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Total Students</div>
        <div class="summary-value">${total}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Present</div>
        <div class="summary-value present">${present}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Absent</div>
        <div class="summary-value absent">${absent}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Late</div>
        <div class="summary-value late">${late}</div>
      </div>
    </div>
  `;
}

/**
 * Render teacher accountability (who marked attendance, when)
 */
function renderTeacherAccountability(attendanceData) {
  const container = document.getElementById('teacherAccountability');
  if (!container) return;
  
  const accountability = {};
  
  Object.keys(attendanceData).forEach(studentId => {
    const att = attendanceData[studentId];
    if (att && att.checkIn) {
      const teacherEmail = att.checkIn.teacherEmail;
      const time = att.checkIn.time;
      
      if (!accountability[teacherEmail]) {
        accountability[teacherEmail] = {
          email: teacherEmail,
          count: 0,
          earliestTime: time,
          latestTime: time
        };
      }
      
      accountability[teacherEmail].count++;
      
      if (time < accountability[teacherEmail].earliestTime) {
        accountability[teacherEmail].earliestTime = time;
      }
      if (time > accountability[teacherEmail].latestTime) {
        accountability[teacherEmail].latestTime = time;
      }
    }
  });
  
  const teachers = Object.values(accountability);
  
  if (teachers.length === 0) {
    container.innerHTML = '<p class="text-center">No attendance marked yet</p>';
    return;
  }
  
  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Teacher Email</th>
          <th>Students Marked</th>
          <th>Earliest Time</th>
          <th>Latest Time</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${teachers.map(teacher => {
          const isLate = parseTime(teacher.latestTime) > parseTime('10:30');
          return `
            <tr>
              <td>${teacher.email}</td>
              <td>${teacher.count}</td>
              <td>${teacher.earliestTime}</td>
              <td>${teacher.latestTime}</td>
              <td>
                ${isLate ? '<span style="color: var(--warning-color);">Late Submission</span>' : '<span style="color: var(--success-color);">On Time</span>'}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Parse time string to minutes
 */
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Utility functions
 */
function showLoading(elementId, message = 'Loading...') {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `<div class="loading"><div class="spinner"></div>${message}</div>`;
  }
}

function hideLoading(elementId) {
  // Will be replaced by render functions
}

function showSelectLoading(selectId) {
  const select = document.getElementById(selectId);
  if (select) {
    select.classList.add('select-loading');
    select.disabled = true;
  }
}

function hideSelectLoading(selectId) {
  const select = document.getElementById(selectId);
  if (select) {
    select.classList.remove('select-loading');
    select.disabled = false;
  }
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
  // Use toast if available, otherwise fallback to alert
  if (typeof showToast !== 'undefined') {
    showToast(message, type);
  } else {
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
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrincipalDashboard);
} else {
  initPrincipalDashboard();
}

