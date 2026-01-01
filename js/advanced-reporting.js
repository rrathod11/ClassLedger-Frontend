/**
 * ClassLedger by Tarka - Advanced Reporting Module
 * Charts, PDF export, custom date ranges, graphical reports
 */

// Chart.js will be loaded via CDN
let attendanceChart = null;

/**
 * Initialize Chart.js
 */
function initCharts() {
  // Load Chart.js from CDN if not already loaded
  if (typeof Chart === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => console.log('Chart.js loaded');
    document.head.appendChild(script);
  }
}

/**
 * Render attendance chart
 */
function renderAttendanceChart(containerId, attendanceData) {
  initCharts();
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Wait for Chart.js to load
  if (typeof Chart === 'undefined') {
    setTimeout(() => renderAttendanceChart(containerId, attendanceData), 100);
    return;
  }
  
  // Destroy existing chart
  if (attendanceChart) {
    attendanceChart.destroy();
  }
  
  // Prepare data
  const dates = Object.keys(attendanceData).sort();
  const present = dates.map(date => attendanceData[date].present || 0);
  const absent = dates.map(date => attendanceData[date].absent || 0);
  const late = dates.map(date => attendanceData[date].late || 0);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'attendanceChart';
  container.innerHTML = '';
  container.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  attendanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => formatDate(d)),
      datasets: [
        {
          label: 'Present',
          data: present,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        },
        {
          label: 'Absent',
          data: absent,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4
        },
        {
          label: 'Late',
          data: late,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: 'Attendance Trends'
        },
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

/**
 * Render attendance bar chart
 */
function renderAttendanceBarChart(containerId, attendanceData) {
  initCharts();
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (typeof Chart === 'undefined') {
    setTimeout(() => renderAttendanceBarChart(containerId, attendanceData), 100);
    return;
  }
  
  const dates = Object.keys(attendanceData).sort();
  const present = dates.map(date => attendanceData[date].present || 0);
  const absent = dates.map(date => attendanceData[date].absent || 0);
  const late = dates.map(date => attendanceData[date].late || 0);
  
  const canvas = document.createElement('canvas');
  canvas.id = 'attendanceBarChart';
  container.innerHTML = '';
  container.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(d => formatDate(d)),
      datasets: [
        {
          label: 'Present',
          data: present,
          backgroundColor: '#10b981'
        },
        {
          label: 'Absent',
          data: absent,
          backgroundColor: '#ef4444'
        },
        {
          label: 'Late',
          data: late,
          backgroundColor: '#f59e0b'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Daily Attendance Breakdown'
        }
      },
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Export report to PDF (using html2pdf library)
 */
async function exportToPDF(elementId, filename = 'attendance-report') {
  try {
    // Load html2pdf library
    if (typeof html2pdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      await new Promise((resolve) => {
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }
    
    const element = document.getElementById(elementId);
    if (!element) {
      showToast('Element not found for PDF export', 'error');
      return;
    }
    
    showToast('Generating PDF...', 'info');
    
    const opt = {
      margin: 1,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    await html2pdf().set(opt).from(element).save();
    
    showToast('PDF exported successfully', 'success');
  } catch (error) {
    console.error('PDF export error:', error);
    showToast('Error exporting PDF', 'error');
  }
}

/**
 * Generate comprehensive report
 */
function generateComprehensiveReport(reportData, options = {}) {
  const { includeCharts = true, includeAnalytics = true, includeDetails = true } = options;
  
  let html = `
    <div class="comprehensive-report">
      <div class="report-header" style="margin-bottom: 2rem;">
        <h2>Attendance Report</h2>
        <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
        ${reportData.className ? `<p>Class: ${reportData.className}</p>` : ''}
        ${reportData.dateRange ? `<p>Date Range: ${reportData.dateRange}</p>` : ''}
      </div>
  `;
  
  if (includeAnalytics && reportData.analytics) {
    html += `<div class="report-section">${reportData.analytics.html}</div>`;
  }
  
  if (includeCharts && reportData.chartData) {
    html += `
      <div class="report-section">
        <h3>Attendance Chart</h3>
        <div id="reportChartContainer" style="height: 400px; margin-top: 1rem;"></div>
      </div>
    `;
  }
  
  if (includeDetails && reportData.details) {
    html += `
      <div class="report-section">
        <h3>Detailed Report</h3>
        ${reportData.details}
      </div>
    `;
  }
  
  html += `</div>`;
  
  return html;
}

