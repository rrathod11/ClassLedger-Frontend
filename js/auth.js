/**
 * ClassLedger by Tarka - Authentication Module
 * Handles Google OAuth and user validation
 */

// API Configuration
// ClassLedger Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwtvbmUP8SDG3pmLZ0uCxoZjZ8Fs61XFHXZI5sh0GmkMnRK_VrrW7DHO-DpG-5o5elR/exec';

/**
 * Initialize Google Sign-In
 * NOTE: OAuth is now handled via direct redirect in login.html
 * This function is kept for backward compatibility
 */
function initGoogleSignIn() {
  // OAuth is handled via direct redirect in login.html
  // No need to call checkAuth() - redirect flow handles authentication
  console.log('initGoogleSignIn: OAuth handled via redirect flow in login.html');
}

/**
 * Check if user is authenticated and authorized
 * NOTE: This function is kept for backward compatibility but is not actively used
 * The OAuth flow now uses direct redirects via login.html
 * 
 * @deprecated Use the OAuth redirect flow in login.html instead
 */
async function checkAuth() {
  // This function is deprecated - OAuth now handled via redirect flow
  // Keeping for backward compatibility only
  console.warn('checkAuth() is deprecated - use OAuth redirect flow instead');
  return false;
}

/**
 * Redirect to appropriate dashboard based on role
 */
function redirectToDashboard(role) {
  switch (role) {
    case 'teacher':
      window.location.href = 'teacher-dashboard.html';
      break;
    case 'admin':
      window.location.href = 'admin-dashboard.html';
      break;
    case 'principal':
      window.location.href = 'principal-dashboard.html';
      break;
    default:
      showAccessDenied();
  }
}

/**
 * Show access denied message
 */
