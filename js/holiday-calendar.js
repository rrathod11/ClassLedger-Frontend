/**
 * ClassLedger by Tarka - Holiday Calendar Module
 * Manage holidays and exclude them from reports
 */

let holidays = [];

/**
 * Load holidays from backend (stored in Script Properties or separate sheet)
 */
async function loadHolidays() {
  try {
    // For now, holidays are stored in Script Properties as JSON
    // Format: [{"date":"2024-01-26","name":"Republic Day","type":"national"}]
    // This would be implemented in backend
    const response = await apiGet('getHolidays', {});
    
    if (response.success && response.data) {
      holidays = response.data;
    }
  } catch (error) {
    console.error('Load holidays error:', error);
    // Use default holidays if API fails
    holidays = getDefaultHolidays();
  }
}

/**
 * Get default holidays (India)
 */
function getDefaultHolidays() {
  const currentYear = new Date().getFullYear();
  return [
    { date: `${currentYear}-01-26`, name: 'Republic Day', type: 'national' },
    { date: `${currentYear}-08-15`, name: 'Independence Day', type: 'national' },
    { date: `${currentYear}-10-02`, name: 'Gandhi Jayanti', type: 'national' },
    { date: `${currentYear}-01-01`, name: 'New Year', type: 'general' }
  ];
}

/**
 * Check if a date is a holiday
 */
function isHoliday(dateString) {
  return holidays.some(h => h.date === dateString);
}

/**
 * Get holiday name for a date
 */
function getHolidayName(dateString) {
  const holiday = holidays.find(h => h.date === dateString);
  return holiday ? holiday.name : null;
}

/**
 * Filter out holidays from date range
 */
function filterHolidays(dateArray) {
  return dateArray.filter(date => !isHoliday(date));
}

/**
 * Add holiday
 */
async function addHoliday(date, name, type = 'general') {
  try {
    const response = await apiPost('addHoliday', {
      date: date,
      name: name,
      type: type
    });
    
    if (response.success) {
      holidays.push({ date, name, type });
      showToast('Holiday added successfully', 'success');
      return true;
    } else {
      showToast(response.error || 'Failed to add holiday', 'error');
      return false;
    }
  } catch (error) {
    console.error('Add holiday error:', error);
    showToast('Error adding holiday', 'error');
    return false;
  }
}

/**
 * Remove holiday
 */
async function removeHoliday(date) {
  try {
    const response = await apiPost('removeHoliday', {
      date: date
    });
    
    if (response.success) {
      holidays = holidays.filter(h => h.date !== date);
      showToast('Holiday removed successfully', 'success');
      return true;
    } else {
      showToast(response.error || 'Failed to remove holiday', 'error');
      return false;
    }
  } catch (error) {
    console.error('Remove holiday error:', error);
    showToast('Error removing holiday', 'error');
    return false;
  }
}

/**
 * Render holiday calendar
 */
function renderHolidayCalendar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (holidays.length === 0) {
    container.innerHTML = '<p class="text-center">No holidays configured</p>';
    return;
  }
  
  // Group by month
  const byMonth = {};
  holidays.forEach(holiday => {
    const month = holiday.date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(holiday);
  });
  
  container.innerHTML = `
    <div class="holiday-calendar">
      ${Object.keys(byMonth).sort().map(month => {
        const monthHolidays = byMonth[month];
        const monthName = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        
        return `
          <div class="holiday-month" style="margin-bottom: 1.5rem;">
            <h4>${monthName}</h4>
            <div class="holiday-list">
              ${monthHolidays.map(holiday => `
                <div class="holiday-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--card-bg); border-radius: 0.375rem; margin-bottom: 0.5rem;">
                  <div>
                    <strong>${formatDate(holiday.date)}</strong>
                    <span style="margin-left: 1rem; color: var(--text-secondary);">${holiday.name}</span>
                    <span class="holiday-badge ${holiday.type}" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; background: ${holiday.type === 'national' ? '#fee2e2' : '#dbeafe'}; color: ${holiday.type === 'national' ? '#991b1b' : '#1e40af'};">
                      ${holiday.type}
                    </span>
                  </div>
                  <button class="btn btn-sm btn-danger" onclick="removeHoliday('${holiday.date}').then(() => renderHolidayCalendar('${containerId}'))">
                    Remove
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
