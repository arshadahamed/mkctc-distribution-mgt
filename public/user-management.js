// User Management Functions for Admin Panel

// Load all users
AgroDistributionApp.prototype.loadUsers = async function () {
    if (this.currentView !== 'admin' || !document.getElementById('users-table-body')) return;

    console.log('loadUsers called');
    try {
        const response = await this.apiCall('/api/users');
        if (!response) {
            console.error('No response from API');
            return;
        }

        const result = await response.json();

        if (result.success) {
            console.log('Users data:', result.data);
            this.allUsers = result.data; // Store for filtering
            this.displayUsers(this.allUsers);

            // Setup search listener once
            const searchInput = document.getElementById('user-search');
            if (searchInput && !searchInput.dataset.hasListener) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const filtered = this.allUsers.filter(u =>
                        u.name.toLowerCase().includes(term) ||
                        u.username.toLowerCase().includes(term) ||
                        u.role.toLowerCase().includes(term)
                    );
                    this.displayUsers(filtered);
                });
                searchInput.dataset.hasListener = 'true';
            }

            // Auto-refresh mechanism for admin status board
            if (this.currentView === 'admin' && !this.userRefreshInterval) {
                this.userRefreshInterval = setInterval(() => {
                    if (this.currentView === 'admin' && document.getElementById('users-table-body')) {
                        this.loadUsers();
                    } else if (this.currentView !== 'admin') {
                        clearInterval(this.userRefreshInterval);
                        this.userRefreshInterval = null;
                    }
                }, 5000); // Poll every 5 seconds
            }
        } else {
            console.error('API error:', result.message);
            this.showNotification('Failed to load users: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        this.showNotification('Error loading users', 'error');
    }
};

