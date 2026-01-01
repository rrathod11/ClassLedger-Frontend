/**
 * ClassLedger by Tarka - Admin Dashboard Module
 * Handles admin features: class-wise reports, absent students, teacher accountability
 */

let currentUser = null;
let allClasses = [];
let selectedClass = null;
let selectedDate = null;

/**
 * Initialize admin dashboard
 */
async function initAdminDashboard() {
  // Check authentication
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = getCurrentUser();
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'principal')) {
    showAccessDenied();
    return;
  }
  
  // Setup UI
  setupHeader();
  await loadSchoolInfo();
  await loadAllClasses();
  
  // Set default date to today
  selectedDate = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('dateSelect');
  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.max = selectedDate; // Can't select future dates
    dateInput.addEventListener('change', async (e) => {
      selectedDate = e.target.value;
      if (selectedClass) {
        // Show loading indicator
        showSelectLoading('dateSelect');
        showLoading('attendanceStats');
        showLoading('absentStudents');
        showLoading('teacherAccountability');
        
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
    classSelect.addEventListener('change', async (e) => {
      selectedClass = e.target.value;
      if (selectedClass) {
        // Show loading indicator
        showSelectLoading('classSelect');
        showLoading('attendanceStats');
        showLoading('absentStudents');
        showLoading('teacherAccountability');
        
        try {
          await loadClassReport();
        } finally {
          hideSelectLoading('classSelect');
        }
      } else {
        // Clear content when no class selected
        document.getElementById('attendanceStats').innerHTML = '';
        document.getElementById('absentStudents').innerHTML = '<p class="text-center">Select a class and date to view absent students</p>';
        document.getElementById('teacherAccountability').innerHTML = '<p class="text-center">Select a class and date to view teacher accountability</p>';
      }
    });
  }
  
  // Setup report date range
  setupReportRange();
  
  // Setup real-time updates
  if (typeof realTimeUpdates !== 'undefined') {
    realTimeUpdates.start('admin-dashboard', async () => {
      if (selectedClass && selectedDate) {
        await loadClassReport();
      }
    }, 30000); // Update every 30 seconds
  }
  
  // Setup keyboard shortcuts
  if (typeof shortcuts !== 'undefined') {
    shortcuts.register('Ctrl+r', async () => {
      if (selectedClass && selectedDate) {
        await loadClassReport();
        Toast.success('Report refreshed');
      }
    });
  }
}

/**
 * Setup header with user info
 */
function setupHeader() {
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  
  if (userNameEl) userNameEl.textContent = currentUser.name;
  if (userRoleEl) userRoleEl.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
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
 * Load all classes for the school
 */
async function loadAllClasses() {
  try {
    console.log('Loading all classes for school...');
    
    // Use new getAllClasses endpoint or get all students without class filter
    const response = await apiGet('getAllClasses', {});
    
    // Fallback: if getAllClasses not available, get all students and extract classes
    if (!response.success || !response.data || response.data.length === 0) {
      console.log('getAllClasses not available, trying getStudents without class...');
      const studentsResponse = await apiGet('getStudents', {});
      if (studentsResponse.success && studentsResponse.data) {
        const classes = [...new Set(studentsResponse.data.map(s => s.class))].sort();
        allClasses = classes;
        populateClassDropdown(classes);
        return;
      }
    }
    
    if (response.success && response.data) {
      allClasses = response.data;
      populateClassDropdown(response.data);
    } else {
      console.error('Failed to load classes:', response);
      showMessage('Failed to load classes. Please refresh the page.', 'error');
    }
  } catch (error) {
    console.error('Load classes error:', error);
    showMessage('Error loading classes. Please refresh the page.', 'error');
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
  if (!selectedClass || !selectedDate) return;
  
  try {
    // Show loading for all sections
    const attendanceStatsEl = document.getElementById('attendanceStats');
    const absentStudentsEl = document.getElementById('absentStudents');
    const teacherAccountabilityEl = document.getElementById('teacherAccountability');
    
    if (attendanceStatsEl) showLoading('attendanceStats', 'Loading attendance statistics...');
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
      renderAttendanceStats(attendanceResponse.data || {});
      renderTeacherAccountability(attendanceResponse.data || {});
    }
  } catch (error) {
    console.error('Load report error:', error);
    showMessage('Error loading report', 'error');
  }
  // Note: hideLoading not needed as render functions replace content
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
          <th>WhatsApp Alert</th>
        </tr>
      </thead>
      <tbody>
        ${absentStudents.map(student => `
          <tr>
            <td>${student.roll}</td>
            <td>${student.name}</td>
            <td>${student.section}</td>
            <td>${student.parentMobile || 'N/A'}</td>
            <td>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" 
                       ${student.whatsappAlertEnabled ? 'checked' : ''}
                       onchange="toggleWhatsAppAlert('${student.studentId}', this.checked)"
                       style="cursor: pointer;">
                <span style="font-size: 0.875rem;">Enable</span>
              </label>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Toggle WhatsApp alert setting for a student
 */
async function toggleWhatsAppAlert(studentId, enabled) {
  try {
    const response = await apiPost('updateWhatsAppAlertSetting', {
      studentId: studentId,
      enabled: enabled
    });
    
    if (response.success) {
      showMessage(`WhatsApp alerts ${enabled ? 'enabled' : 'disabled'} for student`, 'success');
    } else {
      showMessage(response.error || 'Failed to update setting', 'error');
      // Revert checkbox
      const checkbox = document.querySelector(`input[onchange*="${studentId}"]`);
      if (checkbox) checkbox.checked = !enabled;
    }
  } catch (error) {
    console.error('Toggle WhatsApp alert error:', error);
    showToast('Error updating setting', 'error');
    // Revert checkbox
    const checkbox = document.querySelector(`input[onchange*="${studentId}"]`);
    if (checkbox) checkbox.checked = !enabled;
  }
}

/**
 * Render attendance statistics
 */
function renderAttendanceStats(attendanceData) {
  const container = document.getElementById('attendanceStats');
  if (!container) return;
  
  let present = 0;
  let absent = 0;
  let late = 0;
  let total = 0;
  
  // Get total students for this class
  // Note: This requires loading students separately
  // For now, calculate from attendance data
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
 * Setup report date range selector
 */
function setupReportRange() {
  const startDateInput = document.getElementById('reportStartDate');
  const endDateInput = document.getElementById('reportEndDate');
  const generateReportBtn = document.getElementById('generateReportBtn');
  
  if (startDateInput && endDateInput) {
    const today = new Date().toISOString().split('T')[0];
    startDateInput.max = today;
    endDateInput.max = today;
    
    // Set default to current week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    startDateInput.value = weekAgo.toISOString().split('T')[0];
    endDateInput.value = today;
  }
  
  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', generateDateRangeReport);
  }
}

/**
 * Generate report for date range
 */
async function generateDateRangeReport() {
  const startDate = document.getElementById('reportStartDate')?.value;
  const endDate = document.getElementById('reportEndDate')?.value;
  const reportClass = document.getElementById('reportClassSelect')?.value;
  const generateReportBtn = document.getElementById('generateReportBtn');
  
  if (!startDate || !endDate) {
    showMessage('Please select start and end dates', 'error');
    return;
  }
  
  if (!reportClass) {
    showMessage('Please select a class', 'error');
    return;
  }
  
  // Show loading on button
  const originalBtnText = generateReportBtn?.textContent;
  if (generateReportBtn) {
    generateReportBtn.disabled = true;
    generateReportBtn.innerHTML = '<span class="loading-inline"><span class="spinner-small"></span> Generating...</span>';
  }
  
  try {
    showLoading('dateRangeReport', 'Generating report...');
    const response = await apiGet('getReport', {
      class: reportClass,
      startDate: startDate,
      endDate: endDate
    });
    
    if (response.success && response.data) {
      renderDateRangeReport(response.data);
      showToast('Report generated successfully', 'success');
    } else {
      showToast(response.error || 'Failed to generate report', 'error');
    }
  } catch (error) {
    console.error('Generate report error:', error);
    showToast('Error generating report', 'error');
  } finally {
    hideLoading('dateRangeReport');
    if (generateReportBtn) {
      generateReportBtn.disabled = false;
      generateReportBtn.textContent = originalBtnText || 'Generate Report';
    }
  }
}

/**
 * Render date range report
 */
function renderDateRangeReport(report) {
  const container = document.getElementById('dateRangeReport');
  if (!container) return;
  
  // Store report data for export
  window.currentReportData = report;
  
  const { summary, dailyData } = report;
  
  // Generate analytics if available
  let analyticsHtml = '';
  if (typeof renderAnalytics !== 'undefined') {
    const analytics = renderAnalytics(dailyData, []);
    analyticsHtml = `
      <div style="margin-top: 2rem;">
        <h4>Analytics</h4>
        ${analytics.trends.direction ? `
          <p class="${analytics.trends.direction === 'up' ? 'trend-up' : analytics.trends.direction === 'down' ? 'trend-down' : 'trend-neutral'}">
            Trend: ${analytics.trends.direction === 'up' ? '↑' : analytics.trends.direction === 'down' ? '↓' : '→'} 
            ${analytics.trends.change ? '(' + analytics.trends.change + '%)' : ''}
          </p>
        ` : ''}
        ${analytics.anomalies.length > 0 ? `
          <div style="margin-top: 1rem;">
            <strong>Anomalies:</strong>
            ${analytics.anomalies.map(a => `<div class="anomaly-alert">${a.message}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Report Summary</h3>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="exportReportToPDF()">Export PDF</button>
          <button class="btn btn-secondary" onclick="exportReportToExcel()">Export Excel</button>
        </div>
      </div>
      <div class="summary mb-3">
        <div class="summary-card">
          <div class="summary-label">Total Days</div>
          <div class="summary-value">${summary.totalDays}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Present</div>
          <div class="summary-value present">${summary.present}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Absent</div>
          <div class="summary-value absent">${summary.absent}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Late</div>
          <div class="summary-value late">${summary.late}</div>
        </div>
      </div>
      
      <h4 class="mb-2">Daily Breakdown</h4>
      ${analyticsHtml}
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Late</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(dailyData).sort().reverse().map(date => {
            const day = dailyData[date];
            return `
              <tr>
                <td>${date}</td>
                <td>${day.present}</td>
                <td>${day.absent}</td>
                <td>${day.late}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Export to CSV (client-side)
 */
function exportToCSV() {
  // This is a stub - can be enhanced to export actual data
  showMessage('Export feature coming soon', 'info');
}

/**
 * Utility functions
 */
function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
  }
}

function hideLoading(elementId) {
  // Will be replaced by render functions
}

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
  document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
    setupAdminRealtime();
    setupKeyboardShortcuts({
      'ctrl+r': () => manualRefresh(),
      'ctrl+e': () => {
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) exportBtn.click();
      }
    });
  });
} else {
  initAdminDashboard();
  setupAdminRealtime();
  setupKeyboardShortcuts({
    'ctrl+r': () => manualRefresh(),
    'ctrl+e': () => {
      const exportBtn = document.getElementById('exportReportBtn');
      if (exportBtn) exportBtn.click();
    }
  });
}

