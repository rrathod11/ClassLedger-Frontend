/**
 * ClassLedger by Tarka - Real-time Updates Module
 * Auto-refresh and polling for live data updates
 */

let refreshIntervals = {};
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * Start auto-refresh for a specific data type
 */
function startAutoRefresh(dataType, refreshFunction, interval = DEFAULT_REFRESH_INTERVAL) {
  // Stop existing refresh if any
  stopAutoRefresh(dataType);
  
  // Start new refresh
  refreshIntervals[dataType] = setInterval(() => {
    console.log(`Auto-refreshing ${dataType}...`);
    refreshFunction();
  }, interval);
  
  console.log(`Auto-refresh started for ${dataType} (${interval}ms)`);
}

/**
 * Stop auto-refresh for a specific data type
 */
function stopAutoRefresh(dataType) {
  if (refreshIntervals[dataType]) {
    clearInterval(refreshIntervals[dataType]);
    delete refreshIntervals[dataType];
    console.log(`Auto-refresh stopped for ${dataType}`);
  }
}

/**
 * Stop all auto-refresh
 */
function stopAllAutoRefresh() {
  Object.keys(refreshIntervals).forEach(dataType => {
    stopAutoRefresh(dataType);
  });
}

/**
 * Setup real-time updates for teacher dashboard
 */
function setupTeacherRealtime() {
  const user = getCurrentUser();
  if (!user || user.role !== 'teacher') return;
  
  // Auto-refresh attendance data every 30 seconds
  if (selectedClass) {
    startAutoRefresh('attendance', async () => {
      if (selectedClass) {
        await loadTodayAttendance();
      }
    }, 30000);
  }
  
  // Stop on page unload
  window.addEventListener('beforeunload', () => {
    stopAllAutoRefresh();
  });
}

/**
 * Setup real-time updates for admin dashboard
 */
function setupAdminRealtime() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') return;
  
  // Auto-refresh reports if class and date selected
  if (selectedClass && selectedDate) {
    startAutoRefresh('reports', async () => {
      if (selectedClass && selectedDate && typeof loadClassReport === 'function') {
        await loadClassReport();
      }
    }, 60000); // 1 minute for reports
  }
  
  // Stop on page unload
  window.addEventListener('beforeunload', () => {
    stopAllAutoRefresh();
  });
}

/**
 * Setup real-time updates for principal dashboard
 */
function setupPrincipalRealtime() {
  const user = getCurrentUser();
  if (!user || user.role !== 'principal') return;
  
  // Auto-refresh reports if class and date selected
  if (selectedClass && selectedDate) {
    startAutoRefresh('reports', async () => {
      if (selectedClass && selectedDate && typeof loadClassReport === 'function') {
        await loadClassReport();
      }
    }, 60000); // 1 minute for reports
  }
  
  // Auto-refresh overview stats
  startAutoRefresh('overview', async () => {
    if (typeof loadOverviewStats === 'function') {
      await loadOverviewStats();
    }
  }, 60000);
  
  // Stop on page unload
  window.addEventListener('beforeunload', () => {
    stopAllAutoRefresh();
  });
}

/**
 * Manual refresh function
 */
async function manualRefresh() {
  const user = getCurrentUser();
  if (!user) return;
  
  showToast('Refreshing data...', 'info', 2000);
  
  if (user.role === 'teacher') {
    if (selectedClass) {
      await loadStudents();
      await loadTodayAttendance();
    }
  } else if (user.role === 'admin' || user.role === 'principal') {
    if (selectedClass && selectedDate) {
      await loadClassReport();
    }
  }
  
  showToast('Data refreshed', 'success', 2000);
}

