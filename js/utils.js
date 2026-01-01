/**
 * ClassLedger by Tarka - Utility Functions
 * Shared utilities for all modules
 */

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add to body
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
  
  return toast;
}

/**
 * Debounce function calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format time for display
 */
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Export data to CSV
 */
function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showToast('No data to export', 'error');
    return;
  }
  
  // Get headers
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  let csv = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  });
  
  // Create download link
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename || 'export.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Data exported successfully', 'success');
}

/**
 * Export data to JSON
 */
function exportToJSON(data, filename) {
  if (!data) {
    showToast('No data to export', 'error');
    return;
  }
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename || 'export.json');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Data exported successfully', 'success');
}

/**
 * Confirm dialog
 */
function confirmDialog(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div style="padding: 1.5rem 0;">
          <p>${message}</p>
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); arguments[0].stopPropagation();">Cancel</button>
          <button class="btn btn-primary" onclick="this.closest('.modal').remove(); arguments[0].stopPropagation(); window.__confirmResult = true;">Confirm</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle confirm
    modal.querySelector('.btn-primary').addEventListener('click', (e) => {
      e.stopPropagation();
      window.__confirmResult = true;
      resolve(true);
      modal.remove();
    });
    
    // Handle cancel
    modal.querySelector('.btn-secondary').addEventListener('click', (e) => {
      e.stopPropagation();
      window.__confirmResult = false;
      resolve(false);
      modal.remove();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        resolve(false);
        modal.remove();
      }
    });
  });
}

/**
 * Cache manager
 */
const cache = {
  data: new Map(),
  timestamps: new Map(),
  ttl: 5 * 60 * 1000, // 5 minutes default
  
  set(key, value, ttl = this.ttl) {
    this.data.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
  },
  
  get(key) {
    const expiry = this.timestamps.get(key);
    if (!expiry || Date.now() > expiry) {
      this.data.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.data.get(key);
  },
  
  clear() {
    this.data.clear();
    this.timestamps.clear();
  },
  
  has(key) {
    return this.get(key) !== null;
  }
};

/**
 * Pagination helper
 */
function paginate(array, page = 1, perPage = 10) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return {
    data: array.slice(start, end),
    page,
    perPage,
    total: array.length,
    totalPages: Math.ceil(array.length / perPage),
    hasNext: end < array.length,
    hasPrev: page > 1
  };
}

/**
 * Create pagination controls
 */
function createPaginationControls(pagination, onPageChange) {
  const container = document.createElement('div');
  container.className = 'pagination';
  container.style.display = 'flex';
  container.style.gap = '0.5rem';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.marginTop = '1rem';
  
  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary';
  prevBtn.textContent = '← Prev';
  prevBtn.disabled = !pagination.hasPrev;
  prevBtn.onclick = () => onPageChange(pagination.page - 1);
  container.appendChild(prevBtn);
  
  // Page info
  const pageInfo = document.createElement('span');
  pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} items)`;
  pageInfo.style.padding = '0 1rem';
  container.appendChild(pageInfo);
  
  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-secondary';
  nextBtn.textContent = 'Next →';
  nextBtn.disabled = !pagination.hasNext;
  nextBtn.onclick = () => onPageChange(pagination.page + 1);
  container.appendChild(nextBtn);
  
  return container;
}

/**
 * Keyboard shortcuts handler
 */
function setupKeyboardShortcuts(shortcuts) {
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    
    const combo = `${ctrl ? 'ctrl+' : ''}${shift ? 'shift+' : ''}${alt ? 'alt+' : ''}${key}`;
    
    if (shortcuts[combo]) {
      e.preventDefault();
      shortcuts[combo]();
    }
  });
}

/**
 * Auto-save manager
 */
const autoSave = {
  interval: null,
  data: {},
  
  start(key, getData, saveCallback, intervalMs = 30000) {
    this.data[key] = { getData, saveCallback, intervalMs };
    
    if (!this.interval) {
      this.interval = setInterval(() => {
        Object.keys(this.data).forEach(k => {
          const { getData, saveCallback } = this.data[k];
          const data = getData();
          if (data) {
            saveCallback(data);
          }
        });
      }, intervalMs);
    }
  },
  
  stop(key) {
    delete this.data[key];
    if (Object.keys(this.data).length === 0 && this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  
  saveNow(key) {
    if (this.data[key]) {
      const { getData, saveCallback } = this.data[key];
      const data = getData();
      if (data) {
        saveCallback(data);
      }
    }
  }
};
