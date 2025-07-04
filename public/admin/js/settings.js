// Admin Settings Management
const AUTH_TOKEN_KEY = 'ian_admin_token';
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://ian-chatbot-backend-h6zr.vercel.app/api';

// Admin authentication utilities
const adminAuth = {
    getToken: () => {
        return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
    },
    
    logout: () => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        window.location.href = '/admin/login.html';
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = adminAuth.getToken();
    
    if (!token) {
        window.location.href = '/admin/login.html';
        return;
    }
    
    // Load profile data
    await loadProfile();
    
    // Setup form handlers
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
});

// Load admin profile
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/profile`, {
            headers: {
                'Authorization': `Bearer ${adminAuth.getToken()}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                adminAuth.logout();
                return;
            }
            throw new Error('Error al cargar perfil');
        }
        
        const data = await response.json();
        const profile = data.profile;
        
        // Update form fields
        document.getElementById('username').value = profile.username || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('userRole').textContent = translateRole(profile.role);
        document.getElementById('adminId').textContent = profile.adminId || profile.userId || 'N/A';
        document.getElementById('lastLogin').textContent = profile.lastLogin 
            ? new Date(profile.lastLogin).toLocaleString('es-MX')
            : 'Nunca';
        
        // Show admin users section if super_admin
        if (profile.role === 'super_admin' && profile.type === 'admin') {
            document.getElementById('adminUsersSection').style.display = 'block';
            await loadAdminUsers();
        }
        
        // Hide setup info for existing admins
        document.getElementById('setupInfoSection').style.display = 'none';
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('Error al cargar el perfil', 'error');
        
        // Show setup info if no admins exist
        if (error.message.includes('404')) {
            document.getElementById('setupInfoSection').style.display = 'block';
        }
    }
}

// Load admin users (for super_admin only)
async function loadAdminUsers() {
    const loadingEl = document.getElementById('adminUsersLoading');
    const emptyEl = document.getElementById('adminUsersEmpty');
    const tableBody = document.getElementById('adminUsersTableBody');
    
    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/users`, {
            headers: {
                'Authorization': `Bearer ${adminAuth.getToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar administradores');
        }
        
        const data = await response.json();
        const admins = data.admins || [];
        
        if (admins.length === 0) {
            emptyEl.style.display = 'block';
            tableBody.innerHTML = '';
        } else {
            tableBody.innerHTML = admins.map(admin => `
                <tr>
                    <td>${escapeHtml(admin.username)}</td>
                    <td>${escapeHtml(admin.email)}</td>
                    <td><span class="badge ${admin.role === 'super_admin' ? 'badge-primary' : 'badge-secondary'}">${translateRole(admin.role)}</span></td>
                    <td>
                        <span class="badge ${admin.isActive ? 'badge-success' : 'badge-danger'}">
                            ${admin.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>${admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString('es-MX') : 'Nunca'}</td>
                    <td>${new Date(admin.createdAt).toLocaleDateString('es-MX')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading admin users:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error al cargar administradores</td></tr>';
    } finally {
        loadingEl.style.display = 'none';
    }
}

// Handle profile update
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn.textContent;
    
    try {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Guardando...';
        
        const formData = {
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim()
        };
        
        const response = await fetch(`${API_BASE_URL}/auth/admin/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminAuth.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al actualizar perfil');
        }
        
        showMessage('✅ Perfil actualizado exitosamente', 'success');
        
        // Reload profile data
        await loadProfile();
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessage(error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// Handle password change
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const changeBtn = document.getElementById('changePasswordBtn');
    const originalText = changeBtn.textContent;
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showMessage('Las contraseñas no coinciden', 'error');
        return;
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
        showMessage('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }
    
    try {
        changeBtn.disabled = true;
        changeBtn.textContent = '⏳ Cambiando...';
        
        const response = await fetch(`${API_BASE_URL}/auth/admin/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminAuth.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al cambiar contraseña');
        }
        
        showMessage('✅ Contraseña actualizada exitosamente', 'success');
        
        // Clear form
        document.getElementById('passwordForm').reset();
        
    } catch (error) {
        console.error('Error changing password:', error);
        showMessage(error.message, 'error');
    } finally {
        changeBtn.disabled = false;
        changeBtn.textContent = originalText;
    }
}

// Utility functions
function translateRole(role) {
    const roles = {
        'super_admin': 'Super Administrador',
        'admin': 'Administrador',
        'owner': 'Propietario',
        'member': 'Miembro'
    };
    return roles[role] || role;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    container.appendChild(messageEl);
    
    // Animate in
    setTimeout(() => {
        messageEl.classList.add('show');
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        messageEl.classList.remove('show');
        setTimeout(() => {
            container.removeChild(messageEl);
        }, 300);
    }, 5000);
}