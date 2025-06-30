// Dashboard Functionality
let clients = [];
let currentClientId = null;
let currentWidgetCode = '';

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (typeof adminAuth === 'undefined' || !adminAuth.getToken()) {
        console.error('Auth not loaded or no token found');
        window.location.href = 'index.html';
        return;
    }
    
    // Load initial data
    loadDashboardData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load clients
    loadClients();
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', adminUtils.debounce(handleSearch, 300));
    
    // Client form
    const clientForm = document.getElementById('clientForm');
    clientForm.addEventListener('submit', handleClientSubmit);
    
    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });
}

// Load dashboard statistics
async function loadDashboardData() {
    try {
        // For now, calculate stats from clients data
        // This will be replaced with real analytics API when MongoDB is integrated
        const { clients: clientsData } = await adminAPI.getClients();
        
        // Update stats
        document.getElementById('totalClients').textContent = clientsData.length;
        
        // Calculate monthly revenue based on plans
        const monthlyRevenue = clientsData.reduce((total, client) => {
            if (client.status === 'active') {
                switch (client.plan || 'basic') {
                    case 'basic': return total + 29000;
                    case 'pro': return total + 59000;
                    case 'enterprise': return total + 89000;
                    default: return total + 29000;
                }
            }
            return total;
        }, 0);
        
        document.getElementById('monthlyRevenue').textContent = `$${adminUtils.formatNumber(monthlyRevenue)}`;
        
        // Placeholder for other stats (will be real when MongoDB is integrated)
        document.getElementById('totalSessions').textContent = '0';
        document.getElementById('totalMessages').textContent = '0';
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        adminUtils.showToast('Error al cargar datos del dashboard', 'error');
    }
}

