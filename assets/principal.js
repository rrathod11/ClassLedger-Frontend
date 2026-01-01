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
 * Utility functions - Defined early to ensure availability
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
 * Render overview statistics (Enhanced for Principal)
 */
function renderOverviewStats(stats) {
  const container = document.getElementById('overviewStats');
  if (!container) return;
  
  const attendanceRate = stats.totalStudents > 0 
    ? ((stats.present / stats.totalStudents) * 100).toFixed(1)
    : 0;
  
  const absentRate = stats.totalStudents > 0
    ? ((stats.absent / stats.totalStudents) * 100).toFixed(1)
    : 0;
  
  // Determine status color
  let statusColor = 'var(--success-color)';
  let statusText = 'Excellent';
  if (attendanceRate < 80) {
    statusColor = 'var(--danger-color)';
    statusText = 'Needs Attention';
  } else if (attendanceRate < 90) {
    statusColor = 'var(--warning-color)';
    statusText = 'Good';
  }
  
  container.innerHTML = `
    <div class="summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div class="summary-card" style="grid-column: span 2; background: linear-gradient(135deg, ${statusColor}15 0%, ${statusColor}05 100%); border: 2px solid ${statusColor}40;">
        <div class="summary-label" style="font-size: 0.875rem; color: var(--text-secondary);">Overall Attendance Rate</div>
        <div class="summary-value" style="font-size: 3rem; font-weight: 700; color: ${statusColor}; margin: 0.5rem 0;">
          ${attendanceRate}%
        </div>
        <div style="font-size: 0.875rem; color: ${statusColor}; font-weight: 600;">
          ${statusText}
        </div>
      </div>
      
      <div class="summary-card">
        <div class="summary-label">Total Students</div>
        <div class="summary-value" style="font-size: 2rem;">${stats.totalStudents}</div>
      </div>
      
      <div class="summary-card" style="background: var(--success-color)15; border-left: 4px solid var(--success-color);">
        <div class="summary-label">Present Today</div>
        <div class="summary-value present" style="font-size: 2rem;">${stats.present}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
          ${stats.totalStudents > 0 ? ((stats.present / stats.totalStudents) * 100).toFixed(1) : 0}% of total
        </div>
      </div>
      
      <div class="summary-card" style="background: var(--danger-color)15; border-left: 4px solid var(--danger-color);">
        <div class="summary-label">Absent Today</div>
        <div class="summary-value absent" style="font-size: 2rem;">${stats.absent}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
          ${absentRate}% of total
        </div>
      </div>
      
      <div class="summary-card" style="background: var(--warning-color)15; border-left: 4px solid var(--warning-color);">
        <div class="summary-label">Late Today</div>
        <div class="summary-value late" style="font-size: 2rem;">${stats.late}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
          ${stats.totalStudents > 0 ? ((stats.late / stats.totalStudents) * 100).toFixed(1) : 0}% of total
        </div>
      </div>
    </div>
    
    <div style="margin-top: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; border-left: 4px solid var(--primary-color);">
      <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
        <strong>📊 Principal Dashboard:</strong> This is a read-only overview. For detailed management, contact your Admin.
      </p>
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
  // Setup date inputs
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
  
  // Setup button click handler - use admin function if available, otherwise create our own
  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', async () => {
      if (typeof generateDateRangeReport !== 'undefined' && window.generateDateRangeReport) {
        // Use admin's function if available
        await window.generateDateRangeReport();
      } else {
        // Fallback: create our own handler
        const startDate = document.getElementById('reportStartDate')?.value;
        const endDate = document.getElementById('reportEndDate')?.value;
        const reportClass = document.getElementById('reportClassSelect')?.value;
        
        if (!startDate || !endDate) {
          showToast('Please select start and end dates', 'error');
          return;
        }
        
        if (!reportClass) {
          showToast('Please select a class', 'error');
          return;
        }
        
        // Show loading
        generateReportBtn.disabled = true;
        const originalBtnText = generateReportBtn.textContent;
        generateReportBtn.innerHTML = '<span class="loading-inline"><span class="spinner-small"></span> Generating...</span>';
        
        try {
          showLoading('dateRangeReport', 'Generating report...');
          const response = await apiGet('getReport', {
            class: reportClass,
            startDate: startDate,
            endDate: endDate
          });
          
          if (response.success && response.data) {
            // Use admin's renderDateRangeReport if available, otherwise render basic
            if (typeof renderDateRangeReport !== 'undefined' && window.renderDateRangeReport) {
              try {
                window.renderDateRangeReport(response.data);
                showToast('Report generated successfully', 'success');
              } catch (error) {
                console.error('Error rendering report with admin function:', error);
                // Fallback to basic render
                renderBasicDateRangeReport(response.data);
                showToast('Report generated successfully', 'success');
              }
            } else {
              renderBasicDateRangeReport(response.data);
              showToast('Report generated successfully', 'success');
            }
          } else {
            showToast(response.error || 'Failed to generate report', 'error');
          }
        } catch (error) {
          console.error('Generate report error:', error);
          showToast('Error generating report: ' + error.message, 'error');
        } finally {
          hideLoading('dateRangeReport');
          generateReportBtn.disabled = false;
          generateReportBtn.textContent = originalBtnText;
        }
      }
    });
  }
}

/**
 * Render basic date range report (fallback if admin function not available)
 */
function renderBasicDateRangeReport(report) {
  const container = document.getElementById('dateRangeReport');
  if (!container) return;
  
  if (!report || !report.summary || !report.dailyData) {
    container.innerHTML = '<p class="text-center">Invalid report data</p>';
    return;
  }
  
  const { summary, dailyData } = report;
  
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Report Summary</h3>
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
 * Render absent students list (Read-only for Principal)
 */
function renderAbsentStudents(absentStudents) {
  const container = document.getElementById('absentStudents');
  if (!container) return;
  
  if (absentStudents.length === 0) {
    container.innerHTML = '<p class="text-center">✅ No absent students today</p>';
    return;
  }
  
  container.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <span class="badge" style="background: var(--danger-color); color: white; padding: 0.5rem 1rem; border-radius: 0.25rem;">
        ${absentStudents.length} Absent Student${absentStudents.length > 1 ? 's' : ''}
      </span>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Roll</th>
          <th>Name</th>
          <th>Section</th>
          <th>Parent Mobile</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${absentStudents.map(student => `
          <tr>
            <td>${student.roll}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.section}</td>
            <td>${student.parentMobile || 'N/A'}</td>
            <td>
              <span style="color: var(--danger-color); font-weight: 600;">Absent</span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; border-left: 4px solid var(--primary-color);">
      <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
        <strong>Note:</strong> This is a read-only view. Contact Admin to manage WhatsApp alerts.
      </p>
    </div>
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

// Utility functions moved to top of file for early availability

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
