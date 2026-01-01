/**
 * ClassLedger by Tarka - Teacher Dashboard Module
 * Handles attendance marking for teachers
 */

let currentUser = null;
let students = [];
let todayAttendance = {};
let selectedClass = null;

/**
 * Initialize teacher dashboard
 */
async function initTeacherDashboard() {
  // Check authentication
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'teacher') {
    showAccessDenied();
    return;
  }
  
  // Setup UI
  setupHeader();
  await loadSchoolInfo();
  await loadClasses();
  
  // Auto-select first class if available
  if (currentUser.classAssigned && currentUser.classAssigned.length > 0) {
    selectedClass = currentUser.classAssigned[0];
    await loadStudents();
    await loadTodayAttendance();
  } else {
    showMessage('No classes assigned. Please contact administrator.', 'error');
  }
}

/**
 * Setup header with user info
 */
function setupHeader() {
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  
  if (userNameEl) userNameEl.textContent = currentUser.name;
  if (userRoleEl) userRoleEl.textContent = 'Teacher';
}

/**
 * Load school information
 */
async function loadSchoolInfo() {
  try {
    console.log('Loading school info...');
    const response = await apiGet('getSchool');
    console.log('School info response:', response);
    if (response.success && response.data) {
      const schoolNameEl = document.getElementById('schoolName');
      if (schoolNameEl) {
        schoolNameEl.textContent = response.data.schoolName;
      }
    } else {
      console.error('Failed to load school info:', response);
      showMessage('Failed to load school information', 'error');
    }
  } catch (error) {
    console.error('Load school error:', error);
    showMessage('Error loading school information: ' + error.message, 'error');
  }
}

/**
 * Load available classes for teacher
 */
function loadClasses() {
  if (!currentUser.classAssigned || currentUser.classAssigned.length === 0) {
    return;
  }
  
  const classSelect = document.getElementById('classSelect');
  if (classSelect) {
    classSelect.innerHTML = '<option value="">Select Class</option>';
    currentUser.classAssigned.forEach(className => {
      const option = document.createElement('option');
      option.value = className;
      option.textContent = className;
      classSelect.appendChild(option);
    });
    
    classSelect.addEventListener('change', async (e) => {
      selectedClass = e.target.value;
      if (selectedClass) {
        // Show loading indicators
        showSelectLoading('classSelect');
        showLoading('studentsList', 'Loading students...');
        showLoading('summaryContainer', 'Loading attendance...');
        
        try {
          await loadStudents();
          await loadTodayAttendance();
        } finally {
          hideSelectLoading('classSelect');
        }
      } else {
        // Clear when no class selected
        document.getElementById('studentsList').innerHTML = '<p class="text-center">Please select a class</p>';
        document.getElementById('summaryContainer').style.display = 'none';
      }
    });
  }
}

/**
 * Load students for selected class
 */