// Load clients
async function loadClients() {
    const tableBody = document.getElementById('clientsTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    // Show loading state
    loadingState.style.display = 'flex';
    emptyState.style.display = 'none';
    
    try {
        const { clients: clientsData } = await adminAPI.getClients();
        clients = clientsData;
        
        // Hide loading
        loadingState.style.display = 'none';
        
        if (clients.length === 0) {
            emptyState.style.display = 'block';
            tableBody.innerHTML = '';
        } else {
            emptyState.style.display = 'none';
            renderClients(clients);
        }
        
    } catch (error) {
        console.error('Error loading clients:', error);
        loadingState.style.display = 'none';
        adminUtils.showToast('Error al cargar clientes', 'error');
    }
}

// Render clients in table
function renderClients(clientsList) {
    const tableBody = document.getElementById('clientsTableBody');
    
    tableBody.innerHTML = clientsList.map(client => {
        const plan = client.plan || 'basic';
        const status = client.status || 'active';
        const isActive = status === 'active';
        const messageUsage = client.currentMonthMessages || 0;
        const messageLimit = client.monthlyMessageLimit || 1000;
        const usagePercent = (messageUsage / messageLimit) * 100;
        
        return `
            <tr>
                <td>
                    <strong>${client.businessName}</strong>
                    ${client.contactPerson ? `<br><small>${client.contactPerson}</small>` : ''}
                </td>
                <td>${client.contactEmail || client.email || '-'}</td>
                <td>
                    <span class="badge badge-${getPlanBadgeClass(plan)}">
                        ${plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </span>
                </td>
                <td class="hide-mobile">
                    <div>
                        ${adminUtils.formatNumber(messageUsage)} / ${adminUtils.formatNumber(messageLimit)}
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(usagePercent, 100)}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-${isActive ? 'success' : 'warning'}">
                        ${isActive ? '✅ Activo' : '⏸️ Pausado'}
                    </span>
                </td>
                <td>
                    <div class="dropdown">
                        <button class="action-btn" onclick="toggleDropdown(event, '${client.id}')">
                            ⋮
                        </button>
                        <div class="dropdown-menu" id="dropdown-${client.id}">
                            <a class="dropdown-item" onclick="viewWidgetCode('${client.id}')">
                                📋 Ver Código Widget
                            </a>
                            <a class="dropdown-item" onclick="viewAnalytics('${client.id}')">
                                📊 Ver Analytics
                            </a>
                            <a class="dropdown-item" onclick="editClient('${client.id}')">
                                ✏️ Editar
                            </a>
                            <a class="dropdown-item" onclick="regenerateToken('${client.id}')">
                                🔄 Regenerar Token
                            </a>
                            <a class="dropdown-item" onclick="toggleClientStatus('${client.id}')">
                                ${isActive ? '⏸️ Pausar' : '▶️ Activar'}
                            </a>
                            <div class="dropdown-divider"></div>
                            <a class="dropdown-item" onclick="deleteClient('${client.id}')" style="color: var(--danger);">
                                🗑️ Eliminar
                            </a>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Get plan badge class
function getPlanBadgeClass(plan) {
    switch (plan) {
        case 'pro': return 'info';
        case 'enterprise': return 'success';
        default: return 'secondary';
    }
}

// Toggle dropdown menu
function toggleDropdown(event, clientId) {
    event.stopPropagation();
    
    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.id !== `dropdown-${clientId}`) {
            menu.classList.remove('active');
        }
    });
    
    // Toggle current dropdown
    const dropdown = document.getElementById(`dropdown-${clientId}`);
    dropdown.classList.toggle('active');
}

// Handle search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filteredClients = clients.filter(client => 
        client.businessName.toLowerCase().includes(searchTerm) ||
        (client.contactEmail && client.contactEmail.toLowerCase().includes(searchTerm)) ||
        (client.contactPerson && client.contactPerson.toLowerCase().includes(searchTerm))
    );
    
    renderClients(filteredClients);
}

// Open add client modal
function openAddClientModal() {
    currentClientId = null;
    document.getElementById('modalTitle').textContent = '➕ Nuevo Cliente';
    document.getElementById('submitBtn').querySelector('.btn-text').textContent = '✓ Crear Cliente';
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    openModal('clientModal');
}

// Edit client
async function editClient(clientId) {
    currentClientId = clientId;
    const client = clients.find(c => c.id === clientId);
    
    if (!client) return;
    
    // Update modal
    document.getElementById('modalTitle').textContent = '✏️ Editar Cliente';
    document.getElementById('submitBtn').querySelector('.btn-text').textContent = '✓ Guardar Cambios';
    
    // Fill form
    document.getElementById('clientId').value = clientId;
    document.getElementById('businessName').value = client.businessName;
    document.getElementById('contactEmail').value = client.contactEmail || client.email || '';
    document.getElementById('contactPerson').value = client.contactPerson || '';
    document.getElementById('phone').value = client.phone || '';
    document.getElementById('plan').value = client.plan || 'basic';
    document.getElementById('assistantId').value = client.assistantId;
    document.getElementById('monthlyMessageLimit').value = client.monthlyMessageLimit || 1000;
    document.getElementById('notes').value = client.notes || '';
    document.getElementById('widgetTitle').value = client.widgetTitle || 'Asistente Virtual';
    document.getElementById('widgetGreeting').value = client.widgetGreeting || '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?';
    
    openModal('clientModal');
}

// Handle client form submission
async function handleClientSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const formError = document.getElementById('formError');
    
    // Show loading
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loader').style.display = 'flex';
    formError.style.display = 'none';
    
    // Get form data
    const formData = {
        businessName: document.getElementById('businessName').value,
        contactEmail: document.getElementById('contactEmail').value,
        contactPerson: document.getElementById('contactPerson').value,
        phone: document.getElementById('phone').value,
        plan: document.getElementById('plan').value,
        assistantId: document.getElementById('assistantId').value,
        monthlyMessageLimit: parseInt(document.getElementById('monthlyMessageLimit').value),
        notes: document.getElementById('notes').value,
        widgetTitle: document.getElementById('widgetTitle').value || 'Asistente Virtual',
        widgetGreeting: document.getElementById('widgetGreeting').value || '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?'
    };
    
    try {
        let result;
        
        if (currentClientId) {
            // Update existing client
            result = await adminAPI.updateClient(currentClientId, formData);
            adminUtils.showToast('Cliente actualizado exitosamente', 'success');
        } else {
            // Create new client
            result = await adminAPI.createClient(formData);
            adminUtils.showToast('Cliente creado exitosamente', 'success');
            
            // Show widget code immediately
            currentWidgetCode = result.widgetCode;
            showWidgetCode(result.widgetCode);
        }
        
        // Reload clients
        await loadClients();
        
        // Close modal
        closeModal('clientModal');
        
    } catch (error) {
        console.error('Error saving client:', error);
        formError.textContent = error.message;
        formError.style.display = 'block';
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').style.display = 'inline';
        submitBtn.querySelector('.btn-loader').style.display = 'none';
    }
}

// View widget code
async function viewWidgetCode(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const widgetCode = `<!-- iAN Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://ian-chatbot-backend-h6zr.vercel.app/widget.js';
    script.setAttribute('data-client-token', '${client.token}');
    script.setAttribute('data-position', 'bottom-right');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
    
    currentWidgetCode = widgetCode;
    showWidgetCode(widgetCode);
}

// Show widget code modal
function showWidgetCode(code) {
    document.getElementById('widgetCode').textContent = code;
    openModal('widgetModal');
}

// Copy widget code
async function copyWidgetCode() {
    const success = await adminUtils.copyToClipboard(currentWidgetCode);
    if (success) {
        adminUtils.showToast('Código copiado al portapapeles', 'success');
    } else {
        adminUtils.showToast('Error al copiar código', 'error');
    }
}

// Send widget by email
function sendWidgetByEmail() {
    const client = clients.find(c => c.token && currentWidgetCode.includes(c.token));
    if (!client) return;
    
    const subject = encodeURIComponent('Código de integración - iAN Chatbot');
    const body = encodeURIComponent(`Hola ${client.contactPerson || client.businessName},

Aquí está el código para integrar el chatbot en tu sitio web:

${currentWidgetCode}

Instrucciones:
1. Copia el código completo
2. Pégalo antes de la etiqueta </body> en tu sitio web
3. El chatbot aparecerá automáticamente en la esquina inferior derecha

Si necesitas ayuda con la integración, no dudes en contactarnos.

Saludos,
Equipo iAN`);
    
    window.open(`mailto:${client.contactEmail || client.email}?subject=${subject}&body=${body}`);
}

// View analytics
function viewAnalytics(clientId) {
    // For now, show a message. Will implement when analytics are ready
    adminUtils.showToast('Analytics próximamente disponible', 'info');
}

// Regenerate token
async function regenerateToken(clientId) {
    if (!adminUtils.confirmDialog('¿Estás seguro de regenerar el token? El código anterior dejará de funcionar.')) {
        return;
    }
    
    try {
        const result = await adminAPI.regenerateToken(clientId);
        adminUtils.showToast('Token regenerado exitosamente', 'success');
        
        // Update local client data
        const client = clients.find(c => c.id === clientId);
        if (client) {
            client.token = result.token;
        }
        
        // Show new widget code
        viewWidgetCode(clientId);
        
    } catch (error) {
        console.error('Error regenerating token:', error);
        adminUtils.showToast('Error al regenerar token', 'error');
    }
}

// Toggle client status
async function toggleClientStatus(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activar' : 'pausar';
    
    if (!adminUtils.confirmDialog(`¿Estás seguro de ${action} este cliente?`)) {
        return;
    }
    
    try {
        await adminAPI.updateClient(clientId, { status: newStatus });
        adminUtils.showToast(`Cliente ${newStatus === 'active' ? 'activado' : 'pausado'} exitosamente`, 'success');
        await loadClients();
    } catch (error) {
        console.error('Error updating client status:', error);
        adminUtils.showToast('Error al actualizar estado del cliente', 'error');
    }
}

// Delete client
async function deleteClient(clientId) {
    if (!adminUtils.confirmDialog('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        // For now, just update status to deleted (when MongoDB is ready, we'll implement proper deletion)
        await adminAPI.updateClient(clientId, { status: 'deleted' });
        adminUtils.showToast('Cliente eliminado exitosamente', 'success');
        await loadClients();
    } catch (error) {
        console.error('Error deleting client:', error);
        adminUtils.showToast('Error al eliminar cliente', 'error');
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N for new client
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddClientModal();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});