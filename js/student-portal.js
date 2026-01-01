/**
 * ClassLedger by Tarka - Student Portal Module
 * Admin-managed student portal features
 * - Download attendance certificate
 * - Request attendance correction
 */

/**
 * Load student portal data
 */
async function loadStudentPortalData() {
  const studentId = document.getElementById('portalStudentSelect')?.value;
  if (!studentId) {
    document.getElementById('studentPortalActions').style.display = 'none';
    return;
  }
  
  document.getElementById('studentPortalActions').style.display = 'block';
}

/**
 * Populate student dropdown for portal
 */
async function populatePortalStudentDropdown() {
  try {
    const user = getCurrentUser();
    const response = await apiGet('getAllStudents', { schoolId: user.schoolId });
    
    const select = document.getElementById('portalStudentSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a student...</option>';
    
    if (response.success && response.data) {
      response.data.forEach(student => {
        const option = document.createElement('option');
        option.value = student.studentId;
        option.textContent = `${student.name} (${student.class} ${student.section} - Roll: ${student.roll})`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Load portal students error:', error);
  }
}

/**
 * Download student attendance certificate
 */
async function downloadStudentCertificate() {
  const studentId = document.getElementById('portalStudentSelect')?.value;
  if (!studentId) {
    showToast('Please select a student first', 'error');
    return;
  }
  
  try {
    showToast('Generating certificate...', 'info');
    
    // Get student data
    const user = getCurrentUser();
    const studentResponse = await apiGet('getStudent', { studentId });
    
    if (!studentResponse.success || !studentResponse.data) {
      showToast('Student not found', 'error');
      return;
    }
    
    const student = studentResponse.data;
    
    // Get attendance summary
    const attendanceResponse = await apiGet('getStudentAttendanceSummary', {
      studentId,
      schoolId: user.schoolId
    });
    
    const summary = attendanceResponse.success ? attendanceResponse.data : {};
    
    // Generate certificate HTML
    const certificateHTML = generateCertificateHTML(student, summary);
    
    // Create temporary element for PDF
    const tempDiv = document.createElement('div');
    tempDiv.id = 'certificateTemp';
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.innerHTML = certificateHTML;
    document.body.appendChild(tempDiv);
    
    // Export to PDF
    if (typeof exportToPDF === 'function') {
      await exportToPDF('certificateTemp', `attendance-certificate-${student.name}-${new Date().getFullYear()}`);
    } else {
      // Fallback: print
      const printWindow = window.open('', '_blank');
      printWindow.document.write(certificateHTML);
      printWindow.document.close();
      printWindow.print();
    }
    
    // Cleanup
    document.body.removeChild(tempDiv);
    
    showToast('Certificate downloaded', 'success');
  } catch (error) {
    console.error('Download certificate error:', error);
    showToast('Error generating certificate', 'error');
  }
}

/**
 * Generate certificate HTML
 */
function generateCertificateHTML(student, summary) {
  const currentYear = new Date().getFullYear();
  const schoolName = document.getElementById('schoolName')?.textContent || 'School';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; }
        .certificate { border: 3px solid #2563eb; padding: 2rem; text-align: center; }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 1rem; color: #2563eb; }
        .title { font-size: 20px; margin: 1rem 0; }
        .student-info { margin: 2rem 0; text-align: left; }
        .info-row { margin: 0.5rem 0; }
        .attendance-summary { margin: 2rem 0; }
        .summary-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 0.5rem; }
        .footer { margin-top: 2rem; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="header">${schoolName}</div>
        <div class="title">ATTENDANCE CERTIFICATE</div>
        <div class="student-info">
          <div class="info-row"><strong>Student Name:</strong> ${student.name || ''}</div>
          <div class="info-row"><strong>Student ID:</strong> ${student.studentId || ''}</div>
          <div class="info-row"><strong>Class:</strong> ${student.class || ''} ${student.section || ''}</div>
          <div class="info-row"><strong>Roll Number:</strong> ${student.roll || ''}</div>
          <div class="info-row"><strong>Academic Year:</strong> ${currentYear}</div>
        </div>
        <div class="attendance-summary">
          <h3>Attendance Summary</h3>
          <table class="summary-table">
            <tr>
              <th>Total Days</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Late</th>
              <th>Attendance %</th>
            </tr>
            <tr>
              <td>${summary.totalDays || 0}</td>
              <td>${summary.present || 0}</td>
              <td>${summary.absent || 0}</td>
              <td>${summary.late || 0}</td>
              <td>${summary.attendancePercentage || 0}%</td>
            </tr>
          </table>
        </div>
        <div class="footer">
          <div>
            <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
          </div>
          <div>
            <div>Authorized Signatory</div>
            <div style="margin-top: 3rem;">_________________</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * View correction requests
 */
async function viewCorrectionRequests() {
  const studentId = document.getElementById('portalStudentSelect')?.value;
  if (!studentId) {
    showToast('Please select a student first', 'error');
    return;
  }
  
  try {
    showLoading('studentPortalActions', 'Loading correction requests...');
    
    const response = await apiGet('getCorrectionRequests', { studentId });
    
    if (response.success && response.data) {
      renderCorrectionRequests(response.data);
    } else {
      document.getElementById('studentPortalActions').innerHTML = '<p>No correction requests found</p>';
    }
  } catch (error) {
    console.error('Load correction requests error:', error);
    showToast('Error loading correction requests', 'error');
  }
}

/**
 * Render correction requests
 */
function renderCorrectionRequests(requests) {
  const container = document.getElementById('studentPortalActions');
  if (!container) return;
  
  if (!requests || requests.length === 0) {
    container.innerHTML = '<p>No correction requests found</p>';
    return;
  }
  
  let html = `
    <h4>Correction Requests</h4>
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Current Status</th>
          <th>Requested Status</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  requests.forEach(request => {
    html += `
      <tr>
        <td>${request.date || ''}</td>
        <td>${request.currentStatus || ''}</td>
        <td>${request.requestedStatus || ''}</td>
        <td>${request.reason || ''}</td>
        <td>
          <span class="badge ${request.status === 'approved' ? 'badge-success' : request.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
            ${request.status || 'pending'}
          </span>
        </td>
        <td>
          ${request.status === 'pending' ? `
            <button class="btn btn-sm btn-success" onclick="approveCorrectionRequest('${request.id}')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="rejectCorrectionRequest('${request.id}')">Reject</button>
          ` : ''}
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
}

/**
 * Approve correction request
 */
async function approveCorrectionRequest(requestId) {
  try {
    const response = await apiPost('approveCorrectionRequest', { requestId });
    
    if (response.success) {
      showToast('Correction request approved', 'success');
      await viewCorrectionRequests();
    } else {
      showToast(response.error || 'Failed to approve request', 'error');
    }
  } catch (error) {
    console.error('Approve request error:', error);
    showToast('Error approving request', 'error');
  }
}

/**
 * Reject correction request
 */
async function rejectCorrectionRequest(requestId) {
  if (!confirm('Are you sure you want to reject this correction request?')) {
    return;
  }
  
  try {
    const response = await apiPost('rejectCorrectionRequest', { requestId });
    
    if (response.success) {
      showToast('Correction request rejected', 'success');
      await viewCorrectionRequests();
    } else {
      showToast(response.error || 'Failed to reject request', 'error');
    }
  } catch (error) {
    console.error('Reject request error:', error);
    showToast('Error rejecting request', 'error');
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (getCurrentUser()?.role === 'admin') {
      populatePortalStudentDropdown();
    }
  });
} else {
  if (getCurrentUser()?.role === 'admin') {
    populatePortalStudentDropdown();
  }
}