async function loadStudents() {
  if (!selectedClass) return;
  
  try {
    showLoading('studentsList');
    console.log('Loading students for class:', selectedClass);
    const response = await apiGet('getStudents', {
      class: selectedClass
    });
    console.log('Students response:', response);
    
    if (response.success) {
      students = response.data || [];
      console.log('Loaded students:', students.length);
      renderStudents();
    } else {
      console.error('Failed to load students:', response);
      showMessage('Failed to load students: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Load students error:', error);
    showMessage('Error loading students: ' + error.message, 'error');
  } finally {
    hideLoading('studentsList');
  }
}

/**
 * Load today's attendance
 */
async function loadTodayAttendance() {
  if (!selectedClass) return;
  
  try {
    const response = await apiGet('getTodayAttendance', {
      class: selectedClass
    });
    
    if (response.success) {
      todayAttendance = response.data || {};
      updateSummary();
      updateStudentButtons();
    }
  } catch (error) {
    console.error('Load attendance error:', error);
  }
}

/**
 * Render students list
 */
function renderStudents() {
  const container = document.getElementById('studentsList');
  if (!container) return;
  
  if (students.length === 0) {
    container.innerHTML = '<p class="text-center">No students found</p>';
    return;
  }
  
  container.innerHTML = students.map(student => `
    <div class="student-item" data-student-id="${student.studentId}">
      <div class="student-info">
        <div class="student-name">${student.name}</div>
        <div class="student-details">
          Roll: ${student.roll} | Section: ${student.section}
        </div>
      </div>
      <div class="attendance-buttons" data-student-id="${student.studentId}">
        <button class="btn-attendance btn-present" 
                onclick="markAttendance('${student.studentId}', 'P')"
                data-status="P">
          Present
        </button>
        <button class="btn-attendance btn-absent" 
                onclick="markAttendance('${student.studentId}', 'A')"
                data-status="A">
          Absent
        </button>
        <button class="btn-attendance btn-late" 
                onclick="markAttendance('${student.studentId}', 'L')"
                data-status="L">
          Late
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Update attendance buttons based on current status
 */
function updateStudentButtons() {
  students.forEach(student => {
    const attendance = todayAttendance[student.studentId];
    const buttons = document.querySelectorAll(`[data-student-id="${student.studentId}"] .btn-attendance`);
    
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (attendance && attendance.checkIn) {
        const currentStatus = attendance.status;
        if (btn.dataset.status === currentStatus) {
          btn.classList.add('active');
        }
        // Disable buttons if already marked (can edit within 15 min)
        if (attendance.checkIn && !canEdit(attendance.time)) {
          btn.disabled = true;
        }
      }
    });
  });
}

/**
 * Check if attendance can be edited (within 15 minutes)
 */
function canEdit(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const logTime = new Date();
  logTime.setHours(hours, minutes, 0, 0);
  
  const now = new Date();
  const diffMinutes = (now - logTime) / (1000 * 60);
  
  return diffMinutes <= 15;
}

/**
 * Mark attendance for a student
 */
async function markAttendance(studentId, status) {
  if (!selectedClass) {
    showToast('Please select a class', 'error');
    return;
  }
  
  const student = students.find(s => s.studentId === studentId);
  if (!student) return;
  
  // Check if already marked
  const existing = todayAttendance[studentId];
  if (existing && existing.checkIn) {
    if (!canEdit(existing.time)) {
      showToast('Attendance already marked. Edit window expired (15 minutes)', 'error');
      return;
    }
    
    // Show edit confirmation using new confirm dialog
    const confirmed = typeof confirmDialog !== 'undefined' 
      ? await confirmDialog('Attendance already exists. Do you want to update it?', 'Update Attendance')
      : confirm('Attendance already exists. Do you want to update it?');
    
    if (!confirmed) {
      return;
    }
    
    // Edit existing
    await editAttendance(existing.logId, status);
    return;
  }
  
  // Show remark modal for late students
  let remark = '';
  if (status === 'L') {
    remark = prompt('Enter reason for late arrival (optional):') || '';
  }
  
  try {
    showLoading('studentsList');
    const response = await apiPost('markAttendance', {
      studentId: studentId,
      status: status,
      type: 'CHECK_IN',
      remark: remark
    });
    
    if (response.success) {
      showToast('Attendance marked successfully', 'success');
      await loadTodayAttendance();
      // Auto-save after marking
      if (autoSave) {
        const attendanceData = getAttendanceDataForAutoSave();
        autoSave.save(selectedClass, attendanceData);
      }
    } else {
      showToast(response.error || 'Failed to mark attendance', 'error');
    }
  } catch (error) {
    console.error('Mark attendance error:', error);
    showToast('Error marking attendance', 'error');
  } finally {
    hideLoading('studentsList');
  }
}

/**
 * Edit existing attendance
 */
async function editAttendance(logId, newStatus) {
  let remark = '';
  if (newStatus === 'L') {
    remark = prompt('Enter reason for late arrival (optional):') || '';
  }
  
  try {
    const response = await apiPost('editAttendance', {
      logId: logId,
      status: newStatus,
      remark: remark
    });
    
    if (response.success) {
      showToast('Attendance updated successfully', 'success');
      await loadTodayAttendance();
    } else {
      showToast(response.error || 'Failed to update attendance', 'error');
    }
  } catch (error) {
    console.error('Edit attendance error:', error);
    showToast('Error updating attendance', 'error');
  }
}

/**
 * Mark check-out for a student
 */
async function markCheckOut(studentId) {
  try {
    const response = await apiPost('markAttendance', {
      studentId: studentId,
      status: '', // No status for check-out
      type: 'CHECK_OUT',
      remark: ''
    });
    
    if (response.success) {
      showMessage('Check-out recorded successfully', 'success');
      await loadTodayAttendance();
    } else {
      showMessage(response.error || 'Failed to record check-out', 'error');
    }
  } catch (error) {
    console.error('Check-out error:', error);
    showMessage('Error recording check-out', 'error');
  }
}

/**
 * Update summary statistics
 */
function updateSummary() {
  let present = 0;
  let absent = 0;
  let late = 0;
  let total = students.length;
  
  students.forEach(student => {
    const attendance = todayAttendance[student.studentId];
    if (attendance && attendance.checkIn) {
      const status = attendance.status;
      if (status === 'P') present++;
      if (status === 'A') absent++;
      if (status === 'L') late++;
    } else {
      absent++; // Not marked = absent
    }
  });
  
  const presentEl = document.getElementById('summaryPresent');
  const absentEl = document.getElementById('summaryAbsent');
  const lateEl = document.getElementById('summaryLate');
  const totalEl = document.getElementById('summaryTotal');
  
  if (presentEl) presentEl.textContent = present;
  if (absentEl) absentEl.textContent = absent;
  if (lateEl) lateEl.textContent = late;
  if (totalEl) totalEl.textContent = total;
}

/**
 * Submit attendance (confirmation)
 */
function submitAttendance() {
  const marked = Object.keys(todayAttendance).length;
  const total = students.length;
  
  if (marked === 0) {
    showToast('Please mark attendance for at least one student', 'error');
    return;
  }
  
  confirmDialog(`Submit attendance for ${marked} out of ${total} students?`, 'Confirm Submission').then(confirmed => {
    if (confirmed) {
      showToast('Attendance submitted successfully', 'success');
      // Attendance is already saved, just show confirmation
    }
  });
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

/**
 * Show loading indicator on select/dropdown
 */
function showSelectLoading(selectId) {
  const select = document.getElementById(selectId);
  if (select) {
    select.classList.add('select-loading');
    select.disabled = true;
  }
}

/**
 * Hide loading indicator on select/dropdown
 */
function hideSelectLoading(selectId) {
  const select = document.getElementById(selectId);
  if (select) {
    select.classList.remove('select-loading');
    select.disabled = false;
  }
}

function showMessage(message, type = 'info') {
  // Use Toast if available, otherwise fallback to alert
  if (typeof Toast !== 'undefined') {
    Toast[type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'](message);
  } else {
    // Fallback to old alert system
    const alert = document.createElement('div');
    alert.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
    alert.textContent = message;
    
    const container = document.querySelector('.container');
    if (container) {
      container.insertBefore(alert, container.firstChild);
      setTimeout(() => alert.remove(), 5000);
    }
  }
}

/**
 * Get attendance data for auto-save
 */
function getAttendanceDataForAutoSave() {
  return todayAttendance || {};
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTeacherDashboard();
    
    // Setup real-time updates cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (typeof realTimeUpdates !== 'undefined') {
        realTimeUpdates.stopAll();
      }
      if (typeof autoSave !== 'undefined') {
        autoSave.stopAutoSave();
      }
    });
  });
} else {
  initTeacherDashboard();
  
  // Setup real-time updates cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (typeof realTimeUpdates !== 'undefined') {
      realTimeUpdates.stopAll();
    }
    if (typeof autoSave !== 'undefined') {
      autoSave.stopAutoSave();
    }
  });
}

