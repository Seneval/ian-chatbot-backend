// Admin Authentication Handler
const AUTH_TOKEN_KEY = 'ian_admin_token';
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://ian-chatbot-backend-h6zr.vercel.app/api';

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
    
    // If on login page and has token, redirect to dashboard
    if (token && (window.location.pathname.includes('login.html') || window.location.pathname === '/admin' || window.location.pathname === '/admin/')) {
        verifyTokenAndRedirect(token);
    }
    
    // If on dashboard and no token, redirect to login
    if (!token && (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('settings.html'))) {
        window.location.href = '/admin/login.html';
    }
    
    // Setup login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Verify token is still valid
async function verifyTokenAndRedirect(token) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_BASE_URL}/auth/clients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            window.location.href = '/admin/dashboard.html';
        } else {
            localStorage.removeItem(AUTH_TOKEN_KEY);
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    // Validate password for problematic characters
    const problematicChars = /["\\\r\n\t]/;
    if (problematicChars.test(password)) {
        showError('La contraseña contiene caracteres no permitidos: comillas dobles ("), barras inversas (\\), o saltos de línea');
        // Reset button state
        loginBtn.disabled = false;
        loginBtn.querySelector('.btn-text').style.display = 'inline';
        loginBtn.querySelector('.btn-loader').style.display = 'none';
        return;
    }
    
    // Show loading state
    loginBtn.disabled = true;
    loginBtn.querySelector('.btn-text').style.display = 'none';
    loginBtn.querySelector('.btn-loader').style.display = 'flex';
    errorMessage.style.display = 'none';
    
    try {
        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (response.ok) {
            // Store token
            if (remember) {
                localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            } else {
                sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
            }
            
            // Show success message briefly
            errorMessage.textContent = '✅ ¡Inicio de sesión exitoso!';
            errorMessage.className = 'success-message';
            errorMessage.style.display = 'block';
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/admin/dashboard.html';
            }, 500);
        } else {
            // Check if it's an email verification error
            if (data.code === 'EMAIL_NOT_VERIFIED') {
                errorMessage.innerHTML = `
                    <div style="margin-bottom: 10px;">${data.error}</div>
                    <a href="#" onclick="showResendVerification('${data.email}'); return false;" style="color: #4A90E2; text-decoration: underline;">
                        ¿No recibiste el email? Reenviar verificación
                    </a>
                `;
                errorMessage.className = 'error-message';
                errorMessage.style.display = 'block';
            } else if (data.error && data.error.includes('JSON')) {
                // Handle JSON parsing errors specifically
                errorMessage.innerHTML = `
                    <div style="margin-bottom: 10px;">Error con caracteres especiales en la contraseña</div>
                    <div style="font-size: 12px; color: #666;">
                        ${data.hint || 'Evite usar comillas dobles (") o barras inversas (\\) en su contraseña'}
                    </div>
                `;
                errorMessage.className = 'error-message';
                errorMessage.style.display = 'block';
            } else {
                throw new Error(data.error || 'Error al iniciar sesión');
            }
        }
    } catch (error) {
        // Handle network errors and other exceptions
        let errorMsg = error.message;
        
        if (error.name === 'AbortError') {
            errorMsg = 'Tiempo de espera agotado. El servidor está tardando más de lo esperado. Por favor intente nuevamente.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = 'Error de conexión. Verifique su conexión a internet.';
        } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
            errorMsg = 'Error de formato. Verifique que su contraseña no contenga caracteres especiales problemáticos.';
        }
        
        console.error('Login error:', error);
        
        errorMessage.textContent = errorMsg;
        errorMessage.className = 'error-message';
        errorMessage.style.display = 'block';
    } finally {
        // Always reset button state in finally block to ensure it gets reset
        loginBtn.disabled = false;
        loginBtn.querySelector('.btn-text').style.display = 'inline';
        loginBtn.querySelector('.btn-loader').style.display = 'none';
    }
}

// Logout function (to be used from dashboard)
function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.href = '/admin/login.html';
}

// Get stored token
function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

// Setup axios-like interceptor for fetch
const authenticatedFetch = (url, options = {}) => {
    const token = getToken();
    
    if (!token) {
        window.location.href = 'index.html';
        return Promise.reject(new Error('No token found'));
    }
    
    // Add auth header
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    return fetch(url, options).then(response => {
        // If unauthorized, redirect to login
        if (response.status === 401) {
            logout();
            return Promise.reject(new Error('Unauthorized'));
        }
        return response;
    });
};

// Parse JWT token to get user info
function parseJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
    }
}

// Get current user info from token
function getUserInfo() {
    const token = getToken();
    if (!token) return null;
    
    return parseJWT(token);
}

// Check if current user is super admin
function isSuperAdmin() {
    const userInfo = getUserInfo();
    return userInfo && userInfo.role === 'super_admin';
}

// Show resend verification form
async function showResendVerification(email) {
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.innerHTML = `
        <div style="padding: 15px; background: #f0f0f0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0;">Reenviar Verificación</h4>
            <p style="margin: 0 0 10px 0;">Enviaremos un nuevo enlace de verificación a: <strong>${email}</strong></p>
            <button onclick="resendVerificationEmail('${email}')" class="btn btn-primary" style="margin-right: 10px;">
                Reenviar Email
            </button>
            <button onclick="cancelResend()" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Cancelar
            </button>
        </div>
    `;
}

// Resend verification email
async function resendVerificationEmail(email) {
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        errorMessage.innerHTML = '<div style="color: #666;">Enviando email de verificación...</div>';
        
        const response = await fetch(`${API_BASE_URL}/tenant/resend-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            errorMessage.innerHTML = `
                <div style="color: #27AE60; padding: 15px; background: #d4edda; border-radius: 8px;">
                    ✅ ${data.message || 'Email de verificación enviado. Por favor revisa tu bandeja de entrada.'}
                </div>
            `;
        } else {
            errorMessage.innerHTML = `
                <div style="color: #E74C3C;">
                    ❌ ${data.error || 'Error al enviar el email de verificación'}
                </div>
            `;
        }
    } catch (error) {
        errorMessage.innerHTML = `
            <div style="color: #E74C3C;">
                ❌ Error de conexión. Por favor intenta más tarde.
            </div>
        `;
    }
}

// Cancel resend form
function cancelResend() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
    errorMessage.innerHTML = '';
}

// Export for use in other files
window.adminAuth = {
    getToken,
    logout,
    authenticatedFetch,
    getUserInfo,
    isSuperAdmin,
    API_BASE_URL
};

// Make functions available globally
window.showResendVerification = showResendVerification;
window.resendVerificationEmail = resendVerificationEmail;
window.cancelResend = cancelResend;