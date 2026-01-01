/**
 * ClassLedger by Tarka - Analytics & Insights Module
 * Trend analysis, performance metrics, anomaly detection
 */

/**
 * Calculate attendance trends
 */
function calculateTrends(attendanceData) {
  if (!attendanceData || attendanceData.length < 2) {
    return { direction: 'neutral', change: 0, message: 'Insufficient data' };
  }
  
  // Sort by date
  const sorted = [...attendanceData].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate average for first half and second half
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);
  
  const avgFirst = firstHalf.reduce((sum, d) => sum + (d.present / (d.present + d.absent + d.late) * 100), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, d) => sum + (d.present / (d.present + d.absent + d.late) * 100), 0) / secondHalf.length;
  
  const change = ((avgSecond - avgFirst) / avgFirst) * 100;
  
  let direction = 'neutral';
  if (change > 5) direction = 'up';
  else if (change < -5) direction = 'down';
  
  return {
    direction,
    change: Math.abs(change).toFixed(1),
    avgFirst: avgFirst.toFixed(1),
    avgSecond: avgSecond.toFixed(1),
    message: change > 0 ? 'Improving' : change < 0 ? 'Declining' : 'Stable'
  };
}

/**
 * Detect anomalies in attendance
 */
function detectAnomalies(attendanceData) {
  const anomalies = [];
  
  if (!attendanceData || attendanceData.length < 3) return anomalies;
  
  // Calculate average attendance rate
  const rates = attendanceData.map(d => {
    const total = d.present + d.absent + d.late;
    return total > 0 ? (d.present / total) * 100 : 0;
  });
  
  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const stdDev = Math.sqrt(
    rates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / rates.length
  );
  
  // Find outliers (more than 2 standard deviations)
  attendanceData.forEach((data, index) => {
    const rate = rates[index];
    if (Math.abs(rate - avgRate) > 2 * stdDev) {
      anomalies.push({
        date: data.date,
        rate: rate.toFixed(1),
        expected: avgRate.toFixed(1),
        type: rate < avgRate ? 'low' : 'high'
      });
    }
  });
  
  return anomalies;
}

/**
 * Calculate performance metrics
 */
function calculatePerformanceMetrics(attendanceData) {
  if (!attendanceData || attendanceData.length === 0) {
    return {
      avgAttendance: 0,
      bestDay: null,
      worstDay: null,
      consistency: 0
    };
  }
  
  const metrics = attendanceData.map(d => {
    const total = d.present + d.absent + d.late;
    return {
      date: d.date,
      rate: total > 0 ? (d.present / total) * 100 : 0,
      total,
      present: d.present
    };
  });
  
  const avgAttendance = metrics.reduce((sum, m) => sum + m.rate, 0) / metrics.length;
  
  const bestDay = metrics.reduce((best, current) => 
    current.rate > best.rate ? current : best
  );
  
  const worstDay = metrics.reduce((worst, current) => 
    current.rate < worst.rate ? current : worst
  );
  
  // Calculate consistency (lower std dev = more consistent)
  const rates = metrics.map(m => m.rate);
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - avg, 2), 0) / rates.length;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, 100 - (stdDev / avg * 100)); // Higher = more consistent
  
  return {
    avgAttendance: avgAttendance.toFixed(1),
    bestDay: {
      date: bestDay.date,
      rate: bestDay.rate.toFixed(1)
    },
    worstDay: {
      date: worstDay.date,
      rate: worstDay.rate.toFixed(1)
    },
    consistency: consistency.toFixed(1)
  };
}

/**
 * Render analytics dashboard
 */
function renderAnalytics(attendanceData, students) {
  const trends = calculateTrends(attendanceData);
  const anomalies = detectAnomalies(attendanceData);
  const metrics = calculatePerformanceMetrics(attendanceData);
  
  return {
    trends,
    anomalies,
    metrics,
    html: `
      <div class="analytics-dashboard">
        <h3>Analytics & Insights</h3>
        
        <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
          <!-- Trends -->
          <div class="analytics-card">
            <h4>Trend Analysis</h4>
            <div class="trend-indicator ${trends.direction}">
              <span class="trend-arrow">${trends.direction === 'up' ? '↑' : trends.direction === 'down' ? '↓' : '→'}</span>
              <span class="trend-value">${trends.change}%</span>
            </div>
            <p style="margin-top: 0.5rem; color: var(--text-secondary);">${trends.message}</p>
          </div>
          
          <!-- Average Attendance -->
          <div class="analytics-card">
            <h4>Average Attendance</h4>
            <div class="metric-value">${metrics.avgAttendance}%</div>
            <p style="margin-top: 0.5rem; color: var(--text-secondary);">Overall average</p>
          </div>
          
          <!-- Best Day -->
          <div class="analytics-card">
            <h4>Best Day</h4>
            <div class="metric-value">${metrics.bestDay.rate}%</div>
            <p style="margin-top: 0.5rem; color: var(--text-secondary);">${formatDate(metrics.bestDay.date)}</p>
          </div>
          
          <!-- Consistency -->
          <div class="analytics-card">
            <h4>Consistency</h4>
            <div class="metric-value">${metrics.consistency}%</div>
            <p style="margin-top: 0.5rem; color: var(--text-secondary);">Attendance consistency</p>
          </div>
        </div>
        
        ${anomalies.length > 0 ? `
          <div style="margin-top: 2rem;">
            <h4>Anomalies Detected</h4>
            <div class="anomalies-list">
              ${anomalies.map(anomaly => `
                <div class="anomaly-item ${anomaly.type}">
                  <strong>${formatDate(anomaly.date)}</strong>
                  <span>Attendance: ${anomaly.rate}% (Expected: ${anomaly.expected}%)</span>
                  <span class="anomaly-badge">${anomaly.type === 'low' ? 'Low' : 'High'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  };
}