// Display users in table
AgroDistributionApp.prototype.displayUsers = function (users) {
    console.log('displayUsers called with', users.length, 'users');
    const tbody = document.getElementById('users-table-body');

    if (!tbody) {
        if (this.currentView === 'admin') {
            console.warn('users-table-body element not found, skipping displayUsers (view might be loading)');
        }
        return;
    }

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>';
        return;
    }

    try {
        let html = '';
        users.forEach((user, index) => {
            let permissions = [];
            try {
                permissions = JSON.parse(user.permissions || '[]');
            } catch (e) {
                permissions = [];
            }

            const isBlocked = user.is_blocked === 1;
            const isOnline = user.login_status === 'online';

            // Status badge logic
            let statusBadge = '';
            if (isBlocked) {
                statusBadge = '<span class="status-badge status-blocked"><i class="fas fa-ban"></i> Blocked</span>';
            } else if (isOnline) {
                statusBadge = '<span class="status-badge status-online"><i class="fas fa-circle"></i> Online</span>';
            } else {
                statusBadge = '<span class="status-badge status-offline"><i class="fas fa-circle-notch"></i> Offline</span>';
            }

            // Role badge logic
            const roleBadge = user.role === 'admin'
                ? '<span class="role-badge role-admin">Admin</span>'
                : '<span class="role-badge role-employee">Employee</span>';

            // User Initials for Avatar
            const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';

            // Last login formatting
            const lastLogin = user.last_login
                ? new Date(user.last_login).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '<span class="text-muted">Never</span>';

            html += `
                <tr>
                    <td class="text-center" style="width: 50px; color: var(--gray-400); font-size: 0.8rem;">${user.id}</td>
                    <td>
                        <div class="user-info-cell">
                            <div class="user-avatar-initials" style="background: ${this.getAvatarColor(initials)}">
                                ${initials}
                            </div>
                            <div class="user-name-wrapper">
                                <span class="user-full-name">${user.name}</span>
                                <span class="user-id-tag">@${user.username}</span>
                            </div>
                        </div>
                    </td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td><span style="font-size: 0.85rem; font-weight: 500; color: var(--gray-600);">${lastLogin}</span></td>
                    <td class="text-center">
                        <span class="permissions-count" title="${permissions.length} active permissions">
                            ${permissions.length}
                        </span>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <button class="action-btn action-btn-edit" onclick="app.editUser(${user.id})" title="Edit User Account">
                                <i class="fas fa-user-edit"></i>
                            </button>
                            <button class="action-btn action-btn-block" 
                                    onclick="app.toggleBlockUser(${user.id}, ${isBlocked ? 0 : 1})" 
                                    title="${isBlocked ? 'Unlock' : 'Block'} User Access">
                                <i class="fas ${isBlocked ? 'fa-unlock-alt' : 'fa-user-lock'}"></i>
                            </button>
                            ${isOnline ? `
                                <button class="action-btn action-btn-logout" 
                                        onclick="app.forceLogoutUser(${user.id})" 
                                        title="Force Logout Session">
                                    <i class="fas fa-sign-out-alt"></i>
                                </button>
                            ` : ''}
                            <button class="action-btn action-btn-delete" 
                                    onclick="app.deleteUser(${user.id}, '${user.name.replace(/'/g, "\\'")}')" 
                                    title="Permanently Delete User"
                                    ${user.id === 1 ? 'disabled' : ''}>
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error('Error in displayUsers:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error rendering user table</td></tr>';
    }
};

// Helper to get consistent but diverse colors for avatars
AgroDistributionApp.prototype.getAvatarColor = function (str) {
    const colors = [
        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
        'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Green
        'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', // Red
        'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Violet
        'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // Pink
        'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'  // Cyan
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};


// Open user modal (for add/edit)
AgroDistributionApp.prototype.openUserModal = function (userId = null) {
    console.log('openUserModal called, userId:', userId);

    const modal = document.getElementById('admin-user-modal');
    const overlay = document.getElementById('admin-user-modal-overlay');
    const title = document.getElementById('admin-user-modal-title');
    const form = document.getElementById('admin-user-form');
    const passwordOptional = document.getElementById('admin-password-optional');
    const passwordInput = document.getElementById('admin-user-password');

    console.log('Modal element:', modal);
    console.log('Overlay element:', overlay);

    if (!modal || !overlay) {
        console.error('Modal or overlay not found!');
        return;
    }

    // Reset form
    if (form) form.reset();
    const userIdEl = document.getElementById('admin-user-id');
    if (userIdEl) userIdEl.value = '';

    // Clear all permission checkboxes
    document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = false);

    // Generate and inject permissions HTML
    const container = document.getElementById('permission-container');
    if (container && this.PERMISSIONS) {
        let html = '';
        for (const [module, actions] of Object.entries(this.PERMISSIONS)) {
            // Permission Group
            html += `
                <div class="permission-group-section" style="grid-column: span 2; margin-top: 15px;">
                    <div style="font-weight: 700; color: var(--primary-green-dark); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 5px; border-bottom: 1px solid var(--light-green-bg); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-layer-group"></i> ${module}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        ${actions.map(action => {
                const permValue = `${module}:${action}`;
                return `
                                <label class="permission-item-label" style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; padding: 6px 10px; border-radius: 6px; background: white; border: 1px solid #edf2f7; transition: all 0.2s;">
                                    <input type="checkbox" class="permission-checkbox" value="${permValue}" style="accent-color: var(--primary-green); width: 16px; height: 16px;">
                                    <span style="color: #4a5568;">${action.replace(/_/g, ' ')}</span>
                                </label>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;

        // Add hover effects for dynamically created items
        container.querySelectorAll('.permission-item-label').forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.borderColor = 'var(--primary-green)';
                label.style.background = '#f0fff4';
            });
            label.addEventListener('mouseleave', () => {
                if (!label.querySelector('input').checked) {
                    label.style.borderColor = '#edf2f7';
                    label.style.background = 'white';
                }
            });
            // Keep style if checked
            label.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    label.style.borderColor = 'var(--primary-green)';
                    label.style.background = '#f0fff4';
                } else {
                    label.style.borderColor = '#edf2f7';
                    label.style.background = 'white';
                }
            });
        });
    }

    if (userId) {
        // Edit mode
        title.textContent = 'Edit User';
        if (passwordOptional) passwordOptional.style.display = 'inline';
        if (passwordInput) passwordInput.removeAttribute('required');
        this.loadUserData(userId);
    } else {
        // Add mode
        title.textContent = 'Add New User';
        if (passwordOptional) passwordOptional.style.display = 'none';
        if (passwordInput) passwordInput.setAttribute('required', 'required');

        // Set default permissions for new employee
        this.setDefaultPermissions('employee');
    }

    // Show modal and overlay
    modal.style.display = 'block';
    overlay.style.display = 'block';
    modal.classList.add('active');
    overlay.classList.add('active');
    console.log('Modal should now be visible');
};

// Close user modal
AgroDistributionApp.prototype.closeUserModal = function () {
    const modal = document.getElementById('admin-user-modal');
    const overlay = document.getElementById('admin-user-modal-overlay');

    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
    }
};

// Load user data for editing
AgroDistributionApp.prototype.loadUserData = async function (userId) {
    try {
        const response = await this.apiCall(`/api/users/${userId}`);
        if (!response) return;

        const result = await response.json();

        if (result.success && result.data) {
            const user = result.data;

            document.getElementById('admin-user-id').value = user.id;
            document.getElementById('admin-user-name').value = user.name;
            document.getElementById('admin-user-username').value = user.username;
            document.getElementById('admin-user-role').value = user.role;
            document.getElementById('admin-user-blocked').checked = user.is_blocked === 1;

            // Set permissions
            let permissions = [];
            try {
                permissions = JSON.parse(user.permissions || '[]');
            } catch (e) {
                console.error('Error parsing permissions for user load', e);
                permissions = [];
            }

            permissions.forEach(perm => {
                const checkbox = document.querySelector(`.permission-checkbox[value="${perm}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    } catch (error) {
        console.error('Error loading user:', error);
        this.showNotification('Error loading user data', 'error');
    }
};

// Save user (create or update)
AgroDistributionApp.prototype.saveUser = async function (event) {
    event.preventDefault();

    const userId = document.getElementById('admin-user-id').value;
    const userData = {
        name: document.getElementById('admin-user-name').value,
        username: document.getElementById('admin-user-username').value,
        password: document.getElementById('admin-user-password').value,
        role: document.getElementById('admin-user-role').value,
        is_blocked: document.getElementById('admin-user-blocked').checked ? 1 : 0,
        permissions: JSON.stringify(this.getSelectedPermissions())
    };

    // Remove empty password for updates
    if (userId && !userData.password) {
        delete userData.password;
    }

    try {
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';

        const response = await this.apiCall(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (!response) return;

        const result = await response.json();

        if (result.success) {
            this.showNotification(userId ? 'User updated successfully' : 'User created successfully', 'success');
            this.closeUserModal();
            this.loadUsers();
        } else {
            this.showNotification(result.message || 'Failed to save user', 'error');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        this.showNotification('Error saving user', 'error');
    }
};

// Edit user
AgroDistributionApp.prototype.editUser = function (userId) {
    this.openUserModal(userId);
};

// Delete user
AgroDistributionApp.prototype.deleteUser = async function (userId, userName) {
    if (userId === 1) {
        this.showNotification('Cannot delete the main admin user', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete user "${userName}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await this.apiCall(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        if (!response) return;

        const result = await response.json();

        if (result.success) {
            this.showNotification('User deleted successfully', 'success');
            this.loadUsers();
        } else {
            this.showNotification('Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        this.showNotification('Error deleting user', 'error');
    }
};

// Toggle block/unblock user
AgroDistributionApp.prototype.toggleBlockUser = async function (userId, blockStatus) {
    const action = blockStatus ? 'block' : 'unblock';

    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    try {
        const response = await this.apiCall(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_blocked: blockStatus })
        });
        if (!response) return;

        const result = await response.json();

        if (result.success) {
            this.showNotification(`User ${action}ed successfully`, 'success');
            this.loadUsers();
        } else {
            this.showNotification(`Failed to ${action} user`, 'error');
        }
    } catch (error) {
        console.error(`Error ${action}ing user:`, error);
        this.showNotification(`Error ${action}ing user`, 'error');
    }
};

// Force logout user
AgroDistributionApp.prototype.forceLogoutUser = async function (userId) {
    if (!confirm('Force logout this user? They will need to log in again.')) {
        return;
    }

    try {
        const response = await this.apiCall(`/api/users/${userId}/force-logout`, {
            method: 'POST'
        });
        if (!response) return;

        const result = await response.json();

        if (result.success) {
            this.showNotification('User logged out successfully', 'success');
            this.loadUsers();
        } else {
            this.showNotification('Failed to logout user', 'error');
        }
    } catch (error) {
        console.error('Error forcing logout:', error);
        this.showNotification('Error forcing logout', 'error');
    }
};

// Get selected permissions
AgroDistributionApp.prototype.getSelectedPermissions = function () {
    const checkboxes = document.querySelectorAll('.permission-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
};

// Select all permissions
AgroDistributionApp.prototype.selectAllPermissions = function () {
    document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = true);
};

// Clear all permissions
AgroDistributionApp.prototype.clearAllPermissions = function () {
    document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = false);
};

// Set default permissions based on role
AgroDistributionApp.prototype.setDefaultPermissions = function (role) {
    // Clear all first
    this.clearAllPermissions();

    if (role === 'admin') {
        // Admin gets all permissions
        this.selectAllPermissions();
    } else if (role === 'employee') {
        // Employee gets basic permissions
        const employeePerms = [
            'products:view',
            'customers:view',
            'suppliers:view',
            'sales:view',
            'sales:create',
            'payments:view',
            'payments:create',
            'quick_actions:visit',
            'quick_actions:payment',
            'quick_actions:product',
            'quick_actions:customer',
            'quick_actions:sale',
            'quick_actions:expense',
            'quick_actions:products',
            'quick_actions:customers',
            'quick_actions:suppliers'
        ];
        employeePerms.forEach(perm => {
            const checkbox = document.querySelector(`.permission-checkbox[value="${perm}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
};

// Toggle all permissions
AgroDistributionApp.prototype.toggleAllPermissions = function () {
    const checkboxes = document.querySelectorAll('.permission-checkbox');
    const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
    checkboxes.forEach(cb => cb.checked = anyUnchecked);
};

// On role change in modal
AgroDistributionApp.prototype.onRoleChange = function () {
    const role = document.getElementById('admin-user-role').value;
    const userId = document.getElementById('admin-user-id').value;

    // Only auto-set permissions for new users
    if (!userId) {
        this.setDefaultPermissions(role);
    }
};

// HTML escape function
AgroDistributionApp.prototype.escapeHtml = function (text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};