function showAccessDenied() {
  const main = document.querySelector('main') || document.body;
  main.innerHTML = `
    <div class="container">
      <div class="card">
        <div class="text-center">
          <h1 style="color: var(--danger-color); margin-bottom: 1rem;">Access Denied</h1>
          <p style="font-size: 1.125rem; margin-bottom: 2rem;">
            You are not authorized to use ClassLedger.
          </p>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">
            Please contact your school administrator to be added to the system.
          </p>
          <a href="index.html" class="btn btn-primary">Return to Homepage</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get current user from session
 */
function getCurrentUser() {
  const userStr = sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return sessionStorage.getItem('authenticated') === 'true';
}

/**
 * Logout user
 */
function logout() {
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('authenticated');
  window.location.href = 'index.html';
}

/**
 * Make authenticated API request
 * Note: Apps Script Web Apps handle authentication via OAuth redirects and cookies
 * For cross-origin requests, we need to pass user info or use credentials
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const url = `${API_URL}${endpoint}`;
    
    // Get user from sessionStorage to include in request if needed
    const user = getCurrentUser();
    console.log('Current user from sessionStorage:', user);
    
    // Build URL with user email if available (for Apps Script to identify user)
    let requestUrl = url;
    if (user) {
      // Check for email field (might be in different case or location)
      const userEmail = user.email || user.Email || user.userEmail || user.user_email;
      console.log('User email found:', userEmail);
      
      if (userEmail && !url.includes('userEmail=')) {
        const separator = url.includes('?') ? '&' : '?';
        requestUrl = `${url}${separator}userEmail=${encodeURIComponent(userEmail)}`;
        console.log('Added userEmail to URL:', requestUrl);
      } else {
        console.warn('No userEmail found in user object or already in URL');
        console.warn('User object keys:', Object.keys(user));
      }
    } else {
      console.error('No user found in sessionStorage!');
      console.error('sessionStorage.getItem("user"):', sessionStorage.getItem('user'));
    }
    
    console.log('Final API Request URL:', requestUrl);
    
    // CRITICAL: If no userEmail in URL and we have user, force add it
    if (!requestUrl.includes('userEmail=') && user) {
      const userEmail = user.email || user.Email || user.userEmail || user.user_email;
      if (userEmail) {
        const separator = requestUrl.includes('?') ? '&' : '?';
        requestUrl = `${requestUrl}${separator}userEmail=${encodeURIComponent(userEmail)}`;
        console.log('FORCED userEmail addition:', requestUrl);
      } else {
        console.error('CRITICAL: User exists but no email field found!', user);
      }
    }
    
    // CRITICAL: Apps Script Web Apps return 302 redirects for OAuth which causes CORS errors
    // The backend MUST be updated to accept userEmail parameter before requiring OAuth
    // For now, we'll try the request and handle errors gracefully
    
    let response;
    try {
      response = await fetch(requestUrl, {
        ...options,
        mode: 'cors',
        redirect: 'follow', // Follow redirects automatically
        cache: 'no-cache'
      });
      
      console.log('API Response status:', response.status, response.statusText);
      console.log('API Response headers:', Object.fromEntries(response.headers.entries()));
      
    } catch (fetchError) {
      console.error('❌ Fetch error (likely CORS/302 redirect):', fetchError);
      console.error('Request URL was:', requestUrl);
      console.error('Request method:', options.method || 'GET');
      console.error('This usually means:');
      console.error('1. ⚠️ Apps Script backend not updated with latest code (doPost, getUserFromRequest)');
      console.error('2. ⚠️ Web App not redeployed after code update (must create NEW version)');
      console.error('3. ⚠️ CORS preflight (OPTIONS) failing - backend doOptions() not working');
      console.error('4. ⚠️ userEmail parameter not being read by backend');
      
      // More specific error message
      let errorMsg = 'Network error: Failed to connect to backend. ';
      if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('CORS')) {
        errorMsg += 'This is usually a CORS issue. Please ensure:\n';
        errorMsg += '1. Backend code is updated in Apps Script\n';
        errorMsg += '2. Web App is redeployed (NEW version)\n';
        errorMsg += '3. Backend has doOptions() function for CORS preflight';
      }
      
      throw new Error(errorMsg + ' Original error: ' + fetchError.message);
    }
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
      console.log('API Response data:', data);
    } else {
      // Not JSON, might be HTML (OAuth redirect page)
      const text = await response.text();
      console.error('Non-JSON response. Content-Type:', contentType);
      console.error('Response preview:', text.substring(0, 500));
      
      // If we get HTML, it's likely an OAuth redirect
      if (text.includes('<!DOCTYPE html>') || text.includes('<html>') || response.status === 302) {
        console.error('CRITICAL: Received HTML/Redirect response. This means:');
        console.error('1. Apps Script backend code needs to be updated');
        console.error('2. Backend must check userEmail parameter BEFORE requiring OAuth');
        console.error('3. Please update Code.gs in Apps Script and redeploy');
        
        throw new Error('OAuth redirect detected. Please update Apps Script backend to support userEmail parameter.');
      } else {
        throw new Error(`Expected JSON but got: ${contentType || 'unknown'} (Status: ${response.status})`);
      }
    }
    
    // Check for unauthorized - might need to re-authenticate
    if (data.success === false && data.error === 'Unauthorized') {
      console.error('Unauthorized response received');
      console.error('Debug info:', data.debug);
      
      // Check if userEmail was sent but still unauthorized
      if (data.debug && data.debug.hasUserEmailParam) {
        console.error('CRITICAL: userEmail was sent but user not found!');
        console.error('Possible reasons:');
        console.error('1. Email not in Teacher_Master sheet');
        console.error('2. Email mismatch (check exact spelling)');
        console.error('3. Active column is FALSE');
        console.error('4. Backend code not updated in Apps Script');
        
        // Don't clear sessionStorage yet - might be a backend issue
        // Only clear if we're sure it's an auth issue
        throw new Error('Unauthorized: Email not found or not active. Check Teacher_Master sheet.');
      } else {
        // No userEmail was sent - clear session and redirect
        console.log('No userEmail in request, clearing session and redirecting');
        sessionStorage.clear();
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 100);
        throw new Error('Unauthorized - please login again');
      }
    }
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API request error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      endpoint: endpoint
    });
    
    // If it's a network error and we're not on login page, might need auth
    if (error.message.includes('Failed to fetch') && !window.location.pathname.includes('login.html')) {
      console.log('Network error, might need authentication');
    }
    
    throw error;
  }
}

/**
 * Make authenticated POST request
 * Using form-encoded to avoid CORS preflight issues
 */
async function apiPost(action, data) {
  // Get user email to add to URL for Apps Script authentication
  const user = getCurrentUser();
  let endpoint = '';
  if (user) {
    const userEmail = user.email || user.Email || user.userEmail || user.user_email;
    if (userEmail) {
      endpoint = `?userEmail=${encodeURIComponent(userEmail)}`;
      console.log('apiPost: Added userEmail to endpoint:', endpoint);
    } else {
      console.error('apiPost: User found but no email field:', user);
    }
  } else {
    console.error('apiPost: No user found in sessionStorage!');
  }
  
  console.log('apiPost: Making POST request with action:', action);
  console.log('apiPost: Data:', data);
  
  // Use form-encoded instead of JSON to avoid CORS preflight
  // Apps Script doPost can handle both JSON and form-encoded
  const formData = new URLSearchParams();
  formData.append('action', action);
  for (const key in data) {
    if (data[key] !== null && data[key] !== undefined) {
      // If value is an object/array, stringify it
      if (typeof data[key] === 'object') {
        formData.append(key, JSON.stringify(data[key]));
      } else {
        formData.append(key, String(data[key]));
      }
    }
  }
  
  return apiRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });
}

/**
 * Make authenticated GET request
 */
async function apiGet(action, params = {}) {
  const queryString = new URLSearchParams({
    action: action,
    ...params
  }).toString();
  
  return apiRequest(`?${queryString}`);
}

