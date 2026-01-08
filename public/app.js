// ========================================
// AGRO DISTRIBUTION SYSTEM - MAIN APP
// ========================================

class AgroDistributionApp {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.charts = {};
        this.currentView = 'dashboard';

        // ... previous PERMISSIONS definition ...
        this.PERMISSIONS = {
            'products': ['view', 'create', 'edit', 'delete'],
            'customers': ['view', 'create', 'edit', 'delete'],
            'suppliers': ['view', 'create', 'edit', 'delete'],
            'sales': ['view', 'create', 'edit'],
            'payments': ['view', 'create', 'edit', 'delete'],
            'visits': ['view', 'create', 'edit'],
            'logs': ['view'],
            'admin': ['manage_users', 'view_reports', 'manage_settings'],
            'categories': ['view', 'create', 'edit', 'delete'],
            'brands': ['view', 'create', 'edit', 'delete'],
            'units': ['view', 'create', 'edit', 'delete'],
            'expenses': ['view', 'create', 'edit', 'delete'],
            'distribution': ['view', 'create', 'edit', 'delete'],
            'pre-orders': ['view', 'create', 'edit', 'delete'],
            'rma': ['view', 'create', 'edit', 'process'],
            'quick_actions': ['visit', 'payment', 'product', 'customer', 'dbtools', 'sale', 'expense', 'products', 'customers', 'suppliers', 'distribution', 'reports', 'settings']
        };

        // ... remaining constructor code ...
        // ... (preserving session config and other initializations)
        this.sessionSeconds = 600;
        this.remainingSeconds = 600;
        this.timerInterval = null;
        this.calculationHistory = [];
        this.calcExpression = '';
        this.productPage = 1;
        this.customerPage = 1;
        this.supplierPage = 1;
        this.logoutProcessing = false;
        this.dashboardEditMode = false;
        this.dragSource = null;

        // POS State
        this.posState = {
            cart: [],
            selectedLoadId: null,
            products: [],
            customers: [],
            heldInvoices: [],
            currentInvoiceId: null, // used when recalling a held invoice
            tempCheques: [],
            selectedCustomerId: null,
            customerDiscounts: {} // Stores {productId: {percentage, amount}}
        };
        this.collectionCheques = []; // For the Payment modal

        this.quickActions = [
            { id: 'visit', label: 'Create Visit Log', icon: 'fas fa-file-invoice', action: 'app.openVisitModal()', color: 'blue', type: 'function', visible: true, isSystem: true, permission: 'quick_actions:visit' },
            { id: 'payment', label: 'Collect Payment', icon: 'fas fa-cash-register', action: 'app.openPaymentModal()', color: 'green', type: 'function', visible: true, isSystem: true, permission: 'quick_actions:payment' },
            { id: 'product', label: 'Add Product', icon: 'fas fa-box-open', action: 'app.openProductModal()', color: 'orange', type: 'function', visible: true, isSystem: true, permission: 'quick_actions:product' },
            { id: 'customer', label: 'Manage Customers', icon: 'fas fa-users', action: "app.navigateTo('customers')", color: 'purple', type: 'function', visible: true, isSystem: true, permission: 'quick_actions:customer' },
            { id: 'dbtools', label: 'Database Tools', icon: 'fas fa-database', action: 'app.openDatabaseTools()', color: 'indigo', type: 'function', visible: true, isSystem: true, permission: 'quick_actions:dbtools' }
        ];
        this.savedQueries = [];

        window.logout = () => this.logout();
        window.openLogoutModal = (e) => this.openLogoutModal(e);

        this.init();
    }

    async apiCall(url, options = {}) {
        try {
            // Add Authorization header
            if (this.token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${this.token}`
                };
            }



            const response = await fetch(url, options);
            if (response.status === 401) {
                if (!url.includes('/api/auth/logout')) {
                    this.logout('Your session has expired or is invalid. Please log in again.');
                }
                return null;
            }
            return response;
        } catch (error) {
            alert('Network or Server Error: ' + error.message);
            throw error;
        }
    }



    // ==========================================
    // DASHBOARD CUSTOMIZATION (Drag & Drop)
    // ==========================================
    toggleDashboardEditMode() {
        this.dashboardEditMode = !this.dashboardEditMode;
        const icon = document.getElementById('layout-icon');
        const container = document.getElementById('dashboard-view');

        if (this.dashboardEditMode) {
            this.showNotification('Edit Mode Enabled: Drag items to rearrange', 'info');
            if (icon) {
                icon.classList.remove('fa-arrows-alt');
                icon.classList.add('fa-check');
                document.getElementById('layout-toggle').title = "Save Layout";
                document.getElementById('layout-toggle').style.background = "#e0f2fe";
            }
            container.classList.add('edit-mode-active');

            // Enable Dragging
            this.enableDragAndDrop('dashboard-kpi-grid');
            this.enableDragAndDrop('dashboard-grid-1');
            this.enableDragAndDrop('dashboard-grid-2');
        } else {
            // Save & Disable
            this.saveDashboardLayout();
            this.showNotification('Layout Saved Successfully', 'success');
            if (icon) {
                icon.classList.remove('fa-check');
                icon.classList.add('fa-arrows-alt');
                document.getElementById('layout-toggle').title = "Edit Dashboard Layout";
                document.getElementById('layout-toggle').style.background = "transparent";
            }
            container.classList.remove('edit-mode-active');

            // Disable Dragging
            this.disableDragAndDrop('dashboard-kpi-grid');
            this.disableDragAndDrop('dashboard-grid-1');
            this.disableDragAndDrop('dashboard-grid-2');
        }
    }

    enableDragAndDrop(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        Array.from(container.children).forEach(child => {
            child.setAttribute('draggable', 'true');
            child.classList.add('draggable-item');

            // Bind listeners (and store ref to remove later if needed, but for now simple add/remove is enough if we handle cleanly)
            // We use generic named handlers bound to 'this' in constructor or simply arrow functions here
            // To properly remove listeners, we'd need named functions. For simplicity in this SPA, 
            // checking 'dashboardEditMode' inside the handler is easier, OR we just replace the node to strip listeners.
            // Let's go with checking listeners attached once.

            if (!child.dataset.hasDragListeners) {
                child.addEventListener('dragstart', (e) => this.handleDragStart(e));
                child.addEventListener('dragover', (e) => this.handleDragOver(e));
                child.addEventListener('drop', (e) => this.handleDrop(e));
                child.addEventListener('dragenter', (e) => this.handleDragEnter(e));
                child.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                child.dataset.hasDragListeners = 'true';
            }
        });
    }

    disableDragAndDrop(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        Array.from(container.children).forEach(child => {
            child.setAttribute('draggable', 'false');
            child.classList.remove('draggable-item');
        });
    }

    handleDragStart(e) {
        if (!this.dashboardEditMode) {
            e.preventDefault();
            return;
        }
        this.dragSource = e.currentTarget; // The element being dragged
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.currentTarget.id);
        e.currentTarget.classList.add('dragging');
    }

    handleDragOver(e) {
        if (!this.dashboardEditMode) return;
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDragEnter(e) {
        if (!this.dashboardEditMode) return;
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e) {
        if (!this.dashboardEditMode) return;
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;
        const source = this.dragSource;

        target.classList.remove('drag-over');
        if (source) source.classList.remove('dragging');

        // Only swap if same container (parent)
        if (source !== target && source.parentNode === target.parentNode) {
            // Swap logic: Insert source before target, or after
            // Simplest visual swap: just insertBefore. 
            // If dragging down, insert after target.
            // Check index
            const container = source.parentNode;
            const children = Array.from(container.children);
            const sourceIndex = children.indexOf(source);
            const targetIndex = children.indexOf(target);

            if (sourceIndex < targetIndex) {
                // Dragging down: insert after target
                container.insertBefore(source, target.nextSibling);
            } else {
                // Dragging up: insert before target
                container.insertBefore(source, target);
            }
        }

        return false;
    }

    saveDashboardLayout() {
        const layout = {
            kpi: this.getContainerOrder('dashboard-kpi-grid'),
            grid1: this.getContainerOrder('dashboard-grid-1'),
            grid2: this.getContainerOrder('dashboard-grid-2')
        };
        localStorage.setItem('dashboardLayout', JSON.stringify(layout));
    }

    getContainerOrder(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];
        return Array.from(container.children).map(child => child.id).filter(id => id); // Only save items with IDs
    }

    loadDashboardLayout() {
        const saved = localStorage.getItem('dashboardLayout');
        if (!saved) return;

        try {
            const layout = JSON.parse(saved);
            this.reorderContainer('dashboard-kpi-grid', layout.kpi);
            this.reorderContainer('dashboard-grid-1', layout.grid1);
            this.reorderContainer('dashboard-grid-2', layout.grid2);
        } catch (e) {
            console.error('Failed to load dashboard layout', e);
        }
    }

    reorderContainer(containerId, orderArray) {
        if (!orderArray || !orderArray.length) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Create a map of existing elements
        const elements = {};
        Array.from(container.children).forEach(child => {
            if (child.id) elements[child.id] = child;
        });

        // Loop through saved order and append in that sequence
        orderArray.forEach(id => {
            if (elements[id]) {
                container.appendChild(elements[id]); // Moves it to the end, effectively recording
            }
        });
    }

    getLocalDateISO() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    formatCurrency(amount) {
        return 'LKR ' + new Intl.NumberFormat('en-LK', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }

    /**
     * Parse date string from SQLite/Server consistently
     * Handles YYYY-MM-DD (DATE) and YYYY-MM-DD HH:MM:SS (UTC DATETIME)
     */
    parseDBDate(str) {
        if (!str) return null;
        if (str === 'Never' || str === 'N/A') return null;

        // Handle YYYY-MM-DD (DATE column) - treat as local date
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        // Handle YYYY-MM-DD HH:MM:SS (SQLite DATETIME - UTC)
        // Convert to ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
        if (str.includes(' ') && !str.includes('T') && !str.includes('Z')) {
            return new Date(str.replace(' ', 'T') + 'Z');
        }

        return new Date(str);
    }

    async init() {
        try {
            // CRITICAL: Wait for server-side auth verification before proceeding
            await this.checkAuth();
            if (!this.currentUser) return; // Stop if redirecting
        } catch (e) {
            console.error('Initial auth check failed:', e);
            return;
        }



        try {
            this.initTheme();
            this.initFontSize();
            this.loadDashboardLayout(); // Load saved dashboard layout
        } catch (e) {
            console.error('Theme or Font init failed:', e);
        }

        try {
            this.initSessionTimer();
        } catch (e) {
            console.error('Timer init failed:', e);
        }

        try {
            this.setupEventListeners();
        } catch (e) {
            console.error('Event listeners init failed:', e);
        }

        // Load Quick Actions
        try {
            await this.loadQuickActions();
        } catch (e) {
            console.warn('Quick actions load failed:', e);
            this.renderQuickActions(); // render defaults
        }

        // Final UI reveal - even if something failed above, try to show what we have
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.style.display = 'flex';

        this.initConnectivityCheck();
        this.loadInitialCompanyConfig();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);

        // Periodic Session Validation (every 15s)
        // This ensures kicked users are redirected even if idle
        setInterval(() => this.validateSession(), 15000);

        this.handleRouting();
        window.addEventListener('popstate', () => this.handleRouting());
    }

    async validateSession() {
        if (!this.token) return;
        try {
            // apiCall handles 401 -> logout automatically
            await this.apiCall('/api/auth/me');
        } catch (e) {
            // Network errors are ignored here to prevent nuisance alerts
            console.warn('Session validation warning:', e.message);
        }
    }

    initConnectivityCheck() {
        const dot = document.querySelector('.status-dot');
        const text = document.getElementById('connection-status');

        const updateStatus = () => {
            if (navigator.onLine) {
                if (dot) {
                    dot.classList.remove('offline');
                    dot.classList.add('online');
                }
                if (text) text.textContent = 'Online';
                this.showNotification('Connection Restored', 'success');
            } else {
                if (dot) {
                    dot.classList.remove('online');
                    dot.classList.add('offline');
                }
                if (text) text.textContent = 'Offline';
                this.showNotification('You are currently offline', 'error');
            }
        };

        // Initial set
        if (dot) {
            dot.classList.add(navigator.onLine ? 'online' : 'offline');
        }

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
    }

    hasPermission(module, action) {
        if (!this.currentUser) return false;
        // Admins have full access implicitly or explicit 'admin' role
        if (this.currentUser.role === 'admin') return true;

        // Check granular permissions
        // permissions are stored as array of strings "module:action"
        if (!this.currentUser._parsedPermissions) {
            try {
                this.currentUser._parsedPermissions = JSON.parse(this.currentUser.permissions || '[]');
            } catch (e) {
                this.currentUser._parsedPermissions = (this.currentUser.permissions || '').split(',');
            }
        }

        return this.currentUser._parsedPermissions.includes(`${module}:${action}`);
    }

    async checkAuth() {
        // 1. Check for token existence
        if (!this.token) {
            console.warn('No token found, redirecting to login.');
            window.location.replace('/');
            return;
        }

        // 2. Immediate verification with server
        try {
            const res = await this.apiCall('/api/auth/me');
            if (!res || res.status === 401) {
                // apiCall handles 401, but we return to stop execution
                return;
            }
            const data = await res.json();
            if (data.success) {
                this.currentUser = data.user;
                // Cache user info ONLY for UI display, never for auth decisions
                localStorage.setItem('user', JSON.stringify(data.user));
            } else {
                throw new Error('Server returned unsuccessful auth status');
            }
        } catch (e) {
            console.error('Authentication verification failed:', e.message);
            this.logout('Security verification failed. Please login again.');
            return;
        }

        // Parse permissions once
        try {
            this.currentUser._parsedPermissions = JSON.parse(this.currentUser.permissions || '[]');
        } catch (e) {
            this.currentUser._parsedPermissions = (this.currentUser.permissions || '').split(',');
        }

        // Update User Profiles (Header & Sidebar)
        const name = this.currentUser?.name || 'Local User';
        const initials = name.substring(0, 2).toUpperCase();
        const role = this.currentUser?.role || 'user';

        // Toggle Admin Body Class
        if (role === 'admin') {
            document.body.classList.add('user-admin');
        } else {
            document.body.classList.remove('user-admin');
        }

        // Header Profile
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) headerAvatar.textContent = initials;
        const headerName = document.getElementById('user-display-name');
        if (headerName) headerName.textContent = name;
        const headerRole = document.getElementById('user-display-role');
        if (headerRole) headerRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);



        // --- APPLY PERMISSIONS TO UI ---

        // 1. Sidebar Navigation Hiding
        const navMap = {
            'products': ['product-submenu'], // Parent menu
            'customers': ['customers'],
            'suppliers': ['suppliers'],
            'sales': ['sales'],
            'payments': ['payments'],
            'visits': ['distribution-submenu'], // Parent menu
            'admin': ['admin'],
            'logs': ['logs']
        };

        // Reset all first
        document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'block');

        // Check specific modules
        if (!this.hasPermission('products', 'view')) {
            const link = document.querySelector('[data-target="product-submenu"]');
            if (link) link.closest('.nav-item').style.display = 'none';
        }
        if (!this.hasPermission('visits', 'view')) {
            const link = document.querySelector('[data-target="distribution-submenu"]');
            if (link) link.closest('.nav-item').style.display = 'none';
        }

        // Master Data Submenu Items Hiding
        ['categories', 'brands', 'units'].forEach(page => {
            if (!this.hasPermission(page, 'view')) {
                const link = document.querySelector(`.nav-link[data-page="${page}"]`);
                if (link) link.parentElement.style.display = 'none';
            }
        });

        // Direct links
        // Direct links & Submenus
        ['customers', 'suppliers', 'sales', 'payments', 'admin', 'logs'].forEach(module => {
            if (!this.hasPermission(module, 'view') && !(module === 'admin' && role === 'admin')) {
                const link = document.querySelector(`.nav-link[data-page="${module}"]`);
                if (link) {
                    if (link.classList.contains('submenu-link')) {
                        link.parentElement.style.display = 'none';
                    } else {
                        link.closest('.nav-item').style.display = 'none';
                    }
                }
            }
        });

        // 2. Action Buttons (Add New...)
        const btnMap = {
            'add-product-btn': ['products', 'create'],
            'add-customer-btn': ['customers', 'create'],
            'add-supplier-btn': ['suppliers', 'create'],
            'add-payment-btn': ['payments', 'create'],
            'add-visit-btn': ['visits', 'create']
        };

        // Special check for Master Data Add Button (shared button)
        // We only show it if the user has 'create' permission for the CURRENT master view
        const MasterMap = {
            'categories': ['categories', 'create'],
            'brands': ['brands', 'create'],
            'units': ['units', 'create']
        };
        const masterBtn = document.getElementById('add-master-btn');
        if (masterBtn) {
            // Default hide, will be shown by loadView/Master loading logic if valid
            // But we can set a general rule here or let the view loader handle it.
            // For now, let's leave it to loadMasterData to toggle, 
            // but we ensure it's hidden if NO create permissions exist at all?
            // Simpler: Just rely on loadMasterData to show/hide it.
            masterBtn.style.display = 'none';
        }

        for (const [btnId, [module, action]] of Object.entries(btnMap)) {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.style.display = this.hasPermission(module, action) ? 'flex' : 'none';
            }
        }

        // 3. Quick Actions in Welcome Banner (Restricting hardcoded actions)
        const qaMap = {
            'sale': ['quick_actions', 'sale'],
            'payment': ['quick_actions', 'payment'],
            'expense': ['quick_actions', 'expense'],
            'products': ['quick_actions', 'products'],
            'customers': ['quick_actions', 'customers'],
            'suppliers': ['quick_actions', 'suppliers'],
            'distribution': ['quick_actions', 'distribution'],
            'reports': ['quick_actions', 'reports'],
            'settings': ['quick_actions', 'settings']
        };

        document.querySelectorAll('#quick-actions-grid [data-action]').forEach(btn => {
            const action = btn.dataset.action;
            if (qaMap[action]) {
                const [mod, act] = qaMap[action];
                const hasPerm = this.hasPermission(mod, act);
                if (!hasPerm) {
                    btn.style.setProperty('display', 'none', 'important');
                    btn.classList.add('perm-hidden'); // Mark for other scripts
                }
            }
        });

        // Hide Customize button if not admin or lacks management permission
        const customizeBtn = document.getElementById('toggle-actions-btn');
        if (customizeBtn && !this.hasPermission('admin', 'manage_settings')) {
            customizeBtn.style.display = 'none';
        }
    }

    // --- THEME LOGIC ---
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            const icon = document.getElementById('theme-icon');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const icon = document.getElementById('theme-icon');
        if (icon) {
            if (isDark) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.add('fa-moon');
            }
        }
    }

    toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.warn(`Error attempting to enable full-screen mode: ${e.message} (${e.name})`);
            });
            const icon = document.getElementById('fullscreen-icon');
            if (icon) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            }
            const btn = document.getElementById('fullscreen-toggle');
            if (btn) btn.title = "Exit Full Screen";
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                const icon = document.getElementById('fullscreen-icon');
                if (icon) {
                    icon.classList.remove('fa-compress');
                    icon.classList.add('fa-expand');
                }
                const btn = document.getElementById('fullscreen-toggle');
                if (btn) btn.title = "Toggle Full Screen";
            }
        }
    }

    // --- FONT SIZE LOGIC ---
    initFontSize() {
        const savedSize = localStorage.getItem('system_font_size') || '100';
        this.applyFontSize(savedSize);
    }

    applyFontSize(percent) {
        const size = (parseInt(percent) / 100) * 16;
        document.documentElement.style.fontSize = `${size}px`;

        // Update UI if on settings page
        const slider = document.getElementById('setting-font-size');
        const label = document.getElementById('font-size-label');
        if (slider) slider.value = percent;
        if (label) label.textContent = `${percent}%`;
    }

    previewFontSize(val) {
        this.applyFontSize(val);
    }

    resetFontSize() {
        this.applyFontSize('100');
    }

    // --- SESSION TIMER LOGIC ---
    initSessionTimer() {
        // IMPORTANT: Auto-disable timer for Administrator/admin users
        const userRole = this.currentUser?.role?.toLowerCase();
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (isAdmin) {
            // Administrators don't need session timeout
            if (this.timerInterval) clearInterval(this.timerInterval);
            const container = document.getElementById('timer-container');
            if (container) container.style.display = 'none';
            console.log('Session timer disabled for Administrator');
            return;
        }

        // For non-admin users, check if timer is enabled
        const timerEnabled = localStorage.getItem('timer_enabled') !== 'false'; // Default true
        if (!timerEnabled) {
            if (this.timerInterval) clearInterval(this.timerInterval);
            const container = document.getElementById('timer-container');
            if (container) container.style.display = 'none';
            return;
        } else {
            const container = document.getElementById('timer-container');
            if (container) container.style.display = 'flex';
        }

        // 1. Get timeout duration (default 10)
        const savedTimeout = localStorage.getItem('session_timeout') || '10';
        this.sessionSeconds = parseInt(savedTimeout) * 60;

        // 2. Check for an existing session expiry timestamp
        let expiry = localStorage.getItem('session_expiry');
        const now = Date.now();

        if (!expiry) {
            // New session: Set expiry to (now + timeout)
            expiry = now + (this.sessionSeconds * 1000);
            localStorage.setItem('session_expiry', expiry);
        }

        // 3. Calculate remaining seconds
        this.remainingSeconds = Math.max(0, Math.floor((parseInt(expiry) - now) / 1000));

        if (this.remainingSeconds <= 0) {
            this.logout('Session has expired.');
            return;
        }

        this.startCountdown();
    }

    startCountdown() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const now = Date.now();
            const expiry = parseInt(localStorage.getItem('session_expiry'));
            this.remainingSeconds = Math.max(0, Math.floor((expiry - now) / 1000));

            this.updateTimerDisplay();

            if (this.remainingSeconds <= 0) {
                const timeoutMins = Math.floor(parseInt(localStorage.getItem('session_timeout') || '10'));
                this.logout(`Your ${timeoutMins}-minute session has ended.`);
            }
        }, 1000);
    }

    resetTimer() {
        this.remainingSeconds = this.sessionSeconds;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const el = document.getElementById('session-timer');
        if (!el) return;
        const mins = Math.floor(this.remainingSeconds / 60);
        const secs = this.remainingSeconds % 60;
        el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        // Warning state
        const container = document.getElementById('timer-container');
        if (this.remainingSeconds < 60) {
            container.style.background = 'rgba(244, 67, 54, 0.2)';
            container.style.color = '#B71C1C'; // Deeper red for warning
            container.style.fontWeight = 'bold';
        } else {
            container.style.background = 'rgba(244, 67, 54, 0.1)';
            container.style.color = '#F44336';
        }
    }

    async openLogoutModal(e) {
        console.log('Logout button clicked - Opening modal...');
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const modal = document.getElementById('confirm-modal');
        if (modal) {
            console.log('Confirm modal found. Forcing visibility...');
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.setProperty('opacity', '1', 'important');
            modal.style.setProperty('visibility', 'visible', 'important');
            modal.style.setProperty('z-index', '10000', 'important');
            modal.classList.add('active');
        } else {
            console.warn('Confirm modal NOT found in DOM! Falling back to browser confirm.');
            if (confirm('Are you sure you want to end your session?')) {
                this.logout();
            }
        }
    }

    handleManualLogout(e) {
        this.openLogoutModal(e);
    }

    async logout(msg = null) {
        if (this.logoutProcessing) return;
        this.logoutProcessing = true;

        console.log('Logout sequence initiated...');
        if (msg) alert(msg);

        // Notify server
        try {
            if (this.token) {
                await this.apiCall('/api/auth/logout', { method: 'POST' });
            }
        } catch (e) {
            console.error('Server logout failed (network issue?)', e);
        }

        // Explicitly remove user data and token
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        this.token = null;

        // Clear remaining session data
        localStorage.clear();
        sessionStorage.clear();
        console.log('Storage cleared.');

        // Halt timer
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Use replace() instead of href to prevent back navigation
        console.log('Redirecting to login...');
        window.location.replace('/login');
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-menu .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.id === 'logout-btn') return;

                if (link.classList.contains('has-submenu')) {
                    e.preventDefault();
                    this.toggleSubmenu(link);
                } else {
                    const page = link.dataset.page;
                    if (page) {
                        e.preventDefault();
                        this.navigateTo(page, true);
                        // Close sidebar on mobile after navigation
                        if (window.innerWidth <= 1024) {
                            const sidebar = document.getElementById('sidebar');
                            const overlay = document.getElementById('sidebar-overlay');
                            sidebar?.classList.remove('active');
                            sidebar?.classList.add('collapsed');
                            overlay?.classList.remove('active');
                        }
                    }
                }
            });
        });

        // Profile/Navigation Listeners
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleManualLogout(e);
            });
        }

        const confirmYesBtn = document.getElementById('confirm-logout-yes');
        if (confirmYesBtn) {
            confirmYesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        document.getElementById('nav-settings-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateTo('settings');
        });

        // Profile Dropdown Click Toggle
        const profileDropdown = document.querySelector('.profile-dropdown');
        if (profileDropdown) {
            profileDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('active');
            });
        }

        // Notification Toggle
        const notifToggle = document.getElementById('notification-toggle');
        if (notifToggle) {
            notifToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                notifToggle.classList.toggle('active');
            });

            // Mark all read logic (frontend simulation)
            const markAllRead = notifToggle.querySelector('.mark-all-read');
            if (markAllRead) {
                markAllRead.addEventListener('click', (e) => {
                    e.stopPropagation();
                    notifToggle.querySelectorAll('.notification-item').forEach(item => item.classList.remove('unread'));
                    const badge = document.getElementById('notification-badge');
                    if (badge) badge.style.display = 'none';
                });
            }

            // NEW: Clear all notifications logic
            const clearAll = document.getElementById('clear-notifications');
            if (clearAll) {
                clearAll.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const list = document.getElementById('notification-list');
                    if (list) {
                        list.innerHTML = '<div style="padding: 2rem; text-align: center; color: #94a3b8;"><i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>No new notifications</div>';
                    }
                    const badge = document.getElementById('notification-badge');
                    if (badge) badge.style.display = 'none';
                });
            }
        }

        // Close dropdown when clicking anywhere else
        window.addEventListener('click', (e) => {
            profileDropdown?.classList.remove('active');
            notifToggle?.classList.remove('active');

            // Hide load search results
            if (!e.target.closest('.search-box')) {
                const loadResults = document.getElementById('load-search-results');
                if (loadResults) loadResults.style.display = 'none';
            }
        });

        // Sidebar Toggle Logic
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebarToggle = document.getElementById('sidebar-toggle');

        if (sidebarToggle) {
            sidebarToggle.onclick = (e) => {
                e.stopPropagation();
                const isMobile = window.innerWidth <= 1024;

                if (isMobile) {
                    const isActive = sidebar.classList.toggle('active');
                    overlay.classList.toggle('active', isActive);
                    // On mobile, 'collapsed' is just the off-screen state
                    sidebar.classList.toggle('collapsed', !isActive);
                } else {
                    // Desktop behavior
                    const isCollapsed = sidebar.classList.toggle('collapsed');
                    mainContent.classList.toggle('expanded', isCollapsed);
                }
            };
        }

        if (overlay) {
            overlay.onclick = () => {
                sidebar.classList.remove('active');
                sidebar.classList.add('collapsed');
                mainContent.classList.remove('expanded');
                overlay.classList.remove('active');
            };
        }

        // Close sidebar when clicking links on mobile
        document.querySelectorAll('.nav-menu .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.id === 'logout-btn' || link.classList.contains('has-submenu')) return;

                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('active');
                    sidebar.classList.add('collapsed');
                    overlay.classList.remove('active');
                }
            });
        });

        // Swipe Gestures for Sidebar
        let touchStartX = 0;
        let touchEndX = 0;

        // POS Event Listeners (Restored)
        document.getElementById('pos-product-search')?.addEventListener('input', (e) => {
            if (this.posState.products) {
                this.renderProductTiles(this.filterPOSProducts(e.target.value));
            }
        });

        document.getElementById('pos-load-selector')?.addEventListener('change', async (e) => {
            const loadId = e.target.value;
            if (loadId) {
                this.posState.selectedLoadId = loadId;
                await this.loadTruckStock(loadId);
            } else {
                this.posState.selectedLoadId = null;
                this.posState.products = [];
                this.renderProductTiles([]);
            }
        });

        // Customer Intelligence Search
        document.getElementById('ci-table-search')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#ci-table-body tr');
            rows.forEach(row => {
                const name = row.cells[0]?.innerText.toLowerCase();
                if (name && name.includes(term)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });

        document.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const swipeDistance = touchEndX - touchStartX;

            if (window.innerWidth <= 1024) {
                // Swipe Right to Open
                if (swipeDistance > 100 && touchStartX < 50) {
                    sidebar.classList.add('active');
                    sidebar.classList.remove('collapsed');
                    overlay.classList.add('active');
                }
                // Swipe Left to Close
                if (swipeDistance < -100 && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    sidebar.classList.add('collapsed');
                    overlay.classList.remove('active');
                }
            }
        }, { passive: true });


        // Payment Method Toggle
        document.getElementById('pay-method')?.addEventListener('change', (e) => {
            document.getElementById('cheque-details-section').style.display = e.target.value === 'cheque' ? 'block' : 'none';
        });

        // Global Modal Closer (Replaces old closeModal method)
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    // EXEMPTION: Do not close important forms on outside click to prevent data loss
                    const protectedModals = [
                        'product-modal', 'customer-modal', 'supplier-modal', 'vehicle-modal',
                        'master-modal', 'visit-modal', 'unload-modal', 'load-modal',
                        'pos-payment-modal', 'expense-modal', 'payment-modal', 'cheque-status-modal',
                        'rma-modal', 'rma-inspect-modal'
                    ];
                    if (protectedModals.includes(overlay.id)) return;

                    overlay.classList.remove('active');
                    overlay.style.display = 'none';
                }
            });
            overlay.querySelectorAll('.close-modal').forEach(btn => {
                btn.addEventListener('click', () => {
                    overlay.classList.remove('active');
                    overlay.style.display = 'none';
                });
            });
        });

        // Image Handling
        document.getElementById('p-image-file')?.addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('p-image-manual')?.addEventListener('input', (e) => this.updatePreview(e.target.value));
        document.getElementById('clear-image-btn')?.addEventListener('click', () => {
            document.getElementById('p-image-url').value = '';
            document.getElementById('p-image-manual').value = '';
            document.getElementById('p-image-file').value = '';
            this.updatePreview('');
        });

        // Vehicle Image Handling
        document.getElementById('v-image-file')?.addEventListener('change', (e) => this.handleVehicleImageUpload(e));

        // Auto-calculate Cost
        document.getElementById('p-msrp')?.addEventListener('input', () => this.autoCalculateCost());
        document.getElementById('p-discount')?.addEventListener('input', () => this.autoCalculateCost());

        // Forms
        document.getElementById('product-form')?.addEventListener('submit', (e) => this.handleProductSubmit(e));
        document.getElementById('save-new-product-btn')?.addEventListener('click', (e) => this.handleProductSubmit(e, true));

        document.getElementById('master-form')?.addEventListener('submit', (e) => this.handleMasterSubmit(e));
        document.getElementById('supplier-form')?.addEventListener('submit', (e) => this.handleSupplierSubmit(e));
        document.getElementById('save-new-supplier-btn')?.addEventListener('click', (e) => this.handleSupplierSubmit(e, true));
        document.getElementById('customer-form')?.addEventListener('submit', (e) => this.handleCustomerSubmit(e));
        document.getElementById('payment-form')?.addEventListener('submit', (e) => this.handlePaymentSubmit(e));
        document.getElementById('visit-form')?.addEventListener('submit', (e) => this.handleVisitSubmit(e));
        document.getElementById('user-form')?.addEventListener('submit', (e) => this.handleUserSubmit(e));
        document.getElementById('vehicle-form')?.addEventListener('submit', (e) => this.handleVehicleSubmit(e));
        document.getElementById('load-form')?.addEventListener('submit', (e) => this.handleLoadSubmit(e));
        document.getElementById('unload-form')?.addEventListener('submit', (e) => this.handleUnloadSubmit(e));

        // Add Buttons
        document.getElementById('add-product-btn')?.addEventListener('click', () => this.openProductModal());
        document.getElementById('add-master-btn')?.addEventListener('click', () => this.openMasterModal());
        document.getElementById('add-supplier-btn')?.addEventListener('click', () => this.openSupplierModal());
        document.getElementById('add-customer-btn')?.addEventListener('click', () => this.openCustomerModal());
        document.getElementById('add-payment-btn')?.addEventListener('click', () => this.openPaymentModal());
        document.getElementById('add-visit-btn')?.addEventListener('click', () => this.openVisitModal());
        document.getElementById('add-vehicle-btn')?.addEventListener('click', () => this.openVehicleModal());
        document.getElementById('add-expense-btn')?.addEventListener('click', () => this.openExpenseModal());
        document.getElementById('expense-form')?.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
        document.getElementById('rma-form')?.addEventListener('submit', (e) => this.handleRmaSubmit(e));
        document.getElementById('rma-status-form')?.addEventListener('submit', (e) => this.handleRmaStatusUpdate(e));



        document.getElementById('product-search')?.addEventListener('input', (e) => this.handleProductSearch(e.target.value));
        document.getElementById('customer-search')?.addEventListener('input', (e) => this.loadCustomers(e.target.value));
        document.getElementById('supplier-search')?.addEventListener('input', (e) => this.loadSuppliers(e.target.value));

        // Settings
        document.getElementById('change-password-form')?.addEventListener('submit', (e) => this.handlePasswordChange(e));
        document.getElementById('setting-timer-enabled')?.addEventListener('change', (e) => {
            const timeoutInput = document.getElementById('setting-timeout');
            if (timeoutInput) timeoutInput.disabled = !e.target.checked;
        });
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());

        // Backup Settings Toggle
        document.getElementById('backup-enabled-toggle')?.addEventListener('change', (e) => {
            const fields = document.getElementById('backup-config-fields');
            const statusText = document.getElementById('backup-status-text');
            if (statusText) statusText.textContent = e.target.checked ? 'Enabled' : 'Disabled';
            if (fields) {
                fields.style.opacity = e.target.checked ? '1' : '0.5';
                fields.style.pointerEvents = e.target.checked ? 'auto' : 'none';
            }
        });

        // Product Import/Export
        document.getElementById('export-excel-btn')?.addEventListener('click', () => this.exportProductsToExcel());
        document.getElementById('export-pdf-btn')?.addEventListener('click', () => this.exportProductsToPDF());
        document.getElementById('import-excel-btn')?.addEventListener('click', () => document.getElementById('product-import-file').click());
        document.getElementById('product-import-file')?.addEventListener('change', (e) => this.handleProductImport(e));
        // Supplier Import/Export
        document.getElementById('supplier-export-excel-btn')?.addEventListener('click', () => this.exportSuppliersToExcel());
        document.getElementById('supplier-export-pdf-btn')?.addEventListener('click', () => this.exportSuppliersToPDF());
        document.getElementById('supplier-import-excel-btn')?.addEventListener('click', () => document.getElementById('supplier-import-file').click());
        document.getElementById('supplier-import-file')?.addEventListener('change', (e) => this.handleSupplierImport(e));

        // Delegate Edit/Delete for Suppliers (more reliable than onclick)
        document.getElementById('supplier-table-body')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit');
            const delBtn = e.target.closest('.btn-delete');
            if (editBtn) {
                const s = JSON.parse(decodeURIComponent(editBtn.dataset.supplier));
                this.openSupplierModal(s);
            }
            if (delBtn) {
                const id = delBtn.dataset.id;
                const name = decodeURIComponent(delBtn.dataset.name);
                this.handleDelete('suppliers', id, name);
            }
        });
        // Company Profile Settings
        document.getElementById('company-settings-form')?.addEventListener('submit', (e) => this.handleCompanySubmit(e));
        document.getElementById('comp-logo-file')?.addEventListener('change', (e) => this.handleCompanyFileUpload(e, 'logo'));
        document.getElementById('comp-favicon-file')?.addEventListener('change', (e) => this.handleCompanyFileUpload(e, 'favicon'));

        // Calculator Toggle
        document.getElementById('calc-toggle')?.addEventListener('click', () => this.toggleCalculator());

        // Theme Toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());

        // Full Screen Toggle
        document.getElementById('fullscreen-toggle')?.addEventListener('click', () => this.toggleFullScreen());
        document.addEventListener('fullscreenchange', () => this.updateFullScreenIcon());

        // Global Keyboard Support for Calculator
        document.addEventListener('keydown', (e) => this.handleCalculatorKeyboard(e));
    }

    toggleSubmenu(link) {
        const sub = document.getElementById(link.dataset.target);
        const isOpen = sub.classList.contains('open');
        document.querySelectorAll('.submenu').forEach(s => s.classList.remove('open'));
        document.querySelectorAll('.has-submenu').forEach(l => l.classList.remove('submenu-active'));
        if (!isOpen) { sub.classList.add('open'); link.classList.add('submenu-active'); }
    }

    handleRouting() {
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p);
        let view = parts[1] || 'dashboard';
        this.navigateTo(view, false);
    }

    async navigateTo(page, updateHistory = true) {
        this.currentView = page;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
        document.querySelectorAll('.view-content').forEach(v => v.style.display = 'none');

        // Dynamic View Selection
        let targetView = document.getElementById(`${page}-view`);
        if (!targetView && ['categories', 'brands', 'units', 'sizes', 'routes'].includes(page)) targetView = document.getElementById('master-view');

        if (targetView) {
            targetView.style.display = 'block';
            await this.loadView(page);

            const titleEl = document.getElementById('view-title');
            if (titleEl) {
                const activeLink = document.querySelector(`.nav-menu .nav-link[data-page="${page}"]`);

                let parentName = 'Dashboard';
                let pageName = 'Overview';
                let isDashboard = (page === 'dashboard');

                if (activeLink) {
                    pageName = activeLink.innerText.trim();
                    const submenu = activeLink.closest('.submenu');
                    if (submenu) {
                        const parentToggle = document.querySelector(`.has-submenu[data-target="${submenu.id}"]`);
                        if (parentToggle) {
                            parentName = Array.from(parentToggle.children)
                                .filter(child => !child.classList.contains('nav-icon') && !child.classList.contains('submenu-arrow'))
                                .map(child => child.innerText.trim()).join('');
                        }
                    } else if (!isDashboard) {
                        // Top level menu item
                        parentName = 'Dashboard';
                    }
                } else {
                    // Fallback for pages without direct link or manual nav
                    if (!isDashboard) pageName = page.charAt(0).toUpperCase() + page.slice(1);
                }

                if (isDashboard) {
                    parentName = 'Dashboard';
                    pageName = 'Overview';
                }

                if (page === 'banking-cheques') {
                    parentName = 'Dashboard';
                    pageName = 'Cheque Management';
                }

                // Render the breadcrumb
                titleEl.innerHTML = `
                    <span style="-webkit-text-fill-color: initial; color: #64748b; font-weight: 400; font-size: 1.5rem;">${parentName}</span>
                    <span style="-webkit-text-fill-color: initial; color: #cbd5e1; margin: 0 10px; font-weight: 300; font-size: 1.5rem;">/</span>
                    <span style="-webkit-text-fill-color: initial; color: var(--primary-green); font-weight: 700; font-size: 1.5rem;">${pageName}</span>
                `;
            }

            if (updateHistory) {
                const role = this.currentUser?.role || 'user';
                history.pushState({ page }, '', `/${role}/${page}`);
            }

            // Clean up intervals from previous views
            if (this.currentView !== 'admin' && this.userRefreshInterval) {
                clearInterval(this.userRefreshInterval);
                this.userRefreshInterval = null;
            }

            // Close report configurator if active and navigating away
            const reportModal = document.getElementById('report-config-modal');
            if (reportModal && reportModal.classList.contains('active')) {
                reportModal.classList.remove('active');
            }
        }
    }

    async loadView(view) {
        const loaders = {
            dashboard: () => this.loadDashboardData().then(() => this.initializeCharts()),
            products: () => this.loadProducts(),
            customers: () => this.loadCustomers(),
            suppliers: () => this.loadSuppliers(),
            categories: () => this.loadMasterData('categories'),
            brands: () => this.loadMasterData('brands'),
            units: () => this.loadMasterData('units'),
            routes: () => this.loadMasterData('routes'),
            payments: () => this.loadPayments(),
            visits: () => { this.loadVisits(); this.loadVisitFilters(); },
            settings: () => this.loadSettings(),
            logs: () => this.loadLogs(),
            sizes: () => this.loadMasterData('sizes'),
            admin: () => this.loadUsers(),
            vehicles: () => this.loadVehicles(),
            expenses: () => this.loadExpenses(),
            distribution: () => this.loadDistributionData(),
            sales: () => this.loadSalesPOS(),
            'sales-history': () => this.loadSalesHistory(),
            'pre-orders': () => this.loadPreOrders(),
            'banking-cheques': () => this.loadBankingCheques(),
            reports: () => this.initReportsView(),
            'customer-intelligence': () => this.initCustomerIntelligenceView(),
            'inventory-intelligence': () => this.initInventoryIntelligenceView(),
            'demand-forecast': () => this.initDemandForecastingView(),
            'report-center': () => this.initReportCenterView(),
            rma: () => this.loadRmaData()
        };
        if (loaders[view]) await loaders[view]();
    }

    // --- PRODUCT LOGIC ---
    addProductPriceRow(data = null) {
        const container = document.getElementById('product-prices-container');
        const count = container.querySelectorAll('.price-row').length;
        const rowId = `price-row-${Date.now()}`;

        const row = document.createElement('div');
        row.className = 'price-row';
        row.id = rowId;
        row.style = "display: flex; gap: 10px; margin-bottom: 8px; align-items: center; background: white; padding: 5px 8px; border-radius: 6px; border: 1px solid #eee;";

        row.innerHTML = `
            <div style="flex: 2;">
                <input type="text" class="form-control price-label" placeholder="Label (e.g. MSRP)" value="${data?.label || (count === 0 ? 'MSRP' : '')}" style="margin-bottom: 0;">
            </div>
            <div style="flex: 2;">
                <input type="number" class="form-control price-value" step="0.01" placeholder="Price" value="${data?.price || ''}" style="margin-bottom: 0;" required oninput="app.calculateProductCost()">
            </div>
            <div style="flex: 1; text-align: center;">
                <label style="font-size: 0.7rem; display: block; color: #666;">Primary</label>
                <input type="radio" name="primary-price" class="price-primary" ${data?.is_primary || count === 0 ? 'checked' : ''} onchange="app.calculateProductCost()">
            </div>
            <div style="flex: 0.5;">
                <button type="button" class="btn btn-sm" onclick="this.closest('.price-row').remove(); app.calculateProductCost();" style="background: #fee2e2; color: #ef4444; border: none; padding: 5px 8px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    }

    calculateProductCost() {
        const discountField = document.getElementById('p-discount');
        const costField = document.getElementById('p-cost');
        if (!discountField || !costField) return;

        const discount = parseFloat(discountField.value) || 0;
        const priceRows = document.querySelectorAll('.price-row');
        let primaryPrice = 0;

        priceRows.forEach(row => {
            const isPrimary = row.querySelector('.price-primary').checked;
            if (isPrimary) {
                primaryPrice = parseFloat(row.querySelector('.price-value').value) || 0;
            }
        });

        if (primaryPrice > 0) {
            const calculatedCost = primaryPrice * (1 - (discount / 100));
            costField.value = calculatedCost.toFixed(2);
        }
    }

    // --- PAGINATION HELPER ---
    updatePagination(entityType, pagination) {
        if (!pagination) return;

        const { page, limit, totalCount, totalPages } = pagination;
        const startItem = totalCount === 0 ? 0 : (page - 1) * limit + 1;
        const endItem = Math.min(page * limit, totalCount);

        // Update pagination info
        const startEl = document.getElementById(`${entityType}-page-start`);
        const endEl = document.getElementById(`${entityType}-page-end`);
        const totalEl = document.getElementById(`${entityType}-total`);
        if (startEl) startEl.textContent = startItem;
        if (endEl) endEl.textContent = endItem;
        if (totalEl) totalEl.textContent = totalCount;

        // Update prev/next buttons
        const prevBtn = document.getElementById(`${entityType}-prev-btn`);
        const nextBtn = document.getElementById(`${entityType}-next-btn`);
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;

        // Build page buttons
        const pagesContainer = document.getElementById(`${entityType}-pages`);
        if (!pagesContainer) return;

        let pagesHtml = '';
        const maxVisible = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        // First page
        if (startPage > 1) {
            pagesHtml += `<button class="page-btn" onclick="app.goTo${this.capitalizeFirst(entityType)}Page(1)">1</button>`;
            if (startPage > 2) {
                pagesHtml += `<span class="page-ellipsis">...</span>`;
            }
        }

        // Middle pages
        for (let i = startPage; i <= endPage; i++) {
            pagesHtml += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="app.goTo${this.capitalizeFirst(entityType)}Page(${i})">${i}</button>`;
        }

        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pagesHtml += `<span class="page-ellipsis">...</span>`;
            }
            pagesHtml += `<button class="page-btn" onclick="app.goTo${this.capitalizeFirst(entityType)}Page(${totalPages})">${totalPages}</button>`;
        }

        pagesContainer.innerHTML = pagesHtml;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    async loadProducts(search = '') {
        const searchInput = document.getElementById('product-search');
        const limitSelect = document.getElementById('product-limit');
        const searchVal = search || searchInput?.value || '';
        const limit = limitSelect?.value || '20';

        let url = `/api/products?page=${this.productPage}&limit=${limit}`;
        if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

        const res = await this.apiCall(url);
        if (!res) return;
        const data = await res.json();
        const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f0f0f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23999'>No Image</text></svg>`;
        if (data.success) {
            const pagination = data.pagination;
            const startIndex = (pagination.page - 1) * pagination.limit;

            const body = document.getElementById('product-table-body');
            body.innerHTML = data.data.map((p, i) => `
                <tr>
                    <td>${startIndex + i + 1}</td>
                    <td><strong>${p.reference_code || '-'}</strong></td>
                    <td><img src="${p.product_image || placeholder}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" onerror="this.src='${placeholder}'"></td>
                    <td><div style="font-weight: 600;">${p.name}</div><small style="color:var(--primary-green); font-style:italic;">${p.chemical_name || ''}</small></td>
                    <td>${p.supplier_name || '-'}</td>
                    <td>${p.size || '-'}</td>
                    <td>
                        <div style="font-weight: 600;">LKR ${p.msrp.toFixed(2)}</div>
                        ${p.price_count > 1 ? `<div style="font-size: 0.75rem; color: var(--primary-green); font-weight: 600;">+ ${p.price_count - 1} more prices</div>` : ''}
                        <div style="font-size: 0.8rem; color: #777;">Cost: LKR ${p.cost.toFixed(2)} ${p.supplier_discount > 0 ? `<span style='color:var(--primary-green); font-weight:bold'>(-${p.supplier_discount}%)</span>` : ''}</div>
                    </td>
                    <td>${p.units_per_carton} ${p.unit}/Crt</td>
                    <td><span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-error'}">${p.status.toUpperCase()}</span></td>
                    <td>
                        <div class="action-btns">
                        <div class="action-btns">
                            ${this.hasPermission('products', 'edit') ? `
                                <button class="btn-icon btn-edit" onclick="app.openProductModal(${JSON.stringify(p).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            ` : ''}
                            ${this.hasPermission('products', 'delete') ? `
                                <button class="btn-icon btn-delete" onclick="app.handleDelete('products', ${p.id}, '${p.name}')"><i class="fas fa-trash"></i></button>
                            ` : ''}
                        </div>
                        </div>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="10" class="text-center">No products found</td></tr>';

            // Update pagination controls
            this.updatePagination('product', pagination);
        }
    }

    changeProductPage(delta) {
        this.productPage += delta;
        if (this.productPage < 1) this.productPage = 1;
        this.loadProducts();
    }

    goToProductPage(page) {
        this.productPage = page;
        this.loadProducts();
    }

    async openProductModal(p = null) {
        try {
            const form = document.getElementById('product-form');
            if (form) form.reset();

            // Setup basic fields
            const idField = document.getElementById('product-id');
            const titleField = document.getElementById('modal-title');
            if (idField) idField.value = p?.id || '';
            if (titleField) titleField.textContent = p ? 'Update Product' : 'Add New Product';

            // Setup buttons
            const saveBtn = document.getElementById('save-product-btn');
            const saveNewBtn = document.getElementById('save-new-product-btn');
            if (saveBtn) saveBtn.textContent = p ? 'Update' : 'Save';
            if (saveNewBtn) saveNewBtn.style.display = p ? 'none' : 'inline-block';

            // Clear previous selections and show modal immediately (UI feedback)
            const modal = document.getElementById('product-modal');
            if (modal) modal.classList.add('active');

            // If editing, try to fetch the LATEST data (including prices) from server
            if (p && p.id) {
                const fullRes = await this.apiCall(`/api/products/${p.id}`);
                if (fullRes && fullRes.ok) {
                    const fullData = await fullRes.json();
                    if (fullData.success) {
                        p = fullData.data; // Replace partial p with full p
                    }
                }
            }

            // Fetch DDL data in parallel
            const fetchJson = async (url) => {
                try {
                    const res = await this.apiCall(url);
                    if (res && res.ok) return await res.json();
                    return { success: false, data: [] };
                } catch (e) {
                    console.error(`Failed to fetch ${url}:`, e);
                    return { success: false, data: [] };
                }
            };

            const [sups, cats, brands, units] = await Promise.all([
                fetchJson('/api/suppliers'),
                fetchJson('/api/categories'),
                fetchJson('/api/brands'),
                fetchJson('/api/units')
            ]);

            // Helper for population
            const populate = (id, data, val, valueKey = 'id') => {
                const el = document.getElementById(id);
                if (!el) return;
                const items = Array.isArray(data) ? data : [];
                el.innerHTML = '<option value="">Select...</option>' +
                    items.map(i => `<option value="${i[valueKey]}" ${i[valueKey] == val ? 'selected' : ''}>${i.name}</option>`).join('');
                if (val) el.value = val;
            };

            populate('p-supplier', sups.data, p?.supplier_id);
            populate('p-category', cats.data, p?.category_id);
            populate('p-brand', brands.data, p?.brand_id);
            populate('p-unit', units.data, p?.unit, 'name');

            // Handle Prices
            const priceContainer = document.getElementById('product-prices-container');
            priceContainer.innerHTML = '';

            if (p) {
                // Populate other fields if editing
                const fields = {
                    'p-name': p.name,
                    'p-chemical': p.chemical_name || '',
                    'p-ref': p.reference_code || '',
                    'p-barcode': p.barcode || '',
                    'p-image-url': p.product_image || '',
                    'p-image-manual': p.product_image || '',
                    'p-carton': p.units_per_carton || 1,
                    'p-stock': p.initial_stock || 0,
                    'p-cost': p.cost || 0,
                    'p-msrp': p.msrp || 0,
                    'p-discount': p.supplier_discount || 0,
                    'p-size': p.size || '',
                    'p-tags': p.tags || '',
                    'p-desc': p.description || ''
                };

                Object.entries(fields).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                });

                const statusEl = document.getElementById('p-status');
                if (statusEl) statusEl.checked = p.status === 'active';
                this.updatePreview(p.product_image);

                // Populate Prices
                if (p.prices && p.prices.length > 0) {
                    p.prices.forEach(pr => this.addProductPriceRow(pr));
                } else {
                    this.addProductPriceRow({ label: 'MSRP', price: p.msrp, is_primary: 1 });
                }
            } else {
                this.updatePreview('');
                this.addProductPriceRow({ label: 'MSRP', price: 0, is_primary: 1 });
            }

            // Re-populate fields
            if (p) {
                const fields = {
                    'p-name': p.name,
                    'p-chemical': p.chemical_name || '',
                    'p-ref': p.reference_code || '',
                    'p-barcode': p.barcode || '',
                    'p-image-url': p.product_image || '',
                    'p-image-manual': p.product_image || '',
                    'p-carton': p.units_per_carton || 1,
                    'p-stock': p.initial_stock || 0,
                    'p-cost': p.cost || 0,
                    'p-msrp': p.msrp || 0,
                    'p-discount': p.supplier_discount || 0,
                    'p-size': p.size || '',
                    'p-tags': p.tags || '',
                    'p-desc': p.description || ''
                };

                Object.entries(fields).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                });

                const statusEl = document.getElementById('p-status');
                if (statusEl) statusEl.checked = p.status === 'active';

                const weightedEl = document.getElementById('p-weighted');
                if (weightedEl) weightedEl.checked = !!p.weighted;

                this.updatePreview(p.product_image);

                // Populate Prices
                if (p.prices && p.prices.length > 0) {
                    p.prices.forEach(pr => this.addProductPriceRow(pr));
                } else {
                    this.addProductPriceRow({ label: 'MSRP', price: p.msrp, is_primary: 1 });
                }
            } else {
                this.updatePreview('');
                this.addProductPriceRow({ label: 'MSRP', price: 0, is_primary: 1 });
                const weightedEl = document.getElementById('p-weighted');
                if (weightedEl) weightedEl.checked = false;
            }
            this.calculateProductCost();
        } catch (err) {
            console.error('Error in openProductModal:', err);
            this.showNotification('Could not open product form: ' + err.message, 'error');
        }
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await this.apiCall('/api/upload', { method: 'POST', body: formData });
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                document.getElementById('p-image-url').value = data.imageUrl;
                this.updatePreview(data.imageUrl);
            }
        } catch (err) { this.showNotification('Upload failed', 'error'); }
    }

    updatePreview(url) {
        const prev = document.getElementById('image-preview');
        const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f0f0f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='11' fill='%23999'>No Preview</text></svg>`;
        prev.innerHTML = url ? `<img src="${url}" onerror="this.src='${placeholder}'">` : `<img src="${placeholder}">`;
    }

    async handleProductSubmit(e, saveAndNew = false) {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const priceRows = document.querySelectorAll('.price-row');
        const prices = [];
        let primaryMsrp = 0;

        priceRows.forEach(row => {
            const label = row.querySelector('.price-label').value;
            const price = parseFloat(row.querySelector('.price-value').value) || 0;
            const isPrimary = row.querySelector('.price-primary').checked;
            if (label || price) {
                prices.push({ label, price, is_primary: isPrimary });
                if (isPrimary) primaryMsrp = price;
            }
        });

        const d = {
            name: document.getElementById('p-name').value,
            chemical_name: document.getElementById('p-chemical').value,
            reference_code: document.getElementById('p-ref').value,
            barcode: document.getElementById('p-barcode').value,
            category_id: parseInt(document.getElementById('p-category').value) || null,
            brand_id: parseInt(document.getElementById('p-brand').value) || null,
            supplier_id: parseInt(document.getElementById('p-supplier').value) || null,
            unit: document.getElementById('p-unit').value,
            size: document.getElementById('p-size').value,
            units_per_carton: parseInt(document.getElementById('p-carton').value) || 1,
            initial_stock: parseFloat(document.getElementById('p-stock').value) || 0,
            cost: parseFloat(document.getElementById('p-cost').value),
            msrp: primaryMsrp, // Keep for compatibility
            prices: prices,    // New field
            supplier_discount: parseFloat(document.getElementById('p-discount').value) || 0,
            tags: document.getElementById('p-tags').value,
            product_image: document.getElementById('p-image-url').value || document.getElementById('p-image-manual').value || null,
            description: document.getElementById('p-desc').value,
            status: document.getElementById('p-status').checked ? 'active' : 'inactive',
            weighted: document.getElementById('p-weighted').checked
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/products/${id}` : '/api/products';

        try {
            const res = await this.apiCall(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'user-role': this.currentUser.role
                },
                body: JSON.stringify(d)
            });
            if (!res) return;
            const resData = await res.json();
            if (resData.success) {
                this.showNotification('Product Saved!');
                this.loadProducts();
                if (saveAndNew) {
                    this.openProductModal();
                } else {
                    const modal = document.getElementById('product-modal');
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
            } else {
                this.showNotification(resData.error || resData.message || 'Error occurred', 'error');
            }
        } catch (err) {
            alert('Submit Error: ' + err.message);
            this.showNotification('Connection or script error', 'error');
        }
    }

    // --- SUPPLIER LOGIC ---
    async loadSuppliers(search = '') {
        const searchInput = document.getElementById('supplier-search');
        const limitSelect = document.getElementById('supplier-limit');
        const searchVal = search || searchInput?.value || '';
        const limit = limitSelect?.value || '20';

        let url = `/api/suppliers?page=${this.supplierPage}&limit=${limit}`;
        if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

        const res = await this.apiCall(url);
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            const pagination = data.pagination;
            document.getElementById('supplier-table-body').innerHTML = data.data.map(s => `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td><span class="badge" style="background:rgba(46, 125, 50, 0.1); color:var(--primary-green); border:none;">${s.category || '-'}</span></td>
                    <td>${s.address || '-'}</td>
                    <td>${s.contact || '-'}</td>
                    <td>
                        <div style="font-size: 0.85rem;">TSR: ${s.tsr_name || '-'}</div>
                        <div style="font-size: 0.85rem; color: var(--gray-600);">AM: ${s.area_manager_name || '-'}</div>
                    </td>
                    <td>
                        <div class="action-btns">
                            ${this.hasPermission('suppliers', 'edit') ? `<button class="btn-icon btn-edit" data-supplier="${encodeURIComponent(JSON.stringify(s))}"><i class="fas fa-edit"></i></button>` : ''}
                            ${this.hasPermission('suppliers', 'delete') ? `<button class="btn-icon btn-delete" data-id="${s.id}" data-name="${encodeURIComponent(s.name)}"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="6">No suppliers found</td></tr>';

            // Update pagination controls
            this.updatePagination('supplier', pagination);
        }
    }

    changeSupplierPage(delta) {
        this.supplierPage += delta;
        if (this.supplierPage < 1) this.supplierPage = 1;
        this.loadSuppliers();
    }

    goToSupplierPage(page) {
        this.supplierPage = page;
        this.loadSuppliers();
    }

    openSupplierModal(s = null) {
        document.getElementById('supplier-form').reset();
        document.getElementById('s-id').value = s?.id || '';
        if (s) {
            document.getElementById('s-name').value = s.name;
            document.getElementById('s-address').value = s.address || '';
            document.getElementById('s-contact').value = s.contact || '';
            document.getElementById('s-category').value = s.category || '';
            document.getElementById('s-tags').value = s.tags || '';
            document.getElementById('s-tsr').value = s.tsr_name || '';
            document.getElementById('s-am').value = s.area_manager_name || '';
        }
        const saveBtn = document.getElementById('save-supplier-btn');
        const saveNewBtn = document.getElementById('save-new-supplier-btn');
        const modalTitle = document.getElementById('s-modal-title');

        if (saveBtn) saveBtn.textContent = s ? 'Update Supplier' : 'Save Supplier';
        if (saveNewBtn) saveNewBtn.style.display = s ? 'none' : 'inline-block';
        if (modalTitle) modalTitle.textContent = s ? 'Edit Supplier' : 'Supplier Details';

        const modal = document.getElementById('supplier-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }

    async handleSupplierSubmit(e, stayOpen = false) {
        if (e) e.preventDefault();
        const id = document.getElementById('s-id').value;
        const d = {
            name: document.getElementById('s-name').value,
            address: document.getElementById('s-address').value,
            contact: document.getElementById('s-contact').value,
            category: document.getElementById('s-category').value,
            tags: document.getElementById('s-tags').value,
            tsr_name: document.getElementById('s-tsr').value,
            area_manager_name: document.getElementById('s-am').value
        };
        if (!d.name) return this.showNotification('Supplier name is required', 'error');

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/suppliers/${id}` : '/api/suppliers';
        const res = await this.apiCall(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'user-role': this.currentUser.role
            },
            body: JSON.stringify(d)
        });
        if (!res) return;
        const resData = await res.json();
        if (resData.success) {
            this.showNotification(id ? 'Supplier Updated' : 'Supplier Saved');
            const modal = document.getElementById('supplier-modal');
            if (stayOpen) {
                this.openSupplierModal();
            } else {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
            this.loadSuppliers();
        }
    }

    async openLedger(customerId) {
        const res = await this.apiCall(`/api/customers/${customerId}/ledger`);
        if (!res) return;
        const result = await res.json();
        if (result.success) {
            const { customer, ledger } = result.data;
            document.getElementById('ledger-customer-info').textContent = `${customer.name} | ${customer.contact || 'No Contact'}`;

            let runningBalance = 0;
            let totalSales = 0;
            let totalPaid = 0;

            const rows = ledger.map(entry => {
                runningBalance += (entry.debit - entry.credit);
                totalSales += (entry.debit || 0);
                totalPaid += (entry.credit || 0);

                return `
                    <tr>
                        <td style="padding: 12px 15px;">${new Date(entry.date).toLocaleDateString()}</td>
                        <td style="padding: 12px 15px;"><span style="font-family: monospace; font-weight: bold; color: var(--primary-green-dark);">${entry.reference}</span></td>
                        <td style="padding: 12px 15px;"><span class="badge ${entry.type === 'Invoice' ? 'badge-primary' : 'badge-success'}" style="font-size: 0.7rem; border-radius: 4px;">${entry.type.toUpperCase()}</span></td>
                        <td class="text-right" style="padding: 12px 15px; color: ${entry.debit > 0 ? 'var(--error)' : '#ccc'}; font-weight: ${entry.debit > 0 ? '600' : '400'}; transition: color 0.3s;">
                            ${entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td class="text-right" style="padding: 12px 15px; color: ${entry.credit > 0 ? 'var(--primary-green)' : '#ccc'}; font-weight: ${entry.credit > 0 ? '600' : '400'};">
                            ${entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td class="text-right" style="padding: 12px 15px; font-weight: 700; color: ${runningBalance > 0 ? 'var(--error)' : 'var(--primary-green)'};">
                            ${runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                `;
            });

            document.getElementById('ledger-body').innerHTML = rows.join('') || '<tr><td colspan="6" class="text-center" style="padding: 30px; color: #999;">No transactions found for this customer</td></tr>';

            // Populate Summary Cards
            document.getElementById('ledger-sum-sales').textContent = `LKR ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            document.getElementById('ledger-sum-paid').textContent = `LKR ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            document.getElementById('ledger-sum-balance').textContent = `LKR ${runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

            document.getElementById('ledger-modal').classList.add('active');
        }
    }

    // --- CUSTOMER LOGIC ---
    async loadCustomers(search = '') {
        const searchInput = document.getElementById('customer-search');
        const statusFilter = document.getElementById('customer-status-filter');
        const limitSelect = document.getElementById('customer-limit');
        const status = statusFilter?.value || '';
        const searchVal = search || searchInput?.value || '';
        const limit = limitSelect?.value || '20';

        let url = `/api/customers?page=${this.customerPage}&limit=${limit}&search=${encodeURIComponent(searchVal)}`;
        if (status) url += `&status=${status}`;

        const res = await this.apiCall(url);
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            const pagination = data.pagination;
            document.getElementById('customer-table-body').innerHTML = data.data.map(c => {
                const isDeleted = status === 'deleted';
                return `
                <tr>
                    <td><strong>#${c.id}</strong></td>
                    <td>
                        <div style="font-weight: 600;">${c.name}</div>
                        <div style="font-size: 0.8rem; color: var(--gray-600);"><i class="fas fa-phone"></i> ${c.contact || 'N/A'}</div>
                        <div style="font-size: 0.8rem; color: var(--gray-500);"><i class="fas fa-map-marker-alt"></i> ${c.address || 'No address'}</div>
                    </td>
                    <td><span class="badge" style="background:#e3f2fd; color:#1976d2; border:none;">${c.category || 'Retailer'}</span></td>
                    <td><div style="font-size: 0.9rem;">${c.route_name || 'No Route'}</div></td>
                    <td>
                        <div style="font-weight: 700; color: ${c.account_balance > 0 ? '#d32f2f' : 'var(--primary-green)'};">LKR ${c.account_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div style="font-size: 0.75rem; color: #777;">Limit: LKR ${c.credit_limit?.toLocaleString() || '0'}</div>
                    </td>
                    <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-error'}">${c.status.toUpperCase()}</span></td>
                    <td>
                        <div class="action-btns">
                            ${isDeleted ? `
                                ${this.hasPermission('customers', 'create') ? `<button class="btn btn-secondary btn-sm" style="background: var(--primary-green); color: white;" onclick="app.handleRestoreCustomer(${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="fas fa-undo"></i> Restore</button>` : ''}
                                ${this.hasPermission('customers', 'delete') ? `<button class="btn btn-secondary btn-sm" style="background: #ef4444; color: white;" onclick="app.handleDeletePermanent('customers', ${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash-alt"></i> Delete Permanently</button>` : ''}
                            ` : `
                                ${this.hasPermission('payments', 'create') ? `<button class="btn btn-secondary btn-sm" onclick="app.openPaymentModal(${c.id})"><i class="fas fa-money-bill-wave"></i> Collect</button>` : ''}
                                ${this.hasPermission('payments', 'view') ? `<button class="btn btn-secondary btn-sm" onclick="app.openLedger(${c.id})"><i class="fas fa-history"></i> History</button>` : ''}
                                ${this.hasPermission('customers', 'edit') ? `<button class="btn-icon btn-edit" onclick="app.openCustomerModal(${JSON.stringify(c).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>` : ''}
                                ${this.hasPermission('customers', 'delete') ? `<button class="btn-icon btn-delete" onclick="app.handleDelete('customers', ${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
                            `}
                        </div>
                    </td>
                </tr>
            `}).join('') || '<tr><td colspan="7">No customers found</td></tr>';

            // Update pagination controls
            this.updatePagination('customer', pagination);
        }
    }

    changeCustomerPage(delta) {
        this.customerPage += delta;
        if (this.customerPage < 1) this.customerPage = 1;
        this.loadCustomers();
    }

    goToCustomerPage(page) {
        this.customerPage = page;
        this.loadCustomers();
    }

    async handleRestoreCustomer(id, name) {
        if (!confirm(`Restore customer "${name}"?`)) return;
        try {
            const res = await this.apiCall(`/api/customers/${id}/restore`, {
                method: 'PUT',
                headers: { 'user-role': this.currentUser.role }
            });
            if (res && (await res.json()).success) {
                this.showNotification('Customer Restored');
                this.loadCustomers();
            }
        } catch (err) {
            this.showNotification('Restore failed', 'error');
        }
    }

    async openCustomerModal(c = null) {
        try {
            // 1. Reset and basic setup
            const form = document.getElementById('customer-form');
            if (form) form.reset();

            const idField = document.getElementById('c-id');
            const titleField = document.getElementById('c-modal-title');
            const saveBtn = document.getElementById('save-customer-btn');
            if (idField) idField.value = c?.id || '';
            if (titleField) titleField.textContent = c ? 'Edit Customer' : 'Add New Customer';
            if (saveBtn) saveBtn.textContent = c ? 'Update Customer' : 'Save Customer';

            // 2. Try loading routes (Don't crash if this fails)
            try {
                const routeSelect = document.getElementById('c-route');
                if (routeSelect) {
                    const routeRes = await this.apiCall('/api/master/routes');
                    if (!routeRes) throw new Error('Failed to fetch routes');
                    const routeData = await routeRes.json();
                    if (routeData.success && Array.isArray(routeData.data)) {
                        routeSelect.innerHTML = '<option value="">Select Route</option>' +
                            routeData.data.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
                    }
                }
            } catch (routeErr) {
                alert('Could not load routes: ' + routeErr.message);
            }

            // 3. Populate fields
            if (c) {
                const status = c.status || 'active';
                const fields = {
                    'c-name': c.name,
                    'c-address': c.address || '',
                    'c-contact': c.contact || '',
                    'c-category': c.category || 'Retailer',
                    'c-route': c.route_id || '',
                    'c-balance': c.account_balance || 0,
                    'c-credit-limit': c.credit_limit || 0,
                    'c-lat': c.latitude || '',
                    'c-lng': c.longitude || '',
                    'c-status': status
                };
                Object.entries(fields).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                });

                // Update toggle UI
                const toggle = document.getElementById('c-status-toggle');
                const stext = document.getElementById('status-text');
                if (toggle) toggle.checked = status === 'active';
                if (stext) stext.textContent = status.charAt(0).toUpperCase() + status.slice(1);

            } else {
                const defaults = {
                    'c-balance': '0.00',
                    'c-credit-limit': '0.00',
                    'c-status': 'active'
                };
                Object.entries(defaults).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                });

                // Reset toggle UI
                const toggle = document.getElementById('c-status-toggle');
                const stext = document.getElementById('status-text');
                if (toggle) toggle.checked = true;
                if (stext) stext.textContent = 'Active';
            }

            // 4. Show modal
            const modal = document.getElementById('customer-modal');
            if (modal) modal.classList.add('active');
            else throw new Error('Customer modal element not found');

        } catch (err) {
            alert('Error opening modal: ' + err.message);
            this.showNotification(`Error: ${err.message}`, 'error');
        }
    }

    async handleCustomerSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('c-id').value;
        const d = {
            name: document.getElementById('c-name').value,
            address: document.getElementById('c-address').value,
            contact: document.getElementById('c-contact').value,
            category: document.getElementById('c-category').value,
            route_id: document.getElementById('c-route').value,
            account_balance: document.getElementById('c-balance').value,
            credit_limit: document.getElementById('c-credit-limit').value,
            latitude: document.getElementById('c-lat').value || null,
            longitude: document.getElementById('c-lng').value || null,
            status: document.getElementById('c-status-toggle').checked ? 'active' : 'blocked'
        };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/customers/${id}` : '/api/customers';
        const res = await this.apiCall(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        if (!res) return;
        const resData = await res.json();
        if (resData.success) {
            this.showNotification(id ? 'Customer Updated' : 'Customer Added', 'success');
            const modal = document.getElementById('customer-modal');
            if (modal) modal.classList.remove('active');

            this.loadCustomers(); // Reload standard customer view if active

            // Check if we are in POS mode and have a callback
            if (typeof window.onCustomerSaved === 'function') {
                const newCustomer = id ? { id, ...d } : { id: resData.data.id, ...d };
                window.onCustomerSaved(newCustomer);
            }
        } else {
            this.showNotification(resData.message || 'Failed to save customer', 'error');
        }
    }

    async handleDeletePermanent(type, id, name) {
        if (!confirm(`Are you sure you want to PERMANENTLY delete "${name}"? This action cannot be undone.`)) return;

        try {
            const res = await this.apiCall(`/api/${type}/${id}?permanent=true`, {
                method: 'DELETE'
            });
            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification(`${name} permanently deleted`);
                    // Reload current view
                    if (this.currentView === 'customers') this.loadCustomers();
                    else if (this.currentView === 'products') this.loadProducts();
                    else if (this.currentView === 'suppliers') this.loadSuppliers();
                } else {
                    this.showNotification('Failed: ' + data.message, 'error');
                }
            }
        } catch (e) {
            this.showNotification('Error: ' + e.message, 'error');
        }
    }

    // --- MASTER DATA LOGIC (Cats, Brands) ---
    async loadMasterData(type) {
        const url = type === 'routes' ? '/api/master/routes' : `/api/${type}`;
        try {
            const res = await this.apiCall(url);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const singularMap = {
                    'categories': 'Category',
                    'brands': 'Brand',
                    'units': 'Unit',
                    'sizes': 'Size',
                    'routes': 'Route'
                };
                const singularName = singularMap[type] || 'Item';

                document.getElementById('master-title').textContent = type.charAt(0).toUpperCase() + type.slice(1);

                // Setup Create Button
                const addBtn = document.getElementById('add-master-btn');
                if (addBtn) {
                    addBtn.style.display = 'inline-flex';
                    addBtn.innerHTML = `<i class="fas fa-plus"></i> Add ${singularName}`;
                    addBtn.onclick = () => this.openMasterModal(null, type);
                }

                document.getElementById('master-table-body').innerHTML = data.data.map(m => `
                    <tr>
                        <td>${m.id}</td>
                        <td>${m.name}</td>
                        <td>${new Date(m.created_at || Date.now()).toLocaleDateString()}</td>
                        <td>
                            <div class="action-btns">
                                <button class="btn-icon btn-edit" onclick='app.openMasterModal(${JSON.stringify(m).replace(/'/g, "&#39;")}, "${type}")'><i class="fas fa-edit"></i></button>
                                <button class="btn-icon btn-delete" onclick="app.handleDelete('${type}', ${m.id}, '${m.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="4">No entries found</td></tr>';
            } else {
                this.showNotification(data.error || 'Failed to load data', 'error');
            }
        } catch (err) {
            console.error('LoadMasterData Error:', err);
            this.showNotification('Failed to load ' + type, 'error');
        }
    }

    openMasterModal(item, type) {
        const modal = document.getElementById('master-modal');
        if (!modal) return;

        // Set type explicitly if passed, or fallback
        if (type) document.getElementById('master-type').value = type;
        else type = document.getElementById('master-type').value;

        const singularMap = {
            'categories': 'Category',
            'brands': 'Brand',
            'units': 'Unit',
            'sizes': 'Size',
            'routes': 'Route'
        };
        const singularName = singularMap[type] || 'Item';

        if (item) {
            // Edit Mode
            document.getElementById('master-modal-title').textContent = `Edit ${singularName}`;
            document.getElementById('master-id').value = item.id;
            document.getElementById('master-name').value = item.name;
        } else {
            // Add Mode
            document.getElementById('master-modal-title').textContent = `Add New ${singularName}`;
            document.getElementById('master-id').value = '';
            document.getElementById('master-name').value = '';
        }

        modal.classList.add('active');
    }

    async saveMasterData(e) {
        e.preventDefault();
        const type = document.getElementById('master-type').value;
        const id = document.getElementById('master-id').value;
        const name = document.getElementById('master-name').value;

        if (!name) return this.showNotification('Name is required', 'error');

        try {
            const url = type === 'routes' ? '/api/master/routes' : `/api/${type}`;
            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? `${url}/${id}` : url;

            const res = await this.apiCall(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (!res) return;
            const data = await res.json();

            if (data.success) {
                this.showNotification(`${type} saved successfully`, 'success');
                document.getElementById('master-modal').classList.remove('active');
                this.loadMasterData(type);
            } else {
                this.showNotification(data.error || 'Failed to save', 'error');
            }
        } catch (err) {
            console.error('Save failed:', err);
            this.showNotification('Failed to save', 'error');
        }
    }

    async handleDataReset() {
        if (!confirm('Are you sure you want to reset all data? This action cannot be undone.')) return;

        try {
            this.showNotification('Resetting data...', 'info');
            const res = await this.apiCall('/api/reset-data', { method: 'POST' });
            // The original snippet had a malformed `});` here, which is removed.
            // The following `if (res && res.status === 200)` block is assumed to be part of handleDataReset.

            if (res && res.status === 200) {
                this.showNotification('Data reset successfully. Reloading...', 'success');
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (e) {
            console.error('Reset failed:', e);
            this.showNotification('Failed to reset data', 'error');
        }
    }

    async loadBackupSettings() {
        try {
            const res = await this.apiCall('/api/backup/config');
            if (!res) return;
            const data = await res.json();
            if (data.success && data.data) {
                const config = data.data;
                document.getElementById('backup-enabled-toggle').checked = config.enabled;
                document.getElementById('backup-status-text').textContent = config.enabled ? 'Enabled' : 'Disabled';
                document.getElementById('backup-freq').value = config.frequency;
                document.getElementById('backup-time').value = config.time;
                document.getElementById('backup-retention').value = config.retention;

                const fields = document.getElementById('backup-config-fields');
                if (fields) fields.style.opacity = config.enabled ? '1' : '0.5';
                if (fields) fields.style.pointerEvents = config.enabled ? 'auto' : 'none';
            }
        } catch (e) {
            console.error('Failed to load backup settings:', e);
        }
    }

    async saveBackupSettings() {
        const enabled = document.getElementById('backup-enabled-toggle').checked;
        const frequency = document.getElementById('backup-freq').value;
        const time = document.getElementById('backup-time').value;
        const retention = document.getElementById('backup-retention').value;

        try {
            this.showNotification('Saving backup schedule...', 'info');
            const res = await this.apiCall('/api/backup/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, frequency, time, retention })
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification('Backup schedule updated', 'success');
                    this.loadBackupSettings(); // Refresh UI state
                } else {
                    this.showNotification('Failed: ' + data.error, 'error');
                }
            }
        } catch (e) {
            this.showNotification('Error saving settings', 'error');
        }
    }

    async loadBackups() {
        const tbody = document.getElementById('backup-list-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

        try {
            const res = await this.apiCall('/api/backup/list');
            if (!res) return;
            const data = await res.json();

            if (data.success && data.data) {
                if (data.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No backups found</td></tr>';
                    return;
                }

                tbody.innerHTML = data.data.map(file => `
                    <tr>
                        <td>
                            <div style="font-weight: 600;">${file.name}</div>
                        </td>
                        <td>${new Date(file.created_at).toLocaleString()}</td>
                        <td>${(file.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td>
                            <a href="/api/backup/download/${file.name}" target="_blank" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load backups</td></tr>';
        }
    }

    async performManualBackup() {
        if (!confirm('Create a backup snapshot now?')) return;

        try {
            this.showNotification('Creating backup...', 'info');
            const res = await this.apiCall('/api/backup/manual', { method: 'POST' });
            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification('Backup created successfully', 'success');
                    this.loadBackups();
                } else {
                    this.showNotification('Backup failed: ' + data.error, 'error');
                }
            }
        } catch (e) {
            this.showNotification('Backup failed', 'error');
        }
    }


    async handleDelete(type, id, name) {
        if (!confirm(`Delete ${name}?`)) return;
        try {
            const baseUrl = type === 'routes' ? '/api/master/routes' : `/api/${type}`;
            const res = await this.apiCall(`${baseUrl}/${id}`, {
                method: 'DELETE',
                headers: { 'user-role': this.currentUser.role }
            });
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                this.showNotification('Deleted');
                this.loadView(this.currentView);
                this.loadDashboardData();
            } else {
                const errorMsg = data.error || data.message || 'Delete failed';
                console.error('Delete Error:', data);

                if (errorMsg.toUpperCase().includes('FOREIGN KEY') || res.status === 409) {
                    this.showNotification('Delete blocked: records are linked', 'error');
                    alert(`Action Denied: ${errorMsg}\n\nYou must remove or update any items (like Products or Bills) associated with "${name}" before you can delete it.`);
                } else {
                    this.showNotification(errorMsg, 'error');
                }
            }
        } catch (err) {
            console.error('Delete Exception:', err);
            this.showNotification('Connection error', 'error');
        }
    }

    // --- DASHBOARD & UTIL ---
    async loadDashboardData() {
        try {
            const today = this.getLocalDateISO();
            // Add cache-buster timestamp to prevent stale browser cache
            const cacheBuster = `&_=${Date.now()}`;

            const [kpisRes, actsRes, stockRes] = await Promise.all([
                this.apiCall(`/api/dashboard/kpis?date=${today}${cacheBuster}`),
                this.apiCall(`/api/dashboard/activities?limit=5${cacheBuster}`),
                this.apiCall(`/api/products?${cacheBuster}`)
            ]);

            if (kpisRes) {
                const kpis = await kpisRes.json();
                console.log(`[Dashboard] KPIs Response for ${today}:`, kpis);
                if (kpis.success) this.updateKPIs(kpis.data);
            }
            if (actsRes) {
                const acts = await actsRes.json();
                if (acts.success) this.updateActivities(acts.data);
            }
            if (stockRes) {
                const stock = await stockRes.json();
                if (stock.success) this.updateStockAlerts(stock.data);
            }

            this.initializeCharts();
        } catch (e) {
            console.error('Dashboard Load Error:', e);
            // Fallback for UI
            this.initializeCharts();
        }
    }

    updateKPIs(d) {
        const fmt = n => 'LKR ' + new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
        const fmtShort = n => {
            if (n >= 1000000) return 'LKR ' + (n / 1000000).toFixed(2) + 'M';
            if (n >= 1000) return 'LKR ' + (n / 1000).toFixed(1) + 'k';
            return 'LKR ' + n.toFixed(0);
        };
        const setVal = (id, val, isCurrency = true, short = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (isCurrency) {
                el.textContent = short ? fmtShort(val) : fmt(val);
            } else {
                el.textContent = val;
            }
        };

        // Sales Performance
        setVal('daily-sales', d.daily_sales);
        setVal('monthly-sales', d.monthly_sales, true, true);
        setVal('ytd-sales', d.ytd_sales, true, true);

        // Profitability (Main highlight is Net Profit)
        setVal('net-profit', d.net_profit);
        setVal('gross-profit', d.gross_profit, true, true);
        const marginEl = document.getElementById('profit-margin');
        if (marginEl) marginEl.textContent = (d.profit_margin || 0).toFixed(1) + '%';

        // Finance & Receivables
        setVal('outstanding', d.outstanding);
        setVal('collections', d.collections, true, true);
        const cashCreditEl = document.getElementById('cash-credit-split');
        if (cashCreditEl) cashCreditEl.textContent = `${Math.round(d.cash_sales / 1000)}k / ${Math.round(d.credit_sales / 1000)}k`;

        // Operations
        setVal('total-expenses', d.expenses_ytd);
        setVal('active-customers', d.active_customers, false);
        const successEl = document.getElementById('delivery-success');
        if (successEl) successEl.textContent = (d.delivery_success_rate || 0).toFixed(1) + '%';

        // Logistics
        const avgSale = d.active_trucks > 0 ? d.daily_sales / d.active_trucks : 0;
        setVal('avg-route-sale', avgSale);
        setVal('active-trucks', d.active_trucks, false);
        const utilEl = document.getElementById('vehicle-utilization');
        if (utilEl) utilEl.textContent = (d.vehicle_utilization || 0).toFixed(1) + '%';
    }

    updateActivities(acts) {
        document.getElementById('activity-list').innerHTML = acts.map(a => `
            <li class="activity-item">
                <div class="activity-header"><span class="activity-type">${a.type.toUpperCase()}</span><span class="activity-time">${this.getTimeAgo(this.parseDBDate(a.timestamp))}</span></div>
                <div class="activity-details">${a.reference} - ${a.customer_name} (LKR ${a.amount})</div>
            </li>
        `).join('') || '<li>No recent activity</li>';
    }

    initializeCharts() {
        // Sales Trend Chart
        const ctxTrend = document.getElementById('salesTrendChart');
        if (ctxTrend) {
            if (this.charts.salesTrend) this.charts.salesTrend.destroy();
            this.charts.salesTrend = new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Sales Revenue (LKR)',
                        data: [45000, 52000, 38000, 65000, 48000, 82000, 95000],
                        borderColor: '#2E7D32',
                        backgroundColor: 'rgba(46, 125, 50, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Category Distribution Chart
        const ctxCat = document.getElementById('categoryChart');
        if (ctxCat) {
            if (this.charts.categoryChart) this.charts.categoryChart.destroy();
            this.charts.categoryChart = new Chart(ctxCat, {
                type: 'doughnut',
                data: {
                    labels: ['Fertilizer', 'Seeds', 'Tools', 'Pesticides'],
                    datasets: [{
                        data: [40, 25, 15, 20],
                        backgroundColor: ['#2E7D32', '#4CAF50', '#81C784', '#C8E6C9'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
                    },
                    cutout: '70%'
                }
            });
        }
    }

    updateStockAlerts(products) {
        const lowStock = products.filter(p => p.initial_stock < 10);
        const countEl = document.getElementById('low-stock-count');
        const bodyEl = document.getElementById('low-stock-body');

        if (countEl) countEl.textContent = `${lowStock.length} Alerts`;

        if (bodyEl) {
            if (lowStock.length === 0) {
                bodyEl.innerHTML = '<tr><td colspan="3" class="text-center">No stock alerts</td></tr>';
                return;
            }
            bodyEl.innerHTML = lowStock.map(p => `
                <tr>
                    <td>${p.name}</td>
                    <td><span style="color: var(--error); font-weight: bold;">${p.initial_stock}</span></td>
                    <td><span class="badge badge-error" style="font-size: 0.65rem;">LOW STOCK</span></td>
                </tr>
            `).join('');
        }
    }

    getTimeAgo(d) {
        const s = Math.floor((new Date() - d) / 1000);
        if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago';
    }

    updateDateTime() {
        const el = document.getElementById('current-date');
        if (!el) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-LK', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });
        el.textContent = `${dateStr} | ${timeStr}`;
    }

    // --- SETTINGS LOGIC ---
    async loadSettings() {
        const timeoutInput = document.getElementById('setting-timeout');
        const enabledInput = document.getElementById('setting-timer-enabled');

        // Check if user is admin
        const userRole = this.currentUser?.role?.toLowerCase();
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (isAdmin) {
            // For admins, disable timer settings and show notice
            if (timeoutInput) {
                timeoutInput.value = '';
                timeoutInput.placeholder = '∞ (Unlimited)';
                timeoutInput.disabled = true;
            }
            if (enabledInput) {
                enabledInput.checked = false;
                enabledInput.disabled = true;
            }

            // Add admin notice if not already present
            const settingsContainer = document.getElementById('settings-view');
            if (settingsContainer && !document.getElementById('admin-timer-notice')) {
                const notice = document.createElement('div');
                notice.id = 'admin-timer-notice';
                notice.className = 'admin-notice';
                notice.innerHTML = '<i class="fas fa-crown"></i><span><strong>Administrator Privilege:</strong> Session timeout is automatically disabled for your account. You have unlimited session duration.</span>';

                const firstCard = settingsContainer.querySelector('.card');
                if (firstCard) {
                    firstCard.parentNode.insertBefore(notice, firstCard);
                }
            }
        } else {
            // For non-admin users, show regular settings
            if (timeoutInput) timeoutInput.value = localStorage.getItem('session_timeout') || '10';

            if (enabledInput) {
                enabledInput.checked = localStorage.getItem('timer_enabled') !== 'false';
                if (timeoutInput) timeoutInput.disabled = !enabledInput.checked;
            }
        }

        // Company Details for Admin
        if (isAdmin) {
            const adminCard = document.getElementById('admin-company-card');
            if (adminCard) {
                adminCard.style.display = 'block';
                await this.loadCompanyDetails();
            }
        }
    }

    async loadInitialCompanyConfig() {
        try {
            const res = await fetch('/api/settings/company');
            const data = await res.json();
            if (data.success && data.data) {
                this.applyCompanySettings(data.data);
            }
        } catch (err) {
            console.error('Failed to load initial company config:', err);
        }
    }

    async loadCompanyDetails() {
        try {
            const res = await this.apiCall('/api/settings/company');
            if (res) {
                const data = await res.json();
                if (data.success && data.data) {
                    const d = data.data;
                    document.getElementById('comp-name').value = d.company_name || '';
                    document.getElementById('comp-address').value = d.address || '';
                    document.getElementById('comp-contacts').value = d.contact_numbers || '';
                    document.getElementById('comp-logo-url').value = d.logo_url || '';
                    document.getElementById('comp-favicon-url').value = d.favicon_url || '';
                    if (document.getElementById('comp-invoice-template')) {
                        document.getElementById('comp-invoice-template').value = d.invoice_template || 'classic';
                    }

                    this.updateCompanyPreview('logo', d.logo_url);
                    this.updateCompanyPreview('favicon', d.favicon_url);
                }
            }
        } catch (err) {
            console.error('Error loading company details:', err);
        }
    }

    async handleCompanySubmit(e) {
        if (e) e.preventDefault();
        const payload = {
            company_name: document.getElementById('comp-name').value,
            address: document.getElementById('comp-address').value,
            contact_numbers: document.getElementById('comp-contacts').value,
            logo_url: document.getElementById('comp-logo-url').value,
            favicon_url: document.getElementById('comp-favicon-url').value,
            invoice_template: document.getElementById('comp-invoice-template')?.value || 'classic'
        };

        try {
            const res = await this.apiCall('/api/settings/company', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification('Company profile updated successfully');
                    this.applyCompanySettings(payload);
                } else {
                    this.showNotification(data.error || 'Update failed', 'error');
                }
            }
        } catch (err) {
            this.showNotification('Error: ' + err.message, 'error');
        }
    }

    async handleCompanyFileUpload(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            this.showNotification(`Uploading ${type}...`, 'info');
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'user-role': this.currentUser.role },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById(`comp-${type}-url`).value = data.imageUrl;
                this.updateCompanyPreview(type, data.imageUrl);
                this.showNotification(`${type} uploaded successfully`);
            } else {
                this.showNotification('Upload failed', 'error');
            }
        } catch (err) {
            this.showNotification('Upload error: ' + err.message, 'error');
        }
    }

    updateCompanyPreview(type, url) {
        const preview = document.getElementById(`comp-${type}-preview`);
        const placeholder = document.getElementById(`comp-${type}-placeholder`);
        if (url) {
            if (preview) {
                preview.src = url;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        } else {
            if (preview) preview.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';
        }
    }

    applyCompanySettings(d) {
        if (d.company_name) {
            document.title = d.company_name + ' - Dashboard';
            const nameEl = document.getElementById('main-company-name');
            if (nameEl) nameEl.textContent = d.company_name;
            const subEl = document.getElementById('main-company-sub');
            if (subEl) subEl.textContent = 'DISTRIBUTION SYSTEM'; // Or something dynamic
        }

        if (d.favicon_url) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'shortcut icon';
                document.head.appendChild(link);
            }
            link.href = d.favicon_url;
        }

        if (d.logo_url) {
            const logoImg = document.getElementById('main-logo-img');
            const logoIcon = document.getElementById('main-logo-icon');
            if (logoImg) {
                logoImg.src = d.logo_url;
                logoImg.style.display = 'block';
            }
            if (logoIcon) logoIcon.style.display = 'none';
        }

        if (d.invoice_template) {
            localStorage.setItem('active_invoice_template', d.invoice_template);
        }
    }

    // --- CALCULATOR LOGIC ---
    toggleCalculator() {
        const calc = document.getElementById('calculator-popup');
        calc.classList.toggle('active');
        if (calc.classList.contains('active')) {
            this.calcClear();
            this.makeDraggable(calc);
            // Hide history when opening main calculator
            document.getElementById('calc-history-list').classList.remove('active');
        }
    }

    toggleCalcHistory() {
        const historyList = document.getElementById('calc-history-list');
        historyList.classList.toggle('active');
        this.renderCalcHistory();
    }

    clearCalcHistory() {
        this.calculationHistory = [];
        this.renderCalcHistory();
    }

    renderCalcHistory() {
        const items = document.getElementById('calc-history-items');
        if (!items) return;

        if (this.calculationHistory.length === 0) {
            items.innerHTML = '<div style="color: #64748b; text-align: center; margin-top: 20px;">No history yet</div>';
            return;
        }

        items.innerHTML = this.calculationHistory.map((h, i) => `
            <div class="calc-history-item" onclick="app.loadCalcHistoryItem(${i})">
                <span class="calc-hist-expr">${h.expression}</span>
                <span class="calc-hist-res">${h.result}</span>
            </div>
        `).join('');
    }

    loadCalcHistoryItem(index) {
        const item = this.calculationHistory[index];
        const res = document.getElementById('calc-result');
        const history = document.getElementById('calc-history');

        res.textContent = item.result;
        history.textContent = item.expression;
        this.calcOperand1 = parseFloat(item.result);
        this.calcOperator = null;
        this.shouldResetCalc = true;

        // Hide history list
        document.getElementById('calc-history-list').classList.remove('active');
    }

    calcNum(num) {
        let res = document.getElementById('calc-result');
        let history = document.getElementById('calc-history');
        if (num === '.' && res.textContent.includes('.')) return; // Prevent multiple decimals

        if (res.textContent === '0' || this.shouldResetCalc) {
            res.textContent = (num === '.' ? '0.' : num);
            this.shouldResetCalc = false;
        } else {
            res.textContent += num;
        }

        // Show full running expression in history
        history.textContent = this.calcExpression + ' ' + res.textContent;
        // Scroll history to the right
        history.scrollLeft = history.scrollWidth;
    }

    calcOp(op) {
        let res = document.getElementById('calc-result');
        let history = document.getElementById('calc-history');

        let currentValue = parseFloat(res.textContent);
        if (isNaN(currentValue)) currentValue = 0;

        // If there's already a pending operation, calculate it first
        if (this.calcOperator && !this.shouldResetCalc) {
            const result = this.performCalculation(this.calcOperand1, currentValue, this.calcOperator);
            this.calcOperand1 = result;
            res.textContent = result;
            this.calcExpression += ' ' + currentValue + ' ' + (op === '*' ? '×' : op === '/' ? '÷' : op);
        } else {
            this.calcOperand1 = currentValue;
            this.calcExpression = currentValue + ' ' + (op === '*' ? '×' : op === '/' ? '÷' : op);
        }

        this.calcOperator = op;
        history.textContent = this.calcExpression;
        this.shouldResetCalc = true;
        history.scrollLeft = history.scrollWidth;
    }

    performCalculation(v1, v2, op) {
        let result = 0;
        switch (op) {
            case '+': result = v1 + v2; break;
            case '-': result = v1 - v2; break;
            case '*': result = v1 * v2; break;
            case '/': result = v2 !== 0 ? v1 / v2 : 'Error'; break;
        }
        // Round to 8 decimal places to avoid floating point issues, then parse back to number
        return typeof result === 'number' ? Math.round(result * 100000000) / 100000000 : result;
    }

    calcClear() {
        document.getElementById('calc-result').textContent = '0';
        document.getElementById('calc-history').textContent = '';
        this.calcOperand1 = null;
        this.calcOperator = null;
        this.shouldResetCalc = false;
        this.calcExpression = '';
    }

    calcBackspace() {
        let res = document.getElementById('calc-result');
        if (res.textContent.length > 1) {
            res.textContent = res.textContent.slice(0, -1);
        } else {
            res.textContent = '0';
        }
        this.updateCalcHistoryView();
    }

    calcPercentage() {
        let res = document.getElementById('calc-result');
        let val = parseFloat(res.textContent);
        if (!isNaN(val)) {
            res.textContent = (val / 100).toString();
            this.updateCalcHistoryView();
        }
    }

    calcMinusPlus() {
        let res = document.getElementById('calc-result');
        if (res.textContent.startsWith('-')) {
            res.textContent = res.textContent.substring(1);
        } else if (res.textContent !== '0') {
            res.textContent = '-' + res.textContent;
        }
        this.updateCalcHistoryView();
    }

    updateCalcHistoryView() {
        let res = document.getElementById('calc-result');
        let history = document.getElementById('calc-history');
        history.textContent = this.calcExpression + ' ' + res.textContent;
        history.scrollLeft = history.scrollWidth;
    }

    handleCalculatorKeyboard(e) {
        const calc = document.getElementById('calculator-popup');
        if (!calc || !calc.classList.contains('active')) return;

        // Numbers 0-9
        if (e.key >= '0' && e.key <= '9') {
            this.calcNum(e.key);
        }
        // Operators
        else if (['+', '-', '*', '/'].includes(e.key)) {
            this.calcOp(e.key);
        }
        // Decimal
        else if (e.key === '.' || e.key === ',') {
            this.calcNum('.');
        }
        // Enter / Equals
        else if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            this.calcEqual();
        }
        // Backspace
        else if (e.key === 'Backspace') {
            this.calcBackspace();
        }
        // Escape / Clear
        else if (e.key === 'Escape') {
            this.calcClear();
        }
        // Percentage
        else if (e.key === '%') {
            this.calcPercentage();
        }
    }

    calcEqual() {
        let res = document.getElementById('calc-result');
        let history = document.getElementById('calc-history');
        if (!this.calcOperator) return;

        const operand2 = parseFloat(res.textContent);
        const result = this.performCalculation(this.calcOperand1, operand2, this.calcOperator);

        const fullExpr = this.calcExpression + ' ' + operand2 + ' =';
        history.textContent = fullExpr;
        res.textContent = result;

        // Add to persistent history
        this.calculationHistory.unshift({
            expression: fullExpr,
            result: result
        });
        // Keep only last 50 items
        if (this.calculationHistory.length > 50) this.calculationHistory.pop();

        this.calcOperator = null;
        this.shouldResetCalc = true;
        this.calcExpression = ''; // Reset for next calculation
        history.scrollLeft = history.scrollWidth;
    }

    makeDraggable(el) {
        const header = el.querySelector('.calculator-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        header.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                el.style.top = (el.offsetTop - pos2) + "px";
                el.style.left = (el.offsetLeft - pos1) + "px";
            };
        };
    }

    // --- FULL SCREEN LOGIC ---
    toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    updateFullScreenIcon() {
        const icon = document.getElementById('fullscreen-icon');
        if (!icon) return;
        if (document.fullscreenElement) {
            icon.classList.remove('fa-expand');
            icon.classList.add('fa-compress');
            document.getElementById('fullscreen-toggle').title = 'Exit Full Screen';
        } else {
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
            document.getElementById('fullscreen-toggle').title = 'Toggle Full Screen';
        }
    }


    async saveSettings() {
        const timeoutInput = document.getElementById('setting-timeout');
        const enabledInput = document.getElementById('setting-timer-enabled');

        const timeoutVal = timeoutInput?.value;
        const timerEnabled = enabledInput?.checked;

        alert('Attempting to save settings: Timeout=' + timeoutVal + ', Enabled=' + timerEnabled);

        if (timeoutVal && !isNaN(parseInt(timeoutVal))) {
            const mins = parseInt(timeoutVal);
            if (mins < 1 || mins > 120) {
                this.showNotification('Timeout must be between 1 and 120 minutes', 'error');
                return;
            }

            localStorage.setItem('session_timeout', mins.toString());
            localStorage.setItem('timer_enabled', timerEnabled ? 'true' : 'false');

            // Save Font Size
            const fontSizeInput = document.getElementById('setting-font-size');
            if (fontSizeInput) {
                localStorage.setItem('system_font_size', fontSizeInput.value);
            }

            localStorage.removeItem('session_expiry');

            alert('Settings persisted to localStorage');
            this.showNotification('Settings saved! reloading system...', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            this.showNotification('Please enter a valid number of minutes', 'error');
        }
    }


    async loadSettings() {
        // Load local user settings
        const timeout = localStorage.getItem('session_timeout') || '10';
        const enabled = localStorage.getItem('timer_enabled') !== 'false';

        const tInput = document.getElementById('setting-timeout');
        const eInput = document.getElementById('setting-timer-enabled');

        if (tInput) tInput.value = timeout;
        if (eInput) eInput.checked = enabled;
        if (tInput) tInput.disabled = !enabled;

        // Font size
        const fontSize = localStorage.getItem('system_font_size') || '100';
        const fsInput = document.getElementById('setting-font-size');
        const fsLabel = document.getElementById('font-size-label');
        if (fsInput) fsInput.value = fontSize;
        if (fsLabel) fsLabel.textContent = `${fontSize}%`;

        // Manage Tab Visibility based on Role
        const isAdm = (this.currentUser && this.currentUser.role === 'admin');

        // Show/Hide Admin Sidebar Links
        const companyLink = document.getElementById('nav-link-company');
        const dataLink = document.getElementById('nav-link-data');

        if (companyLink) companyLink.style.display = isAdm ? 'flex' : 'none';
        if (dataLink) dataLink.style.display = isAdm ? 'flex' : 'none';

        // Default to General Tab
        this.switchSettingsTab('general');

        if (isAdm) {
            // Fetch current company settings
            try {
                const res = await this.apiCall('/api/settings/company');
                if (res) {
                    const data = await res.json();
                    if (data.success && data.data) {
                        const c = data.data;
                        const elName = document.getElementById('comp-name');
                        if (elName) elName.value = c.company_name || '';

                        const elAddr = document.getElementById('comp-address');
                        if (elAddr) elAddr.value = c.address || '';

                        const elCont = document.getElementById('comp-contacts');
                        if (elCont) elCont.value = c.contact_numbers || '';

                        // Images
                        if (c.logo_url) {
                            const lu = document.getElementById('comp-logo-url');
                            if (lu) lu.value = c.logo_url;
                            const lp = document.getElementById('comp-logo-preview');
                            const lph = document.getElementById('comp-logo-placeholder');
                            if (lp) { lp.src = c.logo_url; lp.style.display = 'block'; }
                            if (lph) lph.style.display = 'none';
                        }
                        if (c.favicon_url) {
                            const fu = document.getElementById('comp-favicon-url');
                            if (fu) fu.value = c.favicon_url;
                            const fp = document.getElementById('comp-favicon-preview');
                            const fph = document.getElementById('comp-favicon-placeholder');
                            if (fp) { fp.src = c.favicon_url; fp.style.display = 'block'; }
                            if (fph) fph.style.display = 'none';
                        }

                        // Invoice Template
                        // Invoice Template
                        const currentTemplate = c.invoice_template || 'classic';
                        this.selectInvoiceTemplate(currentTemplate);

                        // Load Custom Config
                        if (c.invoice_custom_config) {
                            try {
                                const config = JSON.parse(c.invoice_custom_config);
                                if (document.getElementById('cfg-color')) document.getElementById('cfg-color').value = config.color || '#2E7D32';
                                if (document.getElementById('cfg-font')) document.getElementById('cfg-font').value = config.font || 'Inter, sans-serif';
                                if (document.getElementById('cfg-header')) document.getElementById('cfg-header').value = config.header || 'left';
                                if (document.getElementById('cfg-show-logo')) document.getElementById('cfg-show-logo').checked = config.showLogo !== false;
                                if (document.getElementById('cfg-show-footer')) document.getElementById('cfg-show-footer').checked = config.showFooter !== false;

                                this.updateCustomConfig(); // Update hidden input and labels
                            } catch (e) {
                                console.warn('Error parsing custom config', e);
                            }
                        }
                        const sel = document.getElementById('comp-invoice-template');
                        if (sel) sel.value = currentTemplate;
                    }
                }
            } catch (err) {
                console.error('Error loading company settings', err);
            }
        }
    }

    selectInvoiceTemplate(template) {
        // Update hidden select
        const sel = document.getElementById('comp-invoice-template');
        if (sel) sel.value = template;

        // Update radio (if not triggered by radio itself)
        const radio = document.getElementById('tpl-' + template);
        if (radio) radio.checked = true;

        // Update visuals
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        const activeCardLabel = document.querySelector(`label[for="tpl-${template}"]`);
        if (activeCardLabel) activeCardLabel.classList.add('selected');

        // Update text
        const disp = document.getElementById('current-template-display');
        if (disp) disp.textContent = template.charAt(0).toUpperCase() + template.slice(1);

        // Toggle Custom Config Panel
        const configPanel = document.getElementById('custom-template-config');
        if (configPanel) {
            configPanel.style.display = (template === 'custom') ? 'block' : 'none';
        }
    }

    updateCustomConfig() {
        const config = {
            color: document.getElementById('cfg-color').value,
            font: document.getElementById('cfg-font').value,
            header: document.getElementById('cfg-header').value,
            showLogo: document.getElementById('cfg-show-logo').checked,
            showFooter: document.getElementById('cfg-show-footer').checked
        };

        // Update Color Label
        const colorVal = document.getElementById('cfg-color-val');
        if (colorVal) colorVal.textContent = config.color;

        // Save to hidden JSON input
        const jsonInput = document.getElementById('invoice_custom_config_json');
        if (jsonInput) jsonInput.value = JSON.stringify(config);
    }

    previewInvoiceTemplate(template) {
        let url = `/print-invoice.html?preview=true&template=${template}`;

        if (template === 'custom') {
            // Get current config from form to allow previewing without saving
            const config = {
                color: document.getElementById('cfg-color').value,
                font: document.getElementById('cfg-font').value,
                header: document.getElementById('cfg-header').value,
                showLogo: document.getElementById('cfg-show-logo').checked,
                showFooter: document.getElementById('cfg-show-footer').checked
            };
            const encoded = encodeURIComponent(JSON.stringify(config));
            url += `&customConfig=${encoded}`;
        }

        window.open(url, '_blank', 'width=900,height=1200');
    }

    switchSettingsTab(tabName, event) {
        if (event) event.preventDefault();

        // Hide all tabs
        document.querySelectorAll('.settings-tab-pane').forEach(el => el.style.display = 'none');
        // Deselect all links
        document.querySelectorAll('.settings-link').forEach(el => {
            el.classList.remove('active');
            el.style.background = 'transparent';
            el.style.color = el.id === 'nav-link-data' ? 'var(--error)' : 'var(--gray-600)';
            el.style.boxShadow = 'none';
        });

        // Show selected tab
        const target = document.getElementById('tab-settings-' + tabName);
        if (target) {
            target.style.display = 'block';
        }

        // Activate link
        // Try precise match first, then broader
        let link = document.querySelector(`.settings-link[href="#settings-${tabName}"]`);

        if (link) {
            link.classList.add('active');
            link.style.background = 'white';
            link.style.color = tabName === 'data' ? 'var(--error)' : 'var(--primary-green)';
            if (tabName !== 'data') link.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
        }

        if (tabName === 'backup') {
            this.loadBackupSettings();
            this.loadBackups();
        }
    }

    async handleDataReset() {
        if (!confirm('CRITICAL WARNING: This will permanently DELETE all sales, payments, expenses, logs, etc. This action CANNOT be undone.\n\nAre you absolutely sure you want to reset all transaction data?')) {
            return;
        }

        // Double confirmation
        const code = Math.floor(1000 + Math.random() * 9000);
        const input = prompt(`Please enter the confirmation code "${code}" to confirm reset:`);
        if (input !== code.toString()) {
            alert('Incorrect confirmation code. Reset cancelled.');
            return;
        }

        try {
            this.showNotification('Resetting data...', 'info');
            const res = await this.apiCall('/api/settings/reset-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    alert('Data reset successfully. The system will now reload.');
                    window.location.reload();
                } else {
                    this.showNotification(data.error || 'Reset failed', 'error');
                }
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Error during reset', 'error');
        }
    }

    async handleCompanyFileUpload(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'user-role': this.currentUser.role }, // Simple role check
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                const url = data.imageUrl;
                if (type === 'logo') {
                    document.getElementById('comp-logo-url').value = url;
                    document.getElementById('comp-logo-preview').src = url;
                    document.getElementById('comp-logo-preview').style.display = 'block';
                    document.getElementById('comp-logo-placeholder').style.display = 'none';
                } else if (type === 'favicon') {
                    document.getElementById('comp-favicon-url').value = url;
                    document.getElementById('comp-favicon-preview').src = url;
                    document.getElementById('comp-favicon-preview').style.display = 'block';
                    document.getElementById('comp-favicon-placeholder').style.display = 'none';
                }
            } else {
                this.showNotification('Upload failed: ' + data.error, 'error');
            }
        } catch (err) {
            this.showNotification('Upload error: ' + err.message, 'error');
        }
    }



    showNotification(m, t = 'success') {
        const n = document.createElement('div');
        n.style.cssText = `position:fixed; top:20px; right:20px; background:${t === 'success' ? '#2E7D32' : '#F44336'}; color:white; padding:12px 24px; border-radius:8px; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-weight:600;`;
        n.textContent = m;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    handleProductSearch(v) {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.loadProducts(v), 300);
    }

    autoCalculateCost() {
        const msrp = parseFloat(document.getElementById('p-msrp').value) || 0;
        const discount = parseFloat(document.getElementById('p-discount').value) || 0;
        const cost = msrp * (1 - (discount / 100));
        document.getElementById('p-cost').value = cost.toFixed(2);
    }

    // --- PAYMENT LOGIC ---
    async loadPayments() {
        const res = await this.apiCall('/api/payments');
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            document.getElementById('payment-table-body').innerHTML = data.data.map(p => `
                <tr>
                    <td><strong>${p.receipt_number}</strong></td>
                    <td>${this.parseDBDate(p.receipt_date).toLocaleDateString()}</td>
                    <td>${p.customer_name}</td>
                    <td>
                        <span class="badge ${p.receipt_category === 'return' ? 'badge-error' : 'badge-success'}" style="${p.receipt_category === 'return' ? 'background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.2);' : ''}">
                            ${(p.receipt_category || 'collection').toUpperCase()}
                        </span>
                    </td>
                    <td><span class="badge ${p.payment_type === 'cash' ? 'badge-success' : 'badge-primary'}">${p.payment_type.toUpperCase()}</span></td>
                    <td style="font-weight:700; color: ${p.receipt_category === 'return' ? '#ef4444' : 'inherit'}">
                        ${p.receipt_category === 'return' ? '-' : ''}LKR ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>${p.receiver_name || 'System'}</td>
                    <td><div class="action-btns">
                        ${this.hasPermission('payments', 'view') ? `<button class="btn-icon" onclick="app.printReceipt(${p.id})"><i class="fas fa-print"></i></button>` : ''}
                        ${this.hasPermission('payments', 'edit') ? `<button class="btn-icon text-warning" onclick='app.openPaymentModal(null, ${JSON.stringify(p)})'><i class="fas fa-edit"></i></button>` : ''}
                        ${this.hasPermission('payments', 'delete') ? `<button class="btn-icon text-danger" onclick="app.handleDeletePayment(${p.id})"><i class="fas fa-trash"></i></button>` : ''}
                    </div></td>
                </tr>
            `).join('') || '<tr><td colspan="7">No payments recorded</td></tr>';
        }
    }

    async printReceipt(receiptId) {
        // Open the print modal for Choice of Format
        this.printReceiptId = receiptId;
        const modal = document.getElementById('print-receipt-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        } else {
            // If modal not found, default to A4 in new tab
            window.open(`/print-receipt.html?id=${receiptId}&format=a4`, '_blank');
        }
    }

    executeReceiptPrint() {
        const format = document.querySelector('input[name="receipt-print-format"]:checked')?.value || 'a4';
        const receiptId = this.printReceiptId;
        const modal = document.getElementById('print-receipt-modal');

        if (receiptId) {
            window.open(`/print-receipt.html?id=${receiptId}&format=${format}`, '_blank');
        }

        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

    async openPaymentModal(customerId = null, editData = null) {
        const form = document.getElementById('payment-form');
        form.reset();
        const amountField = document.getElementById('pay-amount');
        const methodField = document.getElementById('pay-method');
        document.getElementById('pay-id').value = editData ? editData.id : '';

        this.collectionCheques = [];
        this.renderCollectionChequesList();
        document.getElementById('cheque-details-section').style.display = 'none';
        document.getElementById('add-collection-cheque-form').style.display = 'none';

        // Set default type
        const typeVal = editData ? (editData.receipt_category || 'collection') : 'collection';
        const typeRadios = form.querySelectorAll('input[name="receipt_category"]');
        typeRadios.forEach(r => {
            r.checked = r.value === typeVal;
            if (editData) r.disabled = true; // No changing type on edit for balance safety
            else r.disabled = false;
        });
        this.updatePaymentTypeUI();

        if (editData) {
            document.getElementById('pay-date').value = new Date(editData.receipt_date).toISOString().split('T')[0];
            document.getElementById('pay-receiver').value = editData.receiver_name || '';

            amountField.value = editData.amount;
            amountField.disabled = false; // Enabled for Admin enhancement

            methodField.value = editData.payment_type;
            methodField.disabled = false; // Enabled for Admin enhancement

            if (editData.payment_type === 'cheque') {
                document.getElementById('cheque-details-section').style.display = 'block';
                try {
                    const res = await this.apiCall(`/api/payments/${editData.id}`);
                    const fullData = await res.json();
                    if (fullData.success) {
                        if (fullData.data.cheques && fullData.data.cheques.length > 0) {
                            this.collectionCheques = fullData.data.cheques;
                            this.renderCollectionChequesList();
                        } else if (fullData.data.cheque) {
                            this.collectionCheques = [fullData.data.cheque];
                            this.renderCollectionChequesList();
                        }
                    }
                } catch (e) { console.error('Error loading cheque details:', e); }
            }
        } else {
            document.getElementById('pay-date').value = this.getLocalDateISO();
            amountField.disabled = false;
            methodField.disabled = false;
        }

        const res = await this.apiCall('/api/customers');
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('pay-customer');
            const selectedId = editData ? editData.customer_id : customerId;
            select.innerHTML = '<option value="">Select Customer</option>' +
                data.data.map(c => `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${c.name}</option>`).join('');

            if (editData) select.disabled = true;
            else select.disabled = false;

            // Load invoices if customer is selected
            if (selectedId) this.loadCustomerInvoices(selectedId);
            else document.getElementById('pay-invoice').innerHTML = '<option value="">Select Customer First</option>';
        }

        // Update button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = editData ? 'Update Payment' : 'Save Payment';

        document.getElementById('payment-modal').classList.add('active');
    }

    updatePaymentTypeUI() {
        const type = document.querySelector('input[name="receipt_category"]:checked').value;
        const colLabel = document.getElementById('label-pay-type-collection');
        const retLabel = document.getElementById('label-pay-type-return');
        const invoiceGroup = document.getElementById('pay-invoice-group');
        const modalTitle = document.querySelector('#payment-modal .modal-title');
        const submitBtn = document.querySelector('#payment-form button[type="submit"]');

        if (type === 'collection') {
            colLabel.style.background = 'var(--primary-green)';
            colLabel.style.color = 'white';
            retLabel.style.background = 'transparent';
            retLabel.style.color = 'var(--gray-600)';
            invoiceGroup.style.display = 'block';
            modalTitle.textContent = 'Record Collection';
            if (submitBtn && submitBtn.textContent.includes('Payment')) submitBtn.textContent = 'Save Collection';
        } else {
            retLabel.style.background = 'var(--error)';
            retLabel.style.color = 'white';
            colLabel.style.background = 'transparent';
            colLabel.style.color = 'var(--gray-600)';
            invoiceGroup.style.display = 'none'; // Cash returns usually not linked to specific invoice balance in this simple way
            modalTitle.textContent = 'Cash Return to Customer';
            if (submitBtn && submitBtn.textContent.includes('Payment')) submitBtn.textContent = 'Save Cash Return';
        }
    }

    async loadCustomerInvoices(customerId) {
        if (!customerId) {
            document.getElementById('pay-invoice').innerHTML = '<option value="">Select Customer First</option>';
            return;
        }
        const res = await this.apiCall(`/api/payments/outstanding/${customerId}`);
        if (!res) return;
        const data = await res.json();
        const select = document.getElementById('pay-invoice');
        if (data.success && data.data.length > 0) {
            select.innerHTML = '<option value="">General Payment (Not linked)</option>' +
                data.data.map(i => `<option value="${i.id}">${i.invoice_number} (Pending: LKR ${i.pending_amount.toLocaleString()})</option>`).join('');
        } else {
            select.innerHTML = '<option value="">No outstanding invoices</option>';
        }
    }




    async handleDeletePayment(id) {
        if (!confirm('Are you sure you want to delete this payment record? The customer balance will be adjusted automatically.')) return;
        const res = await this.apiCall(`/api/payments/${id}`, { method: 'DELETE' });
        if (!res) return;

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            if (data.success) {
                this.showNotification('Payment Deleted');
                this.loadPayments();
                this.loadDashboardData();
            } else {
                this.showNotification(data.message || 'Error deleting payment', 'error');
            }
        } else {
            this.showNotification('Server Error: Received non-JSON response', 'error');
            console.error('Non-JSON response:', await res.text());
        }
    }

    // --- VISIT LOGIC ---
    async loadVisits() {
        const search = document.getElementById('visit-search')?.value || '';
        const dateFrom = document.getElementById('visit-date-from')?.value || '';
        const dateTo = document.getElementById('visit-date-to')?.value || '';
        const routeId = document.getElementById('visit-route-filter')?.value || '';
        const status = document.getElementById('visit-status-filter')?.value || '';

        let url = `/api/visits?1=1`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (dateFrom) url += `&date_from=${dateFrom}`;
        if (dateTo) url += `&date_to=${dateTo}`;
        if (routeId) url += `&route_id=${routeId}`;
        if (status) url += `&shop_status=${status}`;

        const res = await this.apiCall(url);
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            document.getElementById('visit-table-body').innerHTML = data.data.map(v => `
                <tr>
                    <td>${this.parseDBDate(v.visit_date).toLocaleDateString()}</td>
                    <td><strong>${v.customer_name}</strong></td>
                    <td>${v.route_name}</td>
                    <td><span class="badge ${v.shop_status === 'open' ? 'badge-success' : 'badge-error'}">${v.shop_status.toUpperCase()}</span></td>
                    <td style="font-size:0.85rem">${v.remarks || '-'}</td>
                    <td>${v.user_name}</td>
                    <td>
                        <div class="action-btns">
                            ${this.hasPermission('visits', 'edit') ? `<button class="btn-icon btn-edit" title="Edit Visit" onclick="app.openVisitModal(${JSON.stringify(v).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>` : ''}
                            ${this.hasPermission('visits', 'delete') ? `<button class="btn-icon btn-delete" title="Delete Visit" onclick="app.handleDelete('visits', ${v.id}, 'Visit on ${v.visit_date}')"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="7">No visit logs found</td></tr>';
        }
    }

    async openVisitModal(v = null) {
        const form = document.getElementById('visit-form');
        form.reset();

        document.getElementById('visit-id').value = v?.id || '';
        document.getElementById('visit-modal-title').textContent = v ? 'Edit Shop Visit' : 'Log Shop Visit';
        document.getElementById('visit-date').value = v ? v.visit_date : this.getLocalDateISO();

        // Load customers
        const res = await this.apiCall('/api/customers');
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            const customerSelect = document.getElementById('visit-customer');
            customerSelect.innerHTML = '<option value="">Select Customer</option>' +
                data.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

            if (v) customerSelect.value = v.customer_id;
        }

        if (v) {
            document.getElementById('visit-status').value = v.shop_status;
            document.getElementById('visit-remarks').value = v.remarks || '';
        }

        document.getElementById('visit-modal').classList.add('active');
    }

    async handleVisitSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('visit-id').value;
        const d = {
            customer_id: document.getElementById('visit-customer').value,
            visit_date: document.getElementById('visit-date').value,
            shop_status: document.getElementById('visit-status').value,
            remarks: document.getElementById('visit-remarks').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/visits/${id}` : '/api/visits';

        const res = await this.apiCall(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'user-id': this.currentUser.id },
            body: JSON.stringify(d)
        });
        if (!res) return;
        const resData = await res.json();
        if (resData.success) {
            this.showNotification(id ? 'Visit Updated' : 'Visit Logged');
            document.getElementById('visit-modal').classList.remove('active');
            document.getElementById('visit-modal').style.display = 'none';
            this.loadVisits();
            this.loadDashboardData();
        }
    }

    async loadVisitFilters() {
        const res = await this.apiCall('/api/master/routes');
        if (!res) return;
        const data = await res.json();
        if (data.success) {
            const routeFilter = document.getElementById('visit-route-filter');
            if (routeFilter) {
                routeFilter.innerHTML = '<option value="">All Routes</option>' +
                    data.data.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
            }
        }
    }

    resetVisitFilters() {
        document.getElementById('visit-search').value = '';
        document.getElementById('visit-date-from').value = '';
        document.getElementById('visit-date-to').value = '';
        document.getElementById('visit-route-filter').value = '';
        document.getElementById('visit-status-filter').value = '';
        this.loadVisits();
    }

    // --- LOGGING LOGIC ---
    async loadLogs() {
        try {
            // Show clear button only for admins
            const clearBtn = document.getElementById('clear-logs-btn');
            if (clearBtn) {
                clearBtn.style.display = this.currentUser?.role === 'admin' ? 'block' : 'none';
            }

            const res = await this.apiCall('/api/dashboard/logs');
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const body = document.getElementById('logs-table-body');
                if (body) {
                    body.innerHTML = data.data.map(l => {
                        const isError = l.action === 'ERROR';
                        return `
                        <tr style="${isError ? 'background: rgba(244, 67, 54, 0.05);' : ''}">
                            <td><small>${this.parseDBDate(l.created_at).toLocaleString()}</small></td>
                            <td><div style="font-weight:600">${l.user_name || 'System'}</div></td>
                            <td><span class="badge ${isError ? 'badge-error' : 'badge-success'}" style="font-size: 0.7rem;">${l.action}</span></td>
                            <td>
                                <div style="font-size: 0.85rem; max-width: 500px; word-break: break-all;">
                                    <strong>${l.table_name || ''}</strong>: ${l.details || ''}
                                </div>
                            </td>
                        </tr>
                    `}).join('') || '<tr><td colspan="4">No logs found</td></tr>';
                }
            }
        } catch (err) {
            alert('Load Logs Warning: ' + err.message);
            const body = document.getElementById('logs-table-body');
            if (body) body.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--gray-500);">System logs are not available at this time.</td></tr>';
        }
    }

    async handleClearLogs() {
        if (!confirm('Are you ABSOLUTELY sure you want to delete ALL system audit and error logs? This action cannot be undone.')) return;

        try {
            const res = await this.apiCall('/api/dashboard/logs', {
                method: 'DELETE'
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification('All system logs have been cleared', 'success');
                    this.loadLogs();
                } else {
                    this.showNotification(data.error || 'Failed to clear logs', 'error');
                }
            }
        } catch (err) {
            this.showNotification('Error clearing logs: ' + err.message, 'error');
        }
    }

    // --- BULK IMPORT/EXPORT ---
    async exportProductsToExcel() {
        try {
            this.showNotification('Preparing Excel export...', 'info');
            const res = await fetch('/api/products/export/excel', {
                headers: { 'user-role': this.currentUser.role }
            });
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `products_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.showNotification('Excel export completed', 'success');
        } catch (err) {
            this.showNotification('Export failed: ' + err.message, 'error');
        }
    }

    async exportProductsToPDF() {
        try {
            this.showNotification('Generating PDF...', 'info');
            const res = await this.apiCall('/api/products');
            if (!res) return;
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

            doc.setFontSize(20);
            doc.text('M.K.C. TRADE CENTER - Product Catalog', 14, 22);
            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            const tableData = data.data.map((p, i) => [
                i + 1,
                p.reference_code || '-',
                p.name,
                p.chemical_name || '-',
                p.category_name || '-',
                p.brand_name || '-',
                p.supplier_name || '-',
                p.size || '-',
                `${p.unit} (${p.units_per_carton}/Crt)`,
                p.initial_stock,
                `LKR ${p.msrp.toFixed(2)}`,
                p.status.toUpperCase()
            ]);

            doc.autoTable({
                startY: 40,
                head: [['#', 'SKU', 'Product Name', 'Chemical Name', 'Category', 'Brand', 'Supplier', 'Size', 'Unit Info', 'Stock', 'MSRP', 'Status']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [46, 125, 50] },
                styles: { fontSize: 8, cellPadding: 2 }
            });

            doc.save(`products_catalog_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showNotification('PDF export completed', 'success');
        } catch (err) {
            console.error('PDF Export Error:', err);
            this.showNotification('PDF generation failed', 'error');
        }
    }

    async handleProductImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm(`Are you sure you want to import products from ${file.name}?`)) {
            e.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showNotification('Importing products, please wait...', 'info');
            const res = await fetch('/api/products/import', {
                method: 'POST',
                headers: { 'user-role': this.currentUser.role },
                body: formData
            });

            const result = await res.json();
            if (result.success) {
                let msg = result.message;
                if (result.errors) {
                    msg += `\n\nThere were errors in some rows:\n${result.errors.slice(0, 5).join('\n')}`;
                    if (result.errors.length > 5) msg += `\n...and ${result.errors.length - 5} more errors.`;
                }
                alert(msg);
                this.loadProducts();
                this.showNotification('Import process finished', 'success');
            } else {
                this.showNotification(result.message || 'Import failed', 'error');
            }
        } catch (err) {
            console.error('Import Error:', err);
            this.showNotification('Network error during import', 'error');
        } finally {
            e.target.value = '';
        }
    }

    async exportSuppliersToExcel() {
        try {
            this.showNotification('Preparing Excel export...', 'info');
            const res = await fetch('/api/suppliers/export/excel', {
                headers: { 'user-role': this.currentUser.role }
            });
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `suppliers_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.showNotification('Excel export completed', 'success');
        } catch (err) {
            this.showNotification('Export failed: ' + err.message, 'error');
        }
    }

    async exportSuppliersToPDF() {
        try {
            this.showNotification('Generating PDF...', 'info');
            const res = await this.apiCall('/api/suppliers');
            if (!res) return;
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4'); // Portrait

            doc.setFontSize(20);
            doc.text('M.K.C. TRADE CENTER - Supplier List', 14, 22);
            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            const tableData = data.data.map((s, i) => [
                i + 1,
                s.name,
                s.category || '-',
                s.address || '-',
                s.contact || '-',
                s.tsr_name || '-',
                s.area_manager_name || '-'
            ]);

            doc.autoTable({
                startY: 40,
                head: [['#', 'Supplier Name', 'Category', 'Address', 'Contact', 'TSR', 'Area Manager']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [46, 125, 50] },
                styles: { fontSize: 8, cellPadding: 2 }
            });

            doc.save(`suppliers_list_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showNotification('PDF export completed', 'success');
        } catch (err) {
            console.error('PDF Export Error:', err);
            this.showNotification('PDF generation failed', 'error');
        }
    }

    async handleSupplierImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm(`Are you sure you want to import suppliers from ${file.name}?`)) {
            e.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showNotification('Importing suppliers, please wait...', 'info');
            const res = await fetch('/api/suppliers/import', {
                method: 'POST',
                headers: { 'user-role': this.currentUser.role },
                body: formData
            });

            const result = await res.json();
            if (result.success) {
                let msg = result.message;
                if (result.errors) {
                    msg += `\n\nThere were errors in some rows:\n${result.errors.slice(0, 5).join('\n')}`;
                    if (result.errors.length > 5) msg += `\n...and ${result.errors.length - 5} more errors.`;
                }
                alert(msg);
                this.loadSuppliers();
                this.showNotification('Import process finished', 'success');
            } else {
                this.showNotification(result.message || 'Import failed', 'error');
            }
        } catch (err) {
            console.error('Import Error:', err);
            this.showNotification('Network error during import', 'error');
        } finally {
            e.target.value = '';

        }

    }



    async handlePaymentSubmit(e) {
        e.preventDefault();
        const payId = document.getElementById('pay-id').value;
        const payMethod = document.getElementById('pay-method').value;

        const payload = {
            customer_id: document.getElementById('pay-customer').value,
            amount: document.getElementById('pay-amount').value,
            receipt_date: document.getElementById('pay-date').value,
            payment_type: payMethod,
            receipt_category: document.querySelector('input[name="receipt_category"]:checked').value,
            receiver_name: document.getElementById('pay-receiver').value,
            collected_by: this.currentUser.id,
            cheques: payMethod === 'cheque' ? this.collectionCheques : null
        };

        const invoiceId = document.getElementById('pay-invoice').value;
        if (invoiceId && !payId) { // Only for new payments
            payload.allocations = [{ invoice_id: invoiceId, amount: payload.amount }];
        }

        try {
            const method = payId ? 'PUT' : 'POST';
            const url = payId ? `/api/payments/${payId}` : '/api/payments';

            // Note: Since we are sending complex JSON (cheques array), 
            // and we previously used FormData for images, let's keep it simple.
            // If No images are uploaded in collection modal currently (we had it but I removed it to simplify),
            // we can just use JSON.
            const res = await this.apiCall(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                this.showNotification(payId ? 'Payment updated' : 'Payment recorded', 'success');
                document.getElementById('payment-modal').classList.remove('active');
                this.loadPayments();
                this.loadCustomers(); // Refresh balances
            } else {
                this.showNotification(result.error || 'Failed to save payment', 'error');
            }
        } catch (e) {
            console.error('Payment Save Error:', e);
            this.showNotification('Error saving payment', 'error');
        }
    }

    toggleAddCollectionCheque() {
        const el = document.getElementById('add-collection-cheque-form');
        if (el.style.display === 'none') {
            el.style.display = 'block';
            document.getElementById('pay-cheque-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('pay-cheque-num').focus();
        } else {
            el.style.display = 'none';
        }
    }

    addCollectionChequeToList() {
        const num = document.getElementById('pay-cheque-num').value;
        const date = document.getElementById('pay-cheque-date').value;
        const amount = parseFloat(document.getElementById('pay-cheque-amount-single').value) || 0;
        const bank = document.getElementById('pay-cheque-bank').value;

        if (!num || !date || amount <= 0 || !bank) {
            this.showNotification('Please fill all cheque details', 'warning');
            return;
        }

        this.collectionCheques.push({
            number: num,
            date: date,
            amount: amount,
            bank_name: bank // Repo expects bank_name for receipts
        });

        // Reset & Hide form
        document.getElementById('pay-cheque-num').value = '';
        document.getElementById('pay-cheque-date').value = '';
        document.getElementById('pay-cheque-amount-single').value = '';
        document.getElementById('pay-cheque-bank').value = '';
        document.getElementById('add-collection-cheque-form').style.display = 'none';

        this.renderCollectionChequesList();

        // Auto-update total amount if it's 0
        const total = this.collectionCheques.reduce((s, c) => s + c.amount, 0);
        const amountInput = document.getElementById('pay-amount');
        if (!amountInput.value || parseFloat(amountInput.value) === 0) {
            amountInput.value = total;
        }
    }

    renderCollectionChequesList() {
        const listDiv = document.getElementById('collection-cheques-list');
        if (this.collectionCheques.length === 0) {
            listDiv.innerHTML = '<div class="text-muted" style="font-size: 0.8rem; padding: 5px; border: 1px dashed #ddd; text-align: center;">No cheques added</div>';
            return;
        }

        listDiv.innerHTML = this.collectionCheques.map((c, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 5px; font-size: 0.85rem;">
                <div>
                    <div style="font-weight: 600;">#${c.number || c.cheque_number} - ${c.bank_name}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${c.date || c.cheque_date}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-weight: 700; color: var(--primary-green);">LKR ${parseFloat(c.amount).toFixed(2)}</div>
                    <button type="button" onclick="app.removeCollectionCheque(${i})" style="border: none; background: none; color: #ef4444; cursor: pointer;"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `).join('');
    }

    removeCollectionCheque(index) {
        this.collectionCheques.splice(index, 1);
        this.renderCollectionChequesList();
    }



    async handlePasswordChange(e) {
        e.preventDefault();

        const currentPass = document.getElementById('cp-current').value;
        const newPass = document.getElementById('cp-new').value;
        const confirmPass = document.getElementById('cp-confirm').value;

        if (newPass !== confirmPass) {
            return this.showNotification('New passwords do not match', 'error');
        }

        if (!this.currentUser || !this.currentUser.id) return;

        try {
            const res = await this.apiCall(`/api/users/${this.currentUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: newPass,
                    current_password: currentPass
                })
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification('Password updated successfully');
                    document.getElementById('change-password-form').reset();
                } else {
                    this.showNotification(data.message || 'Failed to update password', 'error');
                }
            }
        } catch (err) {
            this.showNotification('Error: ' + err.message, 'error');
        }
    }

    // --- VEHICLE MANAGEMENT LOGIC ---
    async loadVehicles(search = '') {
        try {
            const url = search ? `/api/vehicles?search=${encodeURIComponent(search)}` : '/api/vehicles';
            const res = await this.apiCall(url);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const body = document.getElementById('vehicle-table-body');
                const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f0f0f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23999'>No Image</text></svg>`;

                body.innerHTML = data.data.map(v => `
                    <tr>
                        <td><img src="${v.vehicle_image || placeholder}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;" onerror="this.src='${placeholder}'"></td>
                        <td>
                            <div style="font-weight:700; color:var(--primary-green-dark);">${v.registration_number}</div>
                            <div style="font-size: 0.8rem; color:#666;">Code: #${v.id}</div>
                        </td>
                        <td>
                            <div>${v.vehicle_type || 'N/A'}</div>
                            <small style="color:#666;">Cap: ${v.capacity || 'Not set'}</small>
                        </td>
                        <td>
                            <div style="font-weight: 500;">${v.driver_name || 'No Driver'}</div>
                        </td>
                        <td>
                            <span class="badge" style="background: #e2e8f0; color: #475569;">${v.fuel_type || 'N/A'}</span>
                        </td>
                        <td>
                            <span class="status-badge status-${v.status || 'active'}">${v.status || 'active'}</span>
                        </td>
                        <td>
                            <div class="action-btns">
                                <button class="btn-icon btn-edit" title="Edit Vehicle" onclick="app.openVehicleModal(${JSON.stringify(v).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon btn-delete" title="Delete Vehicle" onclick="app.handleDelete('vehicles', ${v.id}, '${v.registration_number}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center">No vehicles found</td></tr>';
            }
        } catch (err) {
            console.error('Error loading vehicles:', err);
        }
    }

    openVehicleModal(v = null) {
        document.getElementById('vehicle-form').reset();
        document.getElementById('vehicle-id').value = v?.id || '';
        document.getElementById('vehicle-modal-title').textContent = v ? 'Edit Vehicle Information' : 'Register New Vehicle';

        if (v) {
            document.getElementById('v-plate').value = v.registration_number || '';
            document.getElementById('v-type').value = v.vehicle_type || 'Truck';
            document.getElementById('v-driver').value = v.driver_name || '';
            document.getElementById('v-capacity').value = v.capacity || '';
            document.getElementById('v-fuel').value = v.fuel_type || 'Diesel';
            document.getElementById('v-status').value = v.status || 'active';
            document.getElementById('v-image-url').value = v.vehicle_image || '';
            this.updateVehiclePreview(v.vehicle_image);
        } else {
            this.updateVehiclePreview('');
        }

        const modal = document.getElementById('vehicle-modal');
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    async handleVehicleSubmit(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('vehicle-id').value;
        const payload = {
            registration_number: document.getElementById('v-plate').value,
            vehicle_type: document.getElementById('v-type').value,
            driver_name: document.getElementById('v-driver').value,
            capacity: document.getElementById('v-capacity').value,
            fuel_type: document.getElementById('v-fuel').value,
            status: document.getElementById('v-status').value,
            vehicle_image: document.getElementById('v-image-url').value
        };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/vehicles/${id}` : '/api/vehicles';
            const res = await this.apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification(id ? 'Vehicle updated successfully' : 'Vehicle registered successfully');
                    document.getElementById('vehicle-modal').style.display = 'none';
                    document.getElementById('vehicle-modal').classList.remove('active');
                    this.loadVehicles();
                } else {
                    this.showNotification(data.message || 'Error occurred', 'error');
                }
            }
        } catch (err) {
            this.showNotification('Submit Error: ' + err.message, 'error');
        }
    }

    async handleVehicleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'user-role': this.currentUser.role },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('v-image-url').value = data.imageUrl;
                this.updateVehiclePreview(data.imageUrl);
            } else {
                this.showNotification('Image upload failed', 'error');
            }
        } catch (err) {
            this.showNotification('Upload error: ' + err.message, 'error');
        }
    }

    updateVehiclePreview(url) {
        const preview = document.getElementById('v-image-preview');
        if (url) {
            preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            preview.innerHTML = `<i class="fas fa-truck" style="font-size: 2rem; color: #cbd5e1;"></i>`;
        }
    }


    // --- EXPENSES LOGIC ---
    async loadExpenses() {
        if (!this.hasPermission('expenses', 'view')) {
            const view = document.getElementById('expenses-view');
            if (view) view.innerHTML = '<div class="alert alert-error">Access Denied</div>';
            return;
        }

        const dateFrom = document.getElementById('expense-date-from')?.value;
        const dateTo = document.getElementById('expense-date-to')?.value;
        const cat = document.getElementById('expense-cat-filter')?.value;

        let url = `/api/expenses?1=1`;
        if (dateFrom) url += `&date_from=${dateFrom}`;
        if (dateTo) url += `&date_to=${dateTo}`;
        if (cat) url += `&category=${cat}`;

        const res = await this.apiCall(url);
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            const tbody = document.getElementById('expense-table-body');
            if (tbody) {
                tbody.innerHTML = data.data.map(e => `
                    <tr>
                        <td>${new Date(e.date).toLocaleDateString()}</td>
                        <td><span class="badge" style="background:#ddd;color:#333">${e.category}</span></td>
                        <td>${e.description || '-'}</td>
                        <td>${e.reference_no || '-'}</td>
                        <td style="font-weight:bold; color:var(--error);">LKR ${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${e.created_by || '-'}</td>
                        <td>
                            <div class="action-btns">
                                ${this.hasPermission('expenses', 'edit') ? `
                                    <button class="btn-icon btn-edit" onclick='app.openExpenseModal(${JSON.stringify(e).replace(/'/g, "&#39;")})'><i class="fas fa-edit"></i></button>
                                ` : ''}
                                ${this.hasPermission('expenses', 'delete') ? `
                                    <button class="btn-icon btn-delete" onclick="app.handleDelete('expenses', ${e.id}, 'Expense on ${e.date}')"><i class="fas fa-trash"></i></button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center">No expenses found</td></tr>';
            }
        }
    }

    openExpenseModal(e = null) {
        const form = document.getElementById('expense-form');
        if (form) form.reset();
        document.getElementById('expense-id').value = e?.id || '';
        document.getElementById('expense-modal-title').textContent = e ? 'Edit Expense' : 'Record Expense';

        if (e) {
            document.getElementById('ex-date').value = e.date;
            document.getElementById('ex-category').value = e.category;
            document.getElementById('ex-amount').value = e.amount;
            document.getElementById('ex-ref').value = e.reference_no || '';
            document.getElementById('ex-desc').value = e.description || '';
        } else {
            document.getElementById('ex-date').value = this.getLocalDateISO();
        }

        const modal = document.getElementById('expense-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }

    async handleExpenseSubmit(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('expense-id').value;
        const data = {
            date: document.getElementById('ex-date').value,
            category: document.getElementById('ex-category').value,
            amount: parseFloat(document.getElementById('ex-amount').value || 0),
            reference_no: document.getElementById('ex-ref').value,
            description: document.getElementById('ex-desc').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/expenses/${id}` : '/api/expenses';

        try {
            const res = await this.apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res) {
                const resData = await res.json();
                if (resData.success) {
                    this.showNotification(id ? 'Expense Updated' : 'Expense Recorded', 'success');
                    const modal = document.getElementById('expense-modal');
                    if (modal) {
                        modal.classList.remove('active');
                        setTimeout(() => modal.style.display = 'none', 300);
                    }

                    // Force refresh data
                    await this.loadExpenses();
                    await this.loadDashboardData();
                } else {
                    this.showNotification(resData.error || 'Error saving expense', 'error');
                }
            }
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }
    // --- DISTRIBUTION & LOAD MANAGEMENT ---
    async loadDistributionData() {
        if (!this.hasPermission('distribution', 'view')) return;

        const search = document.getElementById('load-search')?.value || '';
        const fromDate = document.getElementById('load-date-from')?.value || '';
        const toDate = document.getElementById('load-date-to')?.value || '';

        let query = `?search=${encodeURIComponent(search)}&fromDate=${fromDate}&toDate=${toDate}`;

        try {
            const [activeRes, allRes] = await Promise.all([
                this.apiCall('/api/distribution/active-loads' + query),
                this.apiCall('/api/distribution/loads' + query)
            ]);

            if (activeRes) {
                const active = await activeRes.json();
                this.renderLoadsTable(active.data, 'active-loads-table-body');
            }
            if (allRes) {
                const all = await allRes.json();
                this.renderLoadsTable(all.data, 'history-loads-table-body');
            }
        } catch (err) {
            this.showNotification('Error loading distribution data', 'error');
        }
    }

    resetDistributionFilters() {
        const search = document.getElementById('load-search');
        const from = document.getElementById('load-date-from');
        const to = document.getElementById('load-date-to');
        if (search) search.value = '';
        if (from) from.value = '';
        if (to) to.value = '';
        this.loadDistributionData();
    }

    renderLoadsTable(loads, tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        tbody.innerHTML = (loads || []).map(l => `
            <tr>
                <td>${new Date(l.load_date).toLocaleDateString()}</td>
                <td><strong>${l.registration_number}</strong></td>
                <td>${l.driver_name || '-'}</td>
                <td>${l.loaded_by_name || '-'}</td>
                <td><span class="badge ${l.status === 'loaded' ? 'bg-primary' : 'bg-success'}">${l.status.toUpperCase()}</span></td>
                <td>
                    <div class="action-btns">
                        ${l.status === 'loaded' ? `
                            <button class="btn btn-sm btn-primary" onclick="app.openUnloadModal(${l.id})">Unload/Reconcile</button>
                            <button class="btn-icon btn-edit" onclick="app.openLoadModal(${l.id})"><i class="fas fa-edit"></i></button>
                        ` : `
                            <button class="btn btn-sm btn-secondary" onclick="app.viewLoadReport(${l.id})">Report</button>
                        `}
                        <button class="btn-icon btn-delete" onclick="app.handleDeleteLoad(${l.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" class="text-center">No loads found</td></tr>';
    }

    switchDistributionTab(tab, btn) {
        const activeContainer = document.getElementById('active-loads-container');
        const historyContainer = document.getElementById('history-loads-container');
        const mapContainer = document.getElementById('map-loads-container');
        const filters = document.getElementById('distribution-filters');

        if (activeContainer) activeContainer.style.display = tab === 'active' ? 'block' : 'none';
        if (historyContainer) historyContainer.style.display = tab === 'history' ? 'block' : 'none';
        if (mapContainer) mapContainer.style.display = tab === 'map' ? 'block' : 'none';

        // Hide filters in map view to give more space
        if (filters) filters.style.display = tab === 'map' ? 'none' : 'block';

        if (tab === 'map') {
            setTimeout(() => this.initDistributionMap(), 100);
        }

        // Button styling
        if (btn && btn.parentElement) {
            btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }

    initDistributionMap() {
        if (this.distMap) {
            this.distMap.invalidateSize();
            return;
        }

        // Initial coordinates (Colombo, Sri Lanka center)
        const center = [6.9271, 79.8612];
        this.distMap = L.map('distribution-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(center, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(this.distMap);

        L.control.zoom({ position: 'topright' }).addTo(this.distMap);

        // Add Distribution Hub marker (Business location)
        const hubIcon = L.divIcon({
            html: `<div style="background: #3b82f6; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><i class="fas fa-warehouse"></i></div>`,
            className: 'custom-hub-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        L.marker(center, { icon: hubIcon }).addTo(this.distMap)
            .bindPopup('<b>DISTRIBUTION HUB</b><br>Primary Dispatch Center')
            .openPopup();

        this.loadMapData();
    }

    async loadMapData() {
        if (!this.distMap) return;

        const res = await this.apiCall('/api/customers?limit=1000');
        if (!res) return;
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            const markers = [];
            data.data.forEach(cust => {
                if (cust.latitude && cust.longitude) {
                    const color = cust.status === 'active' ? '#10b981' : '#ef4444';
                    const marker = L.circleMarker([cust.latitude, cust.longitude], {
                        radius: 8,
                        fillColor: color,
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(this.distMap);

                    marker.bindPopup(`
                        <div style="font-family: 'Inter', sans-serif;">
                            <strong style="display: block; font-size: 1rem; color: #1e293b; margin-bottom: 4px;">${cust.name}</strong>
                            <span style="font-size: 0.8rem; color: #64748b; display: block; margin-bottom: 8px;">
                                <i class="fas fa-location-dot"></i> ${cust.address || 'No address'}
                            </span>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee; padding-top: 8px;">
                                <span style="font-size: 0.75rem; font-weight: 700; color: ${cust.account_balance > 0 ? '#ef4444' : '#10b981'};">
                                    LKR ${this.formatCurrency(cust.account_balance)}
                                </span>
                                <span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; background: ${color}20; color: ${color}; font-weight: 700; text-transform: uppercase;">
                                    ${cust.status}
                                </span>
                            </div>
                        </div>
                    `);
                    markers.push([cust.latitude, cust.longitude]);
                }
            });

            if (markers.length > 0) {
                const bounds = L.latLngBounds(markers);
                this.distMap.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }

    // --- RMA (RETURNS & DAMAGES) LOGIC ---
    async loadRmaData() {
        const search = document.getElementById('rma-search')?.value || '';
        const status = document.getElementById('rma-status-filter')?.value || '';

        const res = await this.apiCall(`/api/rma?search=${encodeURIComponent(search)}&status=${status}`);
        if (!res) return;
        const data = await res.json();

        const tbody = document.getElementById('rma-table-body');
        if (!tbody) return;

        if (data.success && Array.isArray(data.data)) {
            tbody.innerHTML = data.data.map(r => `
                <tr>
                    <td><span class="badge badge-outline">${r.rma_number}</span></td>
                    <td>${this.parseDBDate(r.request_date).toLocaleDateString()}</td>
                    <td><div style="font-weight:700;">${r.customer_name}</div></td>
                    <td>${this.formatCurrency(r.total_value)}</td>
                    <td><span class="badge badge-${this.getRmaStatusColor(r.status)}">${r.status.toUpperCase()}</span></td>
                    <td>${r.handled_by_name}</td>
                    <td>
                        <div style="display:flex; gap:5px; justify-content: flex-end;">
                            <button class="btn btn-icon btn-info" onclick="app.printRma(${r.id})" title="Print RMA">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="btn btn-icon btn-secondary" onclick="app.openInspectModal(${r.id})" title="Inspect/Process">
                                <i class="fas fa-microscope"></i>
                            </button>
                            ${r.status === 'pending' ? `
                            <button class="btn btn-icon btn-danger" onclick="app.deleteRma(${r.id}, '${r.rma_number}')" title="Delete Pending">
                                <i class="fas fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="7" class="text-center">No return requests found.</td></tr>';
        }
    }

    getRmaStatusColor(status) {
        const colors = {
            pending: 'warning',
            inspected: 'info',
            approved: 'success',
            completed: 'success',
            rejected: 'danger'
        };
        return colors[status] || 'secondary';
    }

    resetRmaFilters() {
        if (document.getElementById('rma-search')) document.getElementById('rma-search').value = '';
        if (document.getElementById('rma-status-filter')) document.getElementById('rma-status-filter').value = '';
        this.loadRmaData();
    }

    switchRmaTab(tab) {
        const requests = document.getElementById('rma-requests-container');
        const ledger = document.getElementById('rma-ledger-container');
        const reqTab = document.getElementById('rma-tab-requests');
        const ledTab = document.getElementById('rma-tab-ledger');
        const btnNew = document.getElementById('btn-new-rma');

        if (tab === 'requests') {
            requests.style.display = 'block';
            ledger.style.display = 'none';
            reqTab.classList.add('active');
            ledTab.classList.remove('active');
            if (btnNew) btnNew.style.display = 'block';
            this.loadRmaData();
        } else {
            requests.style.display = 'none';
            ledger.style.display = 'block';
            reqTab.classList.remove('active');
            ledTab.classList.add('active');
            if (btnNew) btnNew.style.display = 'none';
            this.loadRmaLedger();
        }
    }

    async loadRmaLedger() {
        const res = await this.apiCall('/api/rma/ledger/damaged');
        if (!res) return;
        const data = await res.json();

        const tbody = document.getElementById('rma-ledger-body');
        if (!tbody) return;

        if (data.success && Array.isArray(data.data)) {
            tbody.innerHTML = data.data.map(l => `
                <tr>
                    <td>${this.parseDBDate(l.created_at).toLocaleDateString()}</td>
                    <td><div style="font-weight:700;">${l.product_name}</div></td>
                    <td><span class="badge badge-outline" style="font-size:0.9rem;">${l.quantity}</span></td>
                    <td><span class="badge badge-${l.type === 'damage' ? 'danger' : 'warning'}">${l.type.toUpperCase()}</span></td>
                    <td>
                        <div style="font-size:0.8rem; color:var(--gray-600);">${l.reason || 'N/A'}</div>
                        <div style="font-weight:700; color:var(--primary-green); font-size:0.75rem;">Source: ${l.rma_number || 'Direct'}</div>
                    </td>
                    <td>${l.remarks || '-'}</td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="text-center">Ledger is empty.</td></tr>';
        }
    }

    async deleteRma(id, number) {
        if (!confirm(`Are you sure you want to delete pending RMA ${number}?`)) return;

        const res = await this.apiCall(`/api/rma/${id}`, { method: 'DELETE' });
        if (res && res.ok) {
            this.showNotification('RMA deleted successfully', 'success');
            this.loadRmaData();
        }
    }

    async printRma(id) {
        const res = await this.apiCall(`/api/rma/${id}`);
        if (!res || !res.ok) return;
        const data = await res.json();
        const rma = data.data;

        const printWindow = window.open('', '_blank');
        const company = JSON.parse(localStorage.getItem('companyDetails') || '{}');

        printWindow.document.write(`
            <html>
            <head>
                <title>RMA Authorization - ${rma.rma_number}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
                    .title { font-size: 24px; font-weight: bold; color: #444; }
                    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    .meta-table td { padding: 8px 0; font-size: 14px; }
                    .item-table { width: 100%; border-collapse: collapse; }
                    .item-table th { background: #f8f9fa; text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6; }
                    .item-table td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 14px; }
                    .footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">RETURN AUTHORIZATION (RMA)</div>
                        <div style="margin-top:5px; color:#10b981;">${company.name || 'MKC TRADE CENTER'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold;">${rma.rma_number}</div>
                        <div>Date: ${this.parseDBDate(rma.request_date).toLocaleDateString()}</div>
                    </div>
                </div>
                
                <table class="meta-table">
                    <tr>
                        <td style="width:150px; color:#666;">Customer:</td>
                        <td style="font-weight:bold;">${rma.customer_name}</td>
                        <td style="width:150px; color:#666; text-align:right;">Status:</td>
                        <td style="font-weight:bold; text-align:right; text-transform:uppercase;">${rma.status}</td>
                    </tr>
                    <tr>
                        <td style="color:#666;">Handled By:</td>
                        <td>${rma.handled_by_name}</td>
                        <td style="color:#666; text-align:right;">Total Value:</td>
                        <td style="font-weight:bold; text-align:right;">${this.formatCurrency(rma.total_value)}</td>
                    </tr>
                </table>

                <table class="item-table">
                    <thead>
                        <tr>
                            <th>Product Description</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Subtotal</th>
                            <th>Reason / Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rma.items.map(it => `
                            <tr>
                                <td>${it.product_name}</td>
                                <td>${it.quantity}</td>
                                <td>${this.formatCurrency(it.unit_price)}</td>
                                <td>${this.formatCurrency(it.quantity * it.unit_price)}</td>
                                <td>${it.reason} (${it.condition})</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top:30px;">
                    <div style="font-weight:bold; margin-bottom:5px;">Remarks:</div>
                    <div style="font-size:14px; border:1px solid #eee; padding:10px; min-height:50px;">${rma.remarks || 'No additional remarks.'}</div>
                </div>

                <div class="footer">
                    * This is a computer-generated return authorization document.<br>
                    Generated on ${new Date().toLocaleString()}
                </div>
                <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    async openRmaModal() {
        try {
            const form = document.getElementById('rma-form');
            if (form) form.reset();
            document.getElementById('rma-items-body').innerHTML = '';
            document.getElementById('rma-date').value = this.getLocalDateISO();

            // Open modal early so user sees something while loading
            const modal = document.getElementById('rma-modal');
            modal.classList.add('active');
            modal.style.display = 'flex';

            document.getElementById('rma-total-value').textContent = this.formatCurrency(0);

            // Load Customers for dropdown
            const custRes = await this.apiCall('/api/customers?limit=1000');
            if (custRes && custRes.ok) {
                const custData = await custRes.json();
                const custSelect = document.getElementById('rma-customer');
                if (custSelect) {
                    custSelect.innerHTML = '<option value="">Select Customer</option>' +
                        custData.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                }
            }

            // Generate next RMA number
            const numRes = await this.apiCall('/api/rma/next-number');
            if (numRes && numRes.ok) {
                const numData = await numRes.json();
                if (numData.success) document.getElementById('rma-number').value = numData.data;
            }

            // Reset collection fields
            document.getElementById('rma-collection-point').value = 'warehouse';
            document.getElementById('rma-load-container').style.display = 'none';
            document.getElementById('rma-load').innerHTML = '<option value="">Select Active Load</option>';

            await this.addRmaItemRow(); // start with one row
        } catch (err) {
            console.error('Failed to open RMA modal:', err);
            this.showNotification('Error initializing return form', 'error');
            // Ensure modal at least opens if IDs exist
            const modal = document.getElementById('rma-modal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        }
    }

    async addRmaItemRow(itemData = null) {
        const tbody = document.getElementById('rma-items-body');
        if (!tbody) return;
        const rowId = `rma-row-${Date.now()}`;
        const row = document.createElement('tr');
        row.id = rowId;

        // We need products for the dropdown
        if (!this.allProducts) {
            try {
                const res = await this.apiCall('/api/products?limit=1000');
                if (res && res.ok) {
                    const data = await res.json();
                    this.allProducts = data.data;
                }
            } catch (err) {
                console.warn('Failed to fetch products for RMA:', err);
            }
        }

        const qty = itemData ? itemData.quantity : 1;
        const price = itemData ? itemData.msrp : 0;
        const productId = itemData ? itemData.product_id : '';

        row.innerHTML = `
            <td>
                <select class="form-control rma-product-select" style="margin:0;" required onchange="app.updateRmaItemPrice(this)">
                    <option value="">Search Product...</option>
                    ${this.allProducts?.map(p => `<option value="${p.id}" data-price="${p.msrp}" ${p.id == productId ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" step="0.01" class="form-control rma-qty" value="${qty}" style="margin:0;" required oninput="app.updateRmaTotal()"></td>
            <td><input type="number" step="0.01" class="form-control rma-price" value="${price}" style="margin:0;" required oninput="app.updateRmaTotal()"></td>
            <td><input type="text" class="form-control rma-reason" placeholder="e.g. Broken Seal" style="margin:0;" required></td>
            <td>
                <select class="form-control rma-condition" style="margin:0;">
                    <option value="damaged">Damaged</option>
                    <option value="sellable">Sellable (Market Return)</option>
                    <option value="expired">Expired</option>
                </select>
            </td>
            <td>
                <button type="button" class="btn btn-icon btn-danger" onclick="this.closest('tr').remove(); app.updateRmaTotal();" style="padding: 5px;">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        this.updateRmaTotal();
    }

    async toggleRmaLoadSelect(val) {
        const container = document.getElementById('rma-load-container');
        const select = document.getElementById('rma-load');
        if (val === 'truck') {
            container.style.display = 'block';
            select.innerHTML = '<option value="">Loading Loads...</option>';
            const res = await this.apiCall('/api/distribution/loads?status=loaded,on_route');
            if (res && res.ok) {
                const data = await res.json();
                select.innerHTML = '<option value="">Select Active Load</option>' +
                    data.data.map(l => `<option value="${l.id}">${l.truck_number} - ${l.route_name} (${this.parseDBDate(l.load_date).toLocaleDateString()})</option>`).join('');
            } else {
                select.innerHTML = '<option value="">Failed to load</option>';
            }
        } else {
            container.style.display = 'none';
            select.value = '';
        }
    }

    async handleRmaCustomerChange(customerId) {
        const invSelect = document.getElementById('rma-invoice');
        if (!invSelect) return;
        invSelect.innerHTML = '<option value="">Loading Invoices...</option>';

        if (!customerId) {
            invSelect.innerHTML = '<option value="">Select Invoice (Optional)</option>';
            return;
        }

        const res = await this.apiCall(`/api/sales?customer_id=${customerId}`);
        if (res && res.ok) {
            const data = await res.json();
            invSelect.innerHTML = '<option value="">Select Invoice (Optional)</option>' +
                data.data.map(i => `<option value="${i.id}">${i.invoice_number} (${this.parseDBDate(i.invoice_date).toLocaleDateString()} - ${this.formatCurrency(i.net_total)})</option>`).join('');
        } else {
            invSelect.innerHTML = '<option value="">Failed to load invoices</option>';
        }
    }

    async handleRmaInvoiceChange(invoiceId) {
        if (!invoiceId) return;

        this.showNotification('Loading invoice items...', 'info');
        const res = await this.apiCall(`/api/sales/${invoiceId}`);
        if (res && res.ok) {
            const data = await res.json();
            const invoice = data.data;

            if (invoice && invoice.items) {
                const tbody = document.getElementById('rma-items-body');
                tbody.innerHTML = ''; // Clear current rows
                for (const item of invoice.items) {
                    const discountedPrice = item.quantity > 0 ? (item.line_total / item.quantity) : item.msrp;
                    await this.addRmaItemRow({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        msrp: discountedPrice
                    });
                }
            }
        }
    }

    updateRmaItemPrice(select) {
        const price = select.options[select.selectedIndex].dataset.price;
        const row = select.closest('tr');
        const priceInput = row.querySelector('.rma-price');
        if (priceInput) priceInput.value = price || 0;
        this.updateRmaTotal();
    }

    updateRmaTotal() {
        let total = 0;
        document.querySelectorAll('#rma-items-body tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.rma-qty').value) || 0;
            const price = parseFloat(row.querySelector('.rma-price').value) || 0;
            total += qty * price;
        });
        const totalDisplay = document.getElementById('rma-total-value');
        if (totalDisplay) totalDisplay.textContent = this.formatCurrency(total);
    }

    async handleRmaSubmit(e) {
        e.preventDefault();
        const items = [];
        document.querySelectorAll('#rma-items-body tr').forEach(row => {
            const pId = row.querySelector('.rma-product-select').value;
            if (pId) {
                items.push({
                    product_id: pId,
                    quantity: parseFloat(row.querySelector('.rma-qty').value),
                    unit_price: parseFloat(row.querySelector('.rma-price').value),
                    reason: row.querySelector('.rma-reason').value,
                    condition: row.querySelector('.rma-condition').value
                });
            }
        });

        if (items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        const data = {
            rma_number: document.getElementById('rma-number').value,
            customer_id: document.getElementById('rma-customer').value,
            invoice_id: document.getElementById('rma-invoice').value || null,
            load_id: document.getElementById('rma-load').value || null,
            request_date: document.getElementById('rma-date').value,
            remarks: document.getElementById('rma-remarks').value,
            items
        };

        const res = await this.apiCall('/api/rma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res || !res.ok) {
            this.showNotification('Submission error. Please ensure the server has been restarted to apply changes.', 'error');
            return;
        }
        const resData = await res.json();
        if (resData.success) {
            this.showNotification('RMA Request Submitted', 'success');
            document.getElementById('rma-modal').classList.remove('active');
            document.getElementById('rma-modal').style.display = 'none';
            this.loadRmaData();
        } else {
            alert('Failed: ' + resData.error);
        }
    }

    async openInspectModal(id) {
        const res = await this.apiCall(`/api/rma/${id}`);
        if (!res || !res.ok) {
            this.showNotification('Error loading RMA details.', 'error');
            return;
        }
        const data = await res.json();
        const rma = data.data;

        document.getElementById('inspect-rma-id').value = rma.id;
        document.getElementById('inspect-rma-status').value = rma.status;
        this.toggleRmaActionFields();

        const content = document.getElementById('rma-details-content');
        content.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div>
                    <label style="color:var(--gray-500); font-size:0.75rem; text-transform:uppercase;">Customer</label>
                    <div style="font-weight:700;">${rma.customer_name}</div>
                </div>
                <div>
                    <label style="color:var(--gray-500); font-size:0.75rem; text-transform:uppercase;">Date</label>
                    <div style="font-weight:700;">${this.parseDBDate(rma.request_date).toLocaleDateString()}</div>
                </div>
            </div>
            <table class="data-table" style="font-size:0.85rem;">
                <thead>
                    <tr><th>Product</th><th>Qty</th><th>Reason</th><th>Condition</th></tr>
                </thead>
                <tbody>
                    ${rma.items.map(it => `
                        <tr>
                            <td>${it.product_name}</td>
                            <td>${it.quantity}</td>
                            <td>${it.reason}</td>
                            <td><span class="badge badge-outline">${it.condition.toUpperCase()}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('rma-inspect-modal').classList.add('active');
        document.getElementById('rma-inspect-modal').style.display = 'flex';
    }

    toggleRmaActionFields() {
        const status = document.getElementById('inspect-rma-status').value;
        document.getElementById('rma-action-fields').style.display = status === 'completed' ? 'block' : 'none';
    }

    async handleRmaStatusUpdate(e) {
        e.preventDefault();
        const id = document.getElementById('inspect-rma-id').value;
        const status = document.getElementById('inspect-rma-status').value;
        const action_taken = document.getElementById('inspect-rma-action').value;

        const res = await this.apiCall(`/api/rma/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, action_taken })
        });

        if (res) {
            this.showNotification('RMA Updated Successfully', 'success');
            document.getElementById('rma-inspect-modal').classList.remove('active');
            document.getElementById('rma-inspect-modal').style.display = 'none';
            this.loadRmaData();
        }
    }

    async openLoadModal(loadId = null) {
        const modal = document.getElementById('load-modal');
        const form = document.getElementById('load-form');
        form.reset();
        document.getElementById('load-id').value = loadId || '';
        document.getElementById('load-items-body').innerHTML = '';

        // Title update
        const titleEl = document.getElementById('load-modal-title');
        const btnEl = form.querySelector('button[type="submit"]');
        if (loadId) {
            titleEl.textContent = 'Edit Truck Load';
            btnEl.textContent = 'Update Truck Load';
        } else {
            titleEl.textContent = 'New Truck Load';
            btnEl.textContent = 'Save Truck Load';
            document.getElementById('l-date').value = this.getLocalDateISO();
        }

        // Load trucks
        const truckRes = await this.apiCall('/api/vehicles');
        if (truckRes) {
            const trucks = await truckRes.json();
            const select = document.getElementById('l-truck');
            if (select) {
                select.innerHTML = '<option value="">Select Truck</option>' +
                    trucks.data.map(t => `<option value="${t.id}">${t.registration_number} (${t.driver_name})</option>`).join('');
            }
        }

        if (loadId) {
            // Fetch load details
            const res = await this.apiCall(`/api/distribution/loads/${loadId}`);
            if (res) {
                const data = await res.json();
                if (data.success) {
                    const load = data.data;
                    document.getElementById('l-truck').value = load.truck_id;
                    document.getElementById('l-date').value = load.load_date;

                    if (load.items && load.items.length > 0) {
                        for (const item of load.items) {
                            await this.addLoadItemRow({
                                product_id: item.product_id,
                                quantity_loaded: item.quantity_loaded,
                                unit: item.unit
                            });
                        }
                    } else {
                        this.addLoadItemRow();
                    }
                }
            }
        } else {
            this.addLoadItemRow();
        }

        // Clear search
        const searchInput = document.getElementById('load-product-search');
        if (searchInput) searchInput.value = '';
        const resultsDiv = document.getElementById('load-search-results');
        if (resultsDiv) resultsDiv.style.display = 'none';

        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    async addLoadItemRow(data = null) {
        const tbody = document.getElementById('load-items-body');
        const row = document.createElement('tr');
        const rowId = 'li-' + Date.now();
        row.id = rowId;

        // Need products for the dropdown
        if (!this.productCache) {
            const res = await this.apiCall('/api/products?limit=1000');
            if (res) {
                const pData = await res.json();
                this.productCache = pData.data;
            }
        }

        // Try to calculate initial cartons if loading existing data
        let initialCartons = '';
        if (data && data.product_id) {
            const product = this.productCache.find(p => p.id == data.product_id);
            if (product && product.units_per_carton > 0 && data.quantity_loaded % product.units_per_carton === 0) {
                initialCartons = data.quantity_loaded / product.units_per_carton;
            }
        }

        row.innerHTML = `
            <td>
                <select class="form-control item-product" required onchange="app.updateLoadItemUnit(this)">
                    <option value="">Select Product</option>
                    ${this.productCache.map(p => `
                        <option value="${p.id}" 
                            data-unit="${p.unit || 'pcs'}" 
                            data-upc="${p.units_per_carton || 1}" 
                            ${data && data.product_id == p.id ? 'selected' : ''}>
                            ${p.name}
                        </option>
                    `).join('')}
                </select>
            </td>
            <td>
                <input type="number" class="form-control item-cartons" step="1" min="0" value="${initialCartons}" placeholder="0" style="margin-bottom: 0;"
                    oninput="app.updateLoadItemQtyFromCartons(this)">
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="number" class="form-control item-qty" step="0.01" value="${data ? data.quantity_loaded : ''}" required style="margin-bottom: 0;"
                        onkeydown="if(event.key === 'Enter'){ event.preventDefault(); document.getElementById('load-product-search').focus(); }"
                        oninput="app.updateLoadItemCartonsFromQty(this)">
                    <span class="unit-text text-muted" style="font-size: 0.8rem;">${data ? data.unit : ''}</span>
                </div>
            </td>
            <td>
                <button type="button" class="btn-icon text-error" onclick="document.getElementById('${rowId}').remove()"><i class="fas fa-minus-circle"></i></button>
            </td>
        `;
        tbody.appendChild(row);

        // Focus cartons field of the new row if it's from search
        if (data) {
            setTimeout(() => {
                const cartonInput = row.querySelector('.item-cartons');
                if (cartonInput) {
                    cartonInput.focus();
                    cartonInput.select();
                }
            }, 10);
        }
    }

    updateLoadItemQtyFromCartons(input) {
        const row = input.closest('tr');
        const select = row.querySelector('.item-product');
        const upc = parseFloat(select.options[select.selectedIndex]?.dataset.upc || 1);
        const cartons = parseFloat(input.value || 0);
        const qtyInput = row.querySelector('.item-qty');
        qtyInput.value = (cartons * upc).toFixed(2);
    }

    updateLoadItemCartonsFromQty(input) {
        const row = input.closest('tr');
        const select = row.querySelector('.item-product');
        const upc = parseFloat(select.options[select.selectedIndex]?.dataset.upc || 1);
        const qty = parseFloat(input.value || 0);
        const cartonInput = row.querySelector('.item-cartons');

        if (upc > 0 && qty % upc === 0) {
            cartonInput.value = qty / upc;
        } else if (upc > 0) {
            // If it's not a perfect multiple, maybe clear or show partial
            cartonInput.value = (qty / upc).toFixed(2);
        }
    }


    selectFirstLoadProduct() {
        const resultsDiv = document.getElementById('load-search-results');
        const firstResult = resultsDiv.querySelector('.search-result-item');
        if (firstResult && !firstResult.classList.contains('text-muted')) {
            firstResult.click();
        }
    }

    async searchLoadProducts(query) {
        const resultsDiv = document.getElementById('load-search-results');
        if (!query || query.length < 1) {
            resultsDiv.style.display = 'none';
            return;
        }

        if (!this.productCache) {
            const res = await this.apiCall('/api/products?limit=1000');
            if (res) {
                const pData = await res.json();
                this.productCache = pData.data;
            }
        }

        const filtered = this.productCache.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.tags && p.tags.toLowerCase().includes(query.toLowerCase())) ||
            (p.category_name && p.category_name.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 10);

        if (filtered.length > 0) {
            resultsDiv.innerHTML = filtered.map(p => `
                <div class="search-result-item" onclick="app.selectLoadProduct(${p.id})">
                    <div>
                        <div class="product-name">${p.name}</div>
                        <div class="product-info">${p.category_name || ''} ${p.brand_name ? '| ' + p.brand_name : ''}</div>
                    </div>
                    <div class="product-info">${p.unit || ''}</div>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = '<div class="search-result-item text-muted">No products found</div>';
            resultsDiv.style.display = 'block';
        }
    }

    selectLoadProduct(productId) {
        const product = this.productCache.find(p => p.id == productId);
        if (product) {
            // Remove the first empty row if it exists and is empty
            const tbody = document.getElementById('load-items-body');
            const rows = tbody.querySelectorAll('tr');
            if (rows.length === 1) {
                const firstSelect = rows[0].querySelector('.item-product');
                const firstQty = rows[0].querySelector('.item-qty');
                if (firstSelect && firstSelect.value === '' && firstQty && firstQty.value === '') {
                    rows[0].remove();
                }
            }

            this.addLoadItemRow({
                product_id: product.id,
                quantity_loaded: '',
                unit: product.unit
            });
            // Clear and hide search
            document.getElementById('load-product-search').value = '';
            document.getElementById('load-search-results').style.display = 'none';
        }
    }

    updateLoadItemUnit(select) {
        const row = select.closest('tr');
        const unit = select.options[select.selectedIndex].dataset.unit || '';
        row.querySelector('.unit-text').textContent = unit;

        // If there's already a carton count, re-calc quantity based on new product's UPC
        const cartonInput = row.querySelector('.item-cartons');
        if (cartonInput && cartonInput.value) {
            this.updateLoadItemQtyFromCartons(cartonInput);
        }
    }

    async handleLoadSubmit(e) {
        if (e) e.preventDefault();
        const items = [];
        document.querySelectorAll('#load-items-body tr').forEach(tr => {
            const productId = tr.querySelector('.item-product').value;
            const qty = tr.querySelector('.item-qty').value;
            if (productId && qty) items.push({ product_id: productId, quantity_loaded: parseFloat(qty) });
        });

        if (items.length === 0) return this.showNotification('Add at least one item', 'error');

        const loadId = document.getElementById('load-id').value;
        const data = {
            truck_id: document.getElementById('l-truck').value,
            load_date: document.getElementById('l-date').value,
            items: items,
            loaded_by: this.currentUser?.id || 1 // Fallback for local testing
        };

        try {
            const url = loadId ? `/api/distribution/loads/${loadId}` : '/api/distribution/loads';
            const method = loadId ? 'PUT' : 'POST';

            const res = await this.apiCall(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res) {
                const resData = await res.json();
                if (resData.success) {
                    this.showNotification(loadId ? 'Truck load updated successfully' : 'Truck load recorded successfully');
                    const modal = document.getElementById('load-modal');
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 300);
                    this.loadDistributionData();
                }
            }
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }

    async openUnloadModal(loadId) {
        const modal = document.getElementById('unload-modal');
        const res = await this.apiCall(`/api/distribution/loads/${loadId}`);
        if (!res) return;
        const load = (await res.json()).data;

        document.getElementById('ul-load-id').value = load.id;
        document.getElementById('ul-truck-id').value = load.truck_id;
        document.getElementById('ul-truck-no').textContent = load.registration_number;
        document.getElementById('ul-load-date').textContent = new Date(load.load_date).toLocaleDateString();
        document.getElementById('ul-date').value = this.getLocalDateISO();

        // Calculate sold quantity (using the variance API for prediction)
        const vRes = await this.apiCall(`/api/distribution/variance/${loadId}`);
        const varianceData = vRes ? (await vRes.json()).data : [];

        const tbody = document.getElementById('unload-items-body');
        tbody.innerHTML = load.items.map(item => {
            const vInfo = varianceData.find(v => v.product_name === item.product_name) || { sold: 0 };
            return `
                <tr data-product-id="${item.product_id}">
                    <td><strong>${item.product_name}</strong></td>
                    <td style="text-align: right;">${item.quantity_loaded} ${item.unit}</td>
                    <td style="text-align: right; color: var(--primary-green);">${vInfo.sold} ${item.unit}</td>
                    <td><input type="number" class="form-control form-control-sm ul-returned" step="0.01" value="0" oninput="app.calculateUnloadVariance(this, ${item.quantity_loaded}, ${vInfo.sold})"></td>
                    <td style="text-align: right;" class="ul-variance">0</td>
                    <td><input type="text" class="form-control form-control-sm ul-reason" placeholder="Reason if any"></td>
                </tr>
            `;
        }).join('');

        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    calculateUnloadVariance(input, loaded, sold) {
        const returned = parseFloat(input.value || 0);
        const variance = loaded - sold - returned;
        const cell = input.closest('tr').querySelector('.ul-variance');
        cell.textContent = variance.toFixed(2);
        cell.style.color = variance === 0 ? 'inherit' : 'var(--error)';
        cell.style.fontWeight = variance === 0 ? 'normal' : 'bold';
    }

    async handleUnloadSubmit(e) {
        if (e) e.preventDefault();
        const items = [];
        document.querySelectorAll('#unload-items-body tr').forEach(tr => {
            items.push({
                product_id: tr.dataset.productId,
                quantity_remaining: parseFloat(tr.querySelector('.ul-returned').value || 0),
                variance_reason: tr.querySelector('.ul-reason').value
            });
        });

        const data = {
            unload_date: document.getElementById('ul-date').value,
            load_id: document.getElementById('ul-load-id').value,
            truck_id: document.getElementById('ul-truck-id').value,
            items: items
        };

        try {
            const res = await this.apiCall('/api/distribution/unloads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res) {
                const resData = await res.json();
                if (resData.success) {
                    this.showNotification('Truck unloaded & stock reconciled');
                    const modal = document.getElementById('unload-modal');
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 300);
                    this.loadDistributionData();
                }
            }
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }

    async handleDeleteLoad(id) {
        if (!confirm('Are you sure you want to delete this truck load?')) return;
        try {
            const res = await this.apiCall(`/api/distribution/loads/${id}`, { method: 'DELETE' });
            if (res && (await res.json()).success) {
                this.showNotification('Load deleted');
                this.loadDistributionData();
            }
        } catch (err) {
            this.showNotification(err.message, 'error');
        }
    }

    async viewLoadReport(loadId) {
        const [loadRes, varRes] = await Promise.all([
            this.apiCall(`/api/distribution/loads/${loadId}`),
            this.apiCall(`/api/distribution/variance/${loadId}`)
        ]);

        if (!loadRes || !varRes) return;
        const load = (await loadRes.json()).data;
        const report = (await varRes.json()).data;

        const modal = document.getElementById('load-report-modal');
        const content = document.getElementById('load-report-content');

        if (content) {
            content.innerHTML = `
                <div style="margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                    <h4 style="margin: 0; color: var(--primary-green);">${load.registration_number} - Distribution Report</h4>
                    <p style="margin: 5px 0; color: #666; font-size: 0.9rem;">
                        <strong>Date:</strong> ${new Date(load.load_date).toLocaleDateString()} | 
                        <strong>Driver:</strong> ${load.driver_name || '-'} | 
                        <strong>Status:</strong> ${load.status.toUpperCase()}
                    </p>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th style="text-align: right;">Loaded</th>
                            <th style="text-align: right;">Sold</th>
                            <th style="text-align: right;">Returned</th>
                            <th style="text-align: right;">Shortage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(report || []).map(r => `
                            <tr>
                                <td><strong>${r.product_name}</strong></td>
                                <td style="text-align: right;">${r.loaded}</td>
                                <td style="text-align: right;">${r.sold}</td>
                                <td style="text-align: right;">${r.returned}</td>
                                <td style="text-align: right; color: ${r.variance > 0 ? 'var(--error)' : 'inherit'}; font-weight: ${r.variance > 0 ? 'bold' : 'normal'};">
                                    ${r.variance}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }
    // --- POS MODULE LOGIC ---

    async loadSalesPOS() {
        // Reset POS State for new session if needed
        document.getElementById('pos-date').value = this.getLocalDateISO();

        // Fetch next invoice number
        this.getNextInvoiceNumber();

        await Promise.all([
            this.loadPOSActiveLoads(),
            this.loadPOSCustomers()
        ]);

        // Default to first customer (Cash Customer) only if not already set (e.g. from recall)
        const custSelect = document.getElementById('pos-customer-selector');
        if (custSelect && !this.posState.currentInvoiceId && custSelect.selectedIndex === -1) {
            if (custSelect.options.length > 1) {
                // Find "Cash Customer" in options
                for (let i = 0; i < custSelect.options.length; i++) {
                    if (custSelect.options[i].text.includes('Cash')) {
                        custSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }

        this.updateCartUI();
    }

    async getNextInvoiceNumber() {
        try {
            const el = document.getElementById('pos-invoice-number');
            if (this.posState.currentInvoiceId) {
                // If editing/recalling, show current ID? Or fetch it?
                // Actually if recall, we have invoice object usually.
                // If new, fetch next.
                el.textContent = '(Recall Mode)';
                return;
            }

            const res = await this.apiCall('/api/sales/next-number');
            const data = await res.json();
            if (data.success && el) {
                el.textContent = '#' + data.data.nextNumber;
            }
        } catch (e) {
            console.error('Failed to get invoice number', e);
        }
    }

    async loadPOSActiveLoads() {
        try {
            const res = await this.apiCall('/api/pos/active-loads');
            const loads = await res.json();
            const selector = document.getElementById('pos-load-selector');
            if (selector) {
                const currentVal = selector.value;
                selector.innerHTML = '<option value="">Select Truck Load</option>' +
                    loads.map(l => `<option value="${l.id}">${l.vehicle_number} (${new Date(l.load_date).toLocaleDateString()}) - ${l.driver_name}</option>`).join('');
                if (currentVal) selector.value = currentVal;
            }
        } catch (e) {
            console.error('Failed to load active loads:', e);
        }
    }

    async loadPOSCustomers(selectedId = null) {
        try {
            const res = await this.apiCall('/api/customers');
            const data = await res.json();
            this.posState.customers = data.data || [];

            // If a specific ID is requested, select it
            const targetId = selectedId || this.posState.selectedCustomerId;

            if (targetId) {
                const customer = this.posState.customers.find(c => c.id == targetId);
                if (customer) {
                    await this.selectPOSCustomer(customer);
                    // Clear state after selection
                    if (!selectedId) this.posState.selectedCustomerId = null;
                }
            } else {
                // Default to Walking Customer (primary) or Cash Customer (legacy)
                let defaultCust = this.posState.customers.find(c => c.name.toLowerCase().includes('walking'));
                if (!defaultCust) {
                    defaultCust = this.posState.customers.find(c => c.name.toLowerCase().includes('cash'));
                }

                if (defaultCust) await this.selectPOSCustomer(defaultCust);
            }
        } catch (e) {
            console.error('Failed to load customers:', e);
        }
    }

    openPOSAddCustomer() {
        window.onCustomerSaved = async (newCustomer) => {
            // Reload list to ensure fresh data
            await this.loadPOSCustomers(newCustomer.id);
            this.showNotification('Customer added and selected', 'success');
            delete window.onCustomerSaved;
        };
        this.openCustomerModal(null);
    }

    filterPOSCustomers(query) {
        if (!this.posState.customers) return;

        const resultsDiv = document.getElementById('pos-customer-results');
        if (!resultsDiv) return;

        // If empty query, show recent or all (limited)
        // If query processing...
        const filtered = query
            ? this.posState.customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) ||
                (c.phone && c.phone.includes(query)))
            : this.posState.customers.slice(0, 10); // Show top 10 if empty interaction

        if (filtered.length === 0) {
            resultsDiv.style.display = 'none';
            return;
        }

        resultsDiv.innerHTML = filtered.map(c => `
            <div class="search-result-item" onclick='app.selectPOSCustomer(${JSON.stringify(c)})' 
                 style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 500; color: #334155;">${c.name}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${c.route || ''} ${c.phone ? ' • ' + c.phone : ''}</div>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 500;">
                    ${c.outstanding_balance > 0 ? 'Bal: ' + c.outstanding_balance.toLocaleString() : ''}
                </div>
            </div>
        `).join('');

        resultsDiv.style.display = 'block';
    }

    async selectPOSCustomer(customer) {
        // UI Updates
        document.getElementById('pos-customer-search-mode').style.display = 'none';

        const display = document.getElementById('pos-selected-customer');
        display.style.display = 'flex';

        document.getElementById('pos-cust-name').textContent = customer.name;
        document.getElementById('pos-cust-detail').textContent =
            (customer.address || '') + (customer.phone ? ' • ' + customer.phone : '');

        const balanceEl = document.getElementById('pos-cust-balance');
        if (balanceEl) {
            const bal = customer.account_balance || customer.outstanding_balance || 0;
            balanceEl.textContent = parseFloat(bal).toLocaleString(undefined, { minimumFractionDigits: 2 });
            balanceEl.style.color = bal > 0 ? '#ef4444' : '#166534'; // Red if they owe money, Green if clear
        }

        // Hide results dropdown
        document.getElementById('pos-customer-results').style.display = 'none';

        // Set Value
        const hiddenInput = document.getElementById('pos-customer-selector');
        if (hiddenInput) hiddenInput.value = customer.id;

        // Fetch customer-specific discounts
        this.posState.customerDiscounts = {};
        try {
            const res = await this.apiCall(`/api/sales/customer-discounts/${customer.id}`);
            if (res) {
                const data = await res.json();
                if (data.success) {
                    data.data.forEach(d => {
                        this.posState.customerDiscounts[d.product_id] = {
                            percentage: d.discount_percentage,
                            amount: d.discount_amount
                        };
                    });
                }
            }
        } catch (e) {
            console.error('Failed to fetch customer discounts:', e);
        }

        // REFRESH TILES: Update product grid to show new customer's discount badges
        if (this.posState.products.length > 0) {
            this.renderProductTiles(this.posState.products);
        }

        // Update existing cart items if customer changed
        if (this.posState.cart.length > 0) {
            this.posState.cart.forEach(item => {
                const disc = (this.posState.customerDiscounts || {})[item.product_id];
                if (disc) {
                    item.discount_percentage = disc.percentage;
                    item.discount_amount = disc.amount;
                    item.line_total = item.quantity * item.msrp * (1 - (item.discount_percentage / 100));
                }
            });
            this.updateCartUI();
        }
    }

    resetPOSCustomer() {
        document.getElementById('pos-selected-customer').style.display = 'none';
        document.getElementById('pos-customer-search-mode').style.display = 'block';
        document.getElementById('pos-customer-selector').value = '';

        const searchInput = document.getElementById('pos-customer-search');
        searchInput.value = '';
        searchInput.focus();
        this.filterPOSCustomers(''); // Show initial list
    }

    togglePOSPaymentMethod() {
        const method = document.getElementById('pos-payment-method').value;
        const details = document.getElementById('pos-cheque-details');
        if (details) {
            details.style.display = method === 'cheque' ? 'block' : 'none';
        }
    }

    async loadTruckStock(loadId) {
        try {
            const grid = document.getElementById('pos-product-grid');
            grid.innerHTML = '<div class="pos-empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading truck stock...</p></div>';

            const res = await this.apiCall(`/api/pos/truck-stock/${loadId}`);
            if (!res) return; // Auth failure handled by apiCall

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error('API Error:', errData);
                throw new Error(errData.error || `Server Error: ${res.status}`);
            }

            const products = await res.json();

            if (!Array.isArray(products)) {
                console.error('Invalid Response Format:', products);
                throw new Error('Server returned invalid data format');
            }

            this.posState.products = products;
            this.renderProductTiles(products);
        } catch (e) {
            console.error('Load Truck Stock Error:', e);
            this.showNotification(e.message || 'Failed to load truck stock', 'error');
            const grid = document.getElementById('pos-product-grid');
            if (grid) grid.innerHTML = `<div class="pos-empty-state"><i class="fas fa-exclamation-circle" style="color:red"></i><p>${e.message}</p></div>`;
        }
    }

    renderProductTiles(products) {
        const grid = document.getElementById('pos-product-grid');
        if (!grid) return;

        if (!products || products.length === 0) {
            grid.innerHTML = '<div class="pos-empty-state"><p>No products found in this truck load.</p></div>';
            return;
        }

        grid.innerHTML = products.map(p => {
            // Subtract cart quantity from displayed stock
            const cartItem = (this.posState.cart || []).find(item => item.product_id === p.id);
            const cartQty = cartItem ? cartItem.quantity : 0;
            const remainingQty = Math.max(0, p.available_quantity - cartQty);

            const stockClass = remainingQty <= 0 ? 'no-stock' : (remainingQty < 10 ? 'low-stock' : '');
            const stockLabel = remainingQty <= 0 ? 'Out of Stock' : (remainingQty < 10 ? 'Low Stock' : 'In Stock');
            const tagClass = remainingQty <= 0 ? 'out' : (remainingQty < 10 ? 'low' : 'in');

            const lastDisc = (this.posState.customerDiscounts || {})[p.id];
            const discHtml = (lastDisc && lastDisc.percentage > 0) ? `
                <div class="special-rate-hint" style="font-size: 0.75rem; color: var(--primary-green); font-weight: 700; background: rgba(46, 125, 50, 0.1); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 5px;">
                    <i class="fas fa-tag"></i> Last Disc: ${lastDisc.percentage}%
                </div>
            ` : '';

            return `
                <div class="product-card ${stockClass}" onclick="app.checkAndAddToCart(${p.id})">
                    <div class="product-sku">${p.reference_code || 'N/A'}</div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-stock">
                        <span class="stock-tag ${tagClass}">${stockLabel}: ${remainingQty}</span>
                    </div>
                    <div class="product-price">LKR ${p.msrp.toFixed(2)}</div>
                    ${discHtml}
                </div>
            `;
        }).join('');
    }

    filterPOSProducts(query) {
        if (!query) return this.posState.products;
        query = query.toLowerCase();
        return this.posState.products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.reference_code && p.reference_code.toLowerCase().includes(query))
        );
    }

    checkAndAddToCart(productId) {
        // Feature Request: Popup/Notify if discount exists
        const disc = (this.posState.customerDiscounts || {})[productId];
        if (disc && disc.percentage > 0) {
            // Option 1: Simple Notification (User requested "popup", but efficient POS usually avoids blocking modals for every item)
            // Let's use a distinct notification first.
            this.showNotification(`Applying ${disc.percentage}% discount from last invoice!`, 'info');
        }
        this.addToCart(productId);
    }

    addToCart(productId) {
        const product = this.posState.products.find(p => p.id === productId);
        if (!product) return;

        if (product.available_quantity <= 0) {
            this.showNotification('Product is out of stock in this truck load', 'warning');
            return;
        }

        const cartItem = this.posState.cart.find(item => item.product_id === productId);
        if (cartItem) {
            if (cartItem.quantity + 1 > product.available_quantity) {
                this.showNotification('Exceeds available truck stock', 'warning');
                return;
            }
            cartItem.quantity += 1; // Always integer increment on click
            cartItem.line_total = cartItem.quantity * cartItem.msrp * (1 - (cartItem.discount_percentage / 100));
        } else {
            const disc = (this.posState.customerDiscounts || {})[product.id] || { percentage: 0, amount: 0 };

            // Initial Add: Default to 1. Even for weighted, 1 is a safe start.
            this.posState.cart.push({
                product_id: product.id,
                product_name: product.name,
                msrp: product.msrp,
                quantity: 1, // Integer start
                discount_percentage: disc.percentage,
                discount_amount: disc.amount,
                line_total: product.msrp * (1 - (disc.percentage / 100)),
                weighted: product.weighted // Store property for UI checks
            });

            if (disc.percentage > 0) {
                this.showNotification(`Applied last discount: ${disc.percentage}% for this customer`, 'info');
            }
        }

        this.updateCartUI();
    }

    removeFromCart(productId) {
        this.posState.cart = this.posState.cart.filter(item => item.product_id !== productId);
        this.updateCartUI();
    }

    updateCartQty(productId, newQty) {
        const item = this.posState.cart.find(i => i.product_id === productId);
        const product = this.posState.products.find(p => p.id === productId);

        if (item && product) {
            let qty = parseFloat(newQty) || 0;

            // INTEGER CHECK
            if (!product.weighted && !Number.isInteger(qty)) {
                this.showNotification('Product is not weighted. Only integer quantities allowed.', 'warning');
                qty = Math.round(qty); // Force integer
            }

            if (qty > product.available_quantity) {
                this.showNotification('Exceeds available truck stock', 'warning');
                this.updateCartUI(); // Reset UI
                return;
            }

            item.quantity = qty;
            this.recalculateLineTotal(item);
            this.updateCartUI();
        }
    }

    updateCartPrice(productId, newPrice) {
        const item = this.posState.cart.find(i => i.product_id === productId);
        if (item) {
            const price = parseFloat(newPrice) || 0;
            item.msrp = price;
            item.is_custom_price = true; // Flag to indicate manual override if needed logic later
            this.recalculateLineTotal(item);
            this.updateCartUI();
        }
    }

    updateCartDiscount(productId, newDisc) {
        const item = this.posState.cart.find(i => i.product_id === productId);
        if (item) {
            const disc = parseFloat(newDisc) || 0;
            item.discount_percentage = Math.min(Math.max(disc, 0), 100);
            this.recalculateLineTotal(item);
            this.updateCartUI();
        }
    }

    recalculateLineTotal(item) {
        item.line_total = item.quantity * item.msrp * (1 - (item.discount_percentage / 100));
    }

    updateCartUI() {
        const tbody = document.getElementById('pos-cart-body');
        if (!tbody) return;

        const countEl = document.getElementById('pos-cart-count');

        if (this.posState.cart.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem; color: #999;">Cart is empty</td></tr>';
            document.getElementById('pos-subtotal').textContent = '0.00';
            document.getElementById('pos-grand-total').textContent = '0.00';
            if (countEl) countEl.textContent = '0 Items / 0 Qty';
            return;
        }

        tbody.innerHTML = this.posState.cart.map((item, index) => {
            // Determine step based on weighted property
            // We need to check the product from posState.products to be sure
            const prod = this.posState.products.find(p => p.id === item.product_id);
            const isWeighted = prod ? prod.weighted : false; // Safe fallback
            const step = isWeighted ? "0.01" : "1";

            return `
            <tr>
                <td style="color: #64748b; font-size: 0.8rem; vertical-align: middle;">${index + 1}</td>
                <td><span class="cart-item-name">${item.product_name}</span></td>
                <td>
                    <input type="number" class="cart-qty-input" value="${item.quantity}" 
                        onchange="app.updateCartQty(${item.product_id}, this.value)" min="1" step="${step}">
                </td>
                <td>
                    <input type="number" class="cart-qty-input" style="width: 100%;" value="${item.msrp.toFixed(2)}" 
                        onchange="app.updateCartPrice(${item.product_id}, this.value)" step="0.01">
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <input type="number" class="cart-qty-input" style="width: 100%;" value="${item.discount_percentage}" 
                            onchange="app.updateCartDiscount(${item.product_id}, this.value)" min="0" max="100">
                        <span>%</span>
                    </div>
                </td>
                <td class="text-right"><strong>${item.line_total.toFixed(2)}</strong></td>
                <td>
                    <button class="btn btn-sm" onclick="app.removeFromCart(${item.product_id})" style="color: var(--error);">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `}).join('');

        const subtotal = this.posState.cart.reduce((sum, item) => sum + item.line_total, 0);
        const totalQty = this.posState.cart.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);

        document.getElementById('pos-subtotal').textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('pos-grand-total').textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 });

        if (countEl) {
            countEl.textContent = `${this.posState.cart.length} Items / ${totalQty} Qty`;
        }

        // NEW: Refresh product tiles to update available quantities based on cart
        if (this.posState.products.length > 0) {
            this.renderProductTiles(this.posState.products);
        }
    }

    clearCart() {
        if (this.posState.cart.length > 0 && confirm('Clear all items from cart?')) {
            this.posState.cart = [];
            this.posState.currentInvoiceId = null;
            this.updateCartUI();
        }
    }

    async holdInvoice() {
        if (this.posState.cart.length === 0) return;

        const customerId = document.getElementById('pos-customer-selector')?.value;
        if (!customerId) {
            this.showNotification('Please select a customer first', 'warning');
            return;
        }

        const invoiceData = this.getPOSData('held');
        try {
            let res;
            if (this.posState.currentInvoiceId) {
                res = await this.apiCall(`/api/sales/${this.posState.currentInvoiceId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invoiceData)
                });
            } else {
                res = await this.apiCall('/api/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invoiceData)
                });
            }

            const data = await res.json();
            if (data.success) {
                this.showNotification('Invoice held successfully', 'success');
                this.posState.cart = [];
                this.posState.currentInvoiceId = null;
                this.updateCartUI();
                this.loadSalesHistory(); // Refresh history
            }
        } catch (e) {
            this.showNotification('Failed to hold invoice', 'error');
        }
    }

    async processPOS() {
        if (this.posState.cart.length === 0) {
            this.showNotification('Cart is empty', 'warning');
            return;
        }

        if (!this.posState.selectedLoadId) {
            this.showNotification('Please select a truck load first', 'warning');
            return;
        }

        const customerId = document.getElementById('pos-customer-selector')?.value;
        if (!customerId) {
            this.showNotification('Please select a customer first', 'warning');
            return;
        }

        // Open Payment Modal
        const subtotal = this.posState.cart.reduce((sum, item) => sum + item.line_total, 0);

        document.getElementById('pay-modal-total').textContent = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('pay-cash-amount').value = '';
        document.getElementById('pay-cheque-amount').value = '0';
        document.getElementById('pay-credit-amount').value = subtotal.toFixed(2);
        document.getElementById('pay-change-amount').textContent = '0.00';

        // Reset cheque list
        this.posState.tempCheques = [];
        this.renderChequesList();

        // Reset add cheque form
        document.getElementById('pay-modal-cheque-details').style.display = 'none';
        document.getElementById('pay-modal-cheque-num').value = '';
        document.getElementById('pay-modal-cheque-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('pay-modal-cheque-amount').value = '';
        document.getElementById('pay-modal-cheque-bank').value = '';
        document.getElementById('pay-modal-cheque-url').value = '';
        document.getElementById('pay-modal-cheque-file').value = '';
        document.getElementById('pay-modal-cheque-preview').innerHTML = '<i class="fas fa-image" style="color: #999;"></i>';

        const modal = document.getElementById('pos-payment-modal');
        modal.classList.add('active');
        modal.style.display = 'flex';

        // Focus cash
        setTimeout(() => document.getElementById('pay-cash-amount').focus(), 100);
    }

    calcPaymentBalance() {
        const total = parseFloat(document.getElementById('pay-modal-total').textContent.replace(/,/g, '')) || 0;
        const cash = parseFloat(document.getElementById('pay-cash-amount').value) || 0;
        const cheque = parseFloat(document.getElementById('pay-cheque-amount').value) || 0;

        const paid = cash + cheque;
        let credit = 0;
        let change = 0;

        if (paid >= total) {
            change = paid - total;
            credit = 0;
        } else {
            credit = total - paid;
            change = 0;
        }

        document.getElementById('pay-credit-amount').value = credit.toFixed(2);
        document.getElementById('pay-change-amount').textContent = change.toFixed(2);
    }

    toggleAddChequeForm() {
        const el = document.getElementById('pay-modal-cheque-details');
        if (el.style.display === 'none') {
            el.style.display = 'block';
            document.getElementById('pay-modal-cheque-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('pay-modal-cheque-num').focus();
        } else {
            el.style.display = 'none';
        }
    }

    addChequeToList() {
        const num = document.getElementById('pay-modal-cheque-num').value;
        const date = document.getElementById('pay-modal-cheque-date').value;
        const amount = parseFloat(document.getElementById('pay-modal-cheque-amount').value) || 0;
        const bank = document.getElementById('pay-modal-cheque-bank').value;
        const imageUrl = document.getElementById('pay-modal-cheque-url').value;

        if (!num || !date || amount <= 0 || !bank) {
            this.showNotification('Please fill all cheque details and amount', 'warning');
            return;
        }

        const cheque = {
            number: num,
            date: date,
            amount: amount,
            bank: bank,
            image: imageUrl
        };

        this.posState.tempCheques.push(cheque);

        // Reset form
        document.getElementById('pay-modal-cheque-num').value = '';
        document.getElementById('pay-modal-cheque-amount').value = '';
        document.getElementById('pay-modal-cheque-bank').value = '';
        document.getElementById('pay-modal-cheque-url').value = '';
        document.getElementById('pay-modal-cheque-file').value = '';
        document.getElementById('pay-modal-cheque-preview').innerHTML = '<i class="fas fa-image" style="color: #999;"></i>';
        document.getElementById('pay-modal-cheque-details').style.display = 'none';

        this.renderChequesList();
        this.calcPaymentBalance();
    }

    renderChequesList() {
        const listDiv = document.getElementById('pos-cheques-list');
        const cheques = this.posState.tempCheques;

        let total = 0;

        if (cheques.length === 0) {
            listDiv.innerHTML = '<div class="text-muted" style="font-size: 0.85rem; padding: 5px; border: 1px dashed #cbd5e1; border-radius: 4px; text-align: center;">No cheques added</div>';
        } else {
            listDiv.innerHTML = cheques.map((c, i) => {
                total += c.amount;
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 5px; font-size: 0.85rem;">
                        <div>
                            <div style="font-weight: 600;">#${c.number} - ${c.bank}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${c.date}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="font-weight: 700; color: var(--primary-green);">LKR ${c.amount.toFixed(2)}</div>
                            <button type="button" onclick="app.removeChequeFromList(${i})" style="border: none; background: none; color: #ef4444; cursor: pointer; padding: 0 5px;">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('pay-cheque-amount').value = total;
    }

    removeChequeFromList(index) {
        this.posState.tempCheques.splice(index, 1);
        this.renderChequesList();
        this.calcPaymentBalance();
    }

    async handlePOSChequeUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        const previewDiv = document.getElementById('pay-modal-cheque-preview');
        previewDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await this.apiCall('/api/upload', { method: 'POST', body: formData });
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                document.getElementById('pay-modal-cheque-url').value = data.imageUrl;
                previewDiv.innerHTML = `<img src="${data.imageUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                this.showNotification('Cheque image uploaded successfully', 'success');
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (err) {
            console.error('POS Cheque Upload Error:', err);
            this.showNotification('Failed to upload cheque image', 'error');
            previewDiv.innerHTML = '<i class="fas fa-image" style="color: #999;"></i>';
        }
    }

    async submitPayment(shouldPrint) {
        const customerId = document.getElementById('pos-customer-selector')?.value;
        if (!customerId) {
            this.showNotification('Please select a customer first', 'warning');
            return;
        }

        const total = parseFloat(document.getElementById('pay-modal-total').textContent.replace(/,/g, '')) || 0;
        const cash = parseFloat(document.getElementById('pay-cash-amount').value) || 0;
        const chequeAmountTotal = this.posState.tempCheques.reduce((s, c) => s + c.amount, 0);
        const credit = parseFloat(document.getElementById('pay-credit-amount').value) || 0;

        // Validation: If there is a cheque amount but no cheques added
        if (chequeAmountTotal === 0 && document.getElementById('pos-cheques-list').querySelector('.text-muted') === null) {
            // This case shouldn't happen with the new logic but good to have
        }

        const paymentData = {
            method: (cash > 0 && chequeAmountTotal === 0 && credit === 0) ? 'cash' :
                (cash === 0 && chequeAmountTotal > 0 && credit === 0) ? 'cheque' :
                    (cash === 0 && chequeAmountTotal === 0 && credit > 0) ? 'account' : 'split',
            details: {
                cash: cash,
                cheque: chequeAmountTotal,
                credit: credit,
                cheques: this.posState.tempCheques // Send the array!
            }
        };

        const invoiceData = this.getPOSData('completed', paymentData);

        try {
            let res;
            if (this.posState.currentInvoiceId) {
                res = await this.apiCall(`/api/sales/${this.posState.currentInvoiceId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invoiceData)
                });
            } else {
                res = await this.apiCall('/api/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invoiceData)
                });
            }

            const result = await res.json();
            if (result.success) {
                this.showNotification('Sale completed successfully', 'success');

                // Close modal
                document.getElementById('pos-payment-modal').classList.remove('active');
                document.getElementById('pos-payment-modal').style.display = 'none';

                const invoiceId = this.posState.currentInvoiceId || result.data.id;

                // Reset Cart
                this.posState.cart = [];
                this.posState.currentInvoiceId = null;
                this.updateCartUI();
                this.loadPOSCustomers(); // Refresh balances for next sale
                this.loadSalesHistory(); // Refresh history
                this.getNextInvoiceNumber();

                // Reset customer
                this.resetPOSCustomer();
                this.loadPOSCustomers(); // Reset selection

                if (shouldPrint) {
                    // Open print dialog directly
                    this.openPrintModal(invoiceId, false); // First-time print
                }

                // NEW: Refresh products in grid to update stock
                if (this.posState.selectedLoadId) {
                    this.loadTruckStock(this.posState.selectedLoadId);
                }
            } else {
                this.showNotification(result.error || 'Failed to complete sale', 'error');
            }
        } catch (e) {
            this.showNotification('Transaction failed: ' + e.message, 'error');
        }
    }

    // kept for hold logic compatibility
    async _processPOSOld() {
        return;
    }


    getPOSData(status, paymentData = null) {
        const subtotal = this.posState.cart.reduce((sum, item) => sum + item.line_total, 0);

        const data = {
            invoice_date: document.getElementById('pos-date').value,
            customer_id: document.getElementById('pos-customer-selector').value,
            load_id: this.posState.selectedLoadId,
            status: status,
            net_total: subtotal,
            tax: 0,
            bill_discount: 0,
            items: this.posState.cart,
            created_by: this.currentUser.id
        };

        if (paymentData) {
            data.payment_method = paymentData.method;
            data.payment_details = paymentData.details;

            // Map legacy fields for backend compatibility if primarily expecting one
            if (paymentData.details.cheque_info) {
                data.cheque = paymentData.details.cheque_info;
            } else if (paymentData.details.cheques && paymentData.details.cheques.length > 0) {
                data.cheque = paymentData.details.cheques[0];
            }
        } else {
            // Fallback for hold or default
            data.payment_method = 'pending';
        }

        return data;
    }

    async recallInvoiceModal() {
        // We'll use a dynamic list in a notification/simple modal for now
        try {
            const res = await this.apiCall('/api/sales');
            const data = await res.json();
            const heldInvoices = (data.data || []).filter(inv => inv.status === 'held');

            if (heldInvoices.length === 0) {
                this.showNotification('No held invoices found', 'info');
                return;
            }

            // Create a simple modal for recall
            let modalHtml = `
                <div id="recall-modal" class="modal active" style="display:flex">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h3><i class="fas fa-history"></i> Recall Held Invoices</h3>
                            <button class="close-btn" onclick="document.getElementById('recall-modal').remove()">&times;</button>
                        </div>
                        <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                            <div class="held-list">
                                ${heldInvoices.map(inv => `
                                    <div class="invoice-list-item">
                                        <div class="invoice-item-info">
                                            <h4>${inv.invoice_number} - ${inv.customer_name}</h4>
                                            <span>Date: ${new Date(inv.invoice_date).toLocaleDateString()} | Total: ${inv.net_total.toFixed(2)}</span>
                                        </div>
                                        <button class="btn btn-sm btn-primary" onclick="app.recallInvoice(${inv.id})">
                                            Recall
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (e) {
            this.showNotification('Failed to fetch held invoices', 'error');
        }
    }

    async recallInvoice(id) {
        if (this.posState.cart.length > 0 && !confirm('Discard current cart and recall this invoice?')) {
            return;
        }

        try {
            const res = await this.apiCall(`/api/sales/${id}`);
            const result = await res.json();
            const invoice = result.data;

            if (invoice) {
                this.posState.cart = invoice.items.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    msrp: item.msrp,
                    quantity: item.quantity,
                    discount_percentage: item.discount_percentage,
                    discount_amount: item.discount_amount,
                    line_total: item.line_total
                }));

                this.posState.currentInvoiceId = invoice.id;
                this.posState.selectedLoadId = invoice.load_id;

                document.getElementById('pos-date').value = invoice.invoice_date;
                document.getElementById('pos-customer-selector').value = invoice.customer_id;
                document.getElementById('pos-payment-method').value = invoice.payment_method;
                document.getElementById('pos-load-selector').value = invoice.load_id || '';

                if (invoice.load_id) {
                    await this.loadTruckStock(invoice.load_id);
                }

                this.updateCartUI();
                const modal = document.getElementById('recall-modal');
                if (modal) modal.remove();
                this.showNotification('Invoice recalled', 'success');
            }
        } catch (e) {
            this.showNotification('Failed to recall invoice', 'error');
        }
    }

    openPrintModal(invoiceId, isDuplicate = false) {
        this.printInvoiceId = invoiceId;
        this.isDuplicatePrint = isDuplicate;
        const modal = document.getElementById('print-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }

    executePrint() {
        const format = document.querySelector('input[name="print-format"]:checked').value;
        const invoiceId = this.printInvoiceId;
        const isDuplicate = this.isDuplicatePrint;
        const modal = document.getElementById('print-modal');

        if (invoiceId) {
            const url = `/print-invoice.html?id=${invoiceId}&format=${format}${isDuplicate ? '&duplicate=true' : ''}`;
            window.open(url, '_blank');
        }

        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

    async loadSalesHistory() {
        try {
            const tableBody = document.getElementById('sales-history-table');
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

            const res = await this.apiCall('/api/sales');
            const data = await res.json();
            const invoices = data.data || [];

            if (tableBody) {
                if (invoices.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No invoices found.</td></tr>';
                    return;
                }

                tableBody.innerHTML = invoices.map(inv => `
                    <tr>
                        <td><strong>${inv.invoice_number}</strong></td>
                        <td>${new Date(inv.invoice_date).toLocaleDateString()}</td>
                        <td>${inv.customer_name}</td>
                        <td>${inv.net_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                            <span class="badge ${inv.status === 'completed' ? 'badge-success' : (inv.status === 'held' ? 'badge-warning' : 'badge-danger')}">
                                ${inv.status.toUpperCase()}
                            </span>
                        </td>
                        <td>
                            <div class="actions-group">
                                <button class="btn-action primary" onclick="app.viewInvoice(${inv.id})" title="Print Invoice">
                                    <i class="fas fa-print"></i>
                                </button>
                                ${inv.status === 'completed' ? `
                                    <button class="btn-action success" onclick="app.editInvoice(${inv.id})" title="Modify / Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                ` : ''}
                                ${inv.status === 'held' ? `
                                    <button class="btn-action success" onclick="app.recallInvoice(${inv.id}); app.navigateTo('sales');" title="Recall">
                                        <i class="fas fa-redo"></i>
                                    </button>
                                ` : ''}
                                <button class="btn-action danger" onclick="app.deleteInvoice(${inv.id})" title="Delete Record">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            this.showNotification('Failed to load sales history', 'error');
        }
    }

    async deleteInvoice(id) {
        if (!confirm('EXTREME WARNING: Are you sure you want to PERMANENTLY DELETE this invoice? This will remove the record and reverse any account balance changes. Stock will NOT be restored automatically.')) {
            return;
        }

        try {
            const res = await this.apiCall(`/api/sales/${id}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                this.showNotification('Invoice permanently deleted', 'success');
                this.loadSalesHistory();
            } else {
                this.showNotification(data.error || 'Failed to delete invoice', 'error');
            }
        } catch (e) {
            this.showNotification('Failed to delete invoice', 'error');
        }
    }

    async editInvoice(id) {
        if (!confirm('Modify this invoice? It will be loaded into the POS cart for editing. Existing cart items will be replaced.')) {
            return;
        }
        await this.recallInvoice(id);
        this.navigateTo('sales');
    }

    async cancelInvoice(id) {
        // Deprecated in favor of delete or status update, keeping if needed
        this.deleteInvoice(id);
    }

    async viewInvoice(id) {
        this.openPrintModal(id, true); // It's a re-print from history
    }

    async loadPreOrders() {
        try {
            const tableBody = document.getElementById('pre-orders-table-body');
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

            const res = await this.apiCall('/api/sales/pre-orders/list');
            const data = await res.json();
            const orders = data.data || [];

            if (tableBody) {
                if (orders.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No pre-orders found.</td></tr>';
                    return;
                }

                tableBody.innerHTML = orders.map(po => `
                    <tr>
                        <td><span class="status-indicator" style="background: transparent; border: none; padding: 0; box-shadow: none;"><strong>${po.order_number}</strong></span></td>
                        <td>${new Date(po.order_date).toLocaleDateString()}</td>
                        <td>${po.customer_name}</td>
                        <td class="text-right"><strong>${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                        <td>
                            <span class="badge ${po.status === 'pending' ? 'badge-warning' : (po.status === 'converted' ? 'badge-success' : 'badge-danger')}">
                                ${po.status.toUpperCase()}
                            </span>
                        </td>
                        <td>
                            <div class="actions-group">
                                ${po.status === 'pending' ? `
                                    <button class="btn-action success" onclick="app.convertToInvoice(${po.id})" title="Convert to Invoice">
                                        <i class="fas fa-file-invoice"></i>
                                    </button>
                                ` : ''}
                                <button class="btn-action primary" onclick="app.viewPreOrder(${po.id})" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${po.status !== 'converted' ? `
                                    <button class="btn-action danger" onclick="app.deletePreOrder(${po.id})" title="Delete Record">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            this.showNotification('Failed to load pre-orders', 'error');
        }
    }

    async openPreOrderModal() {
        // Load customers if not loaded
        if (!this.customerCache) {
            const res = await this.apiCall('/api/customers?limit=1000');
            const data = await res.json();
            this.customerCache = data.data;
        }

        const customerSelect = document.getElementById('po-customer');
        customerSelect.innerHTML = '<option value="">Select Customer</option>' +
            this.customerCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        // Ensure productCache is loaded
        if (!this.productCache) {
            const res = await this.apiCall('/api/products?limit=1000');
            const data = await res.json();
            this.productCache = data.data;
        }

        document.getElementById('po-date').valueAsDate = new Date();
        document.getElementById('po-items-body').innerHTML = '';
        document.getElementById('po-total-display').textContent = '0.00';
        document.getElementById('pre-order-modal').classList.add('active');
        document.getElementById('pre-order-modal').style.display = 'flex';

        // Setup form submit
        const form = document.getElementById('pre-order-form');
        form.onsubmit = (e) => this.handlePreOrderSubmit(e);
    }

    searchPreOrderProducts(query) {
        if (!query || query.length < 2) {
            document.getElementById('po-search-results').style.display = 'none';
            return;
        }

        const filtered = this.productCache.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.ref && p.ref.toLowerCase().includes(query.toLowerCase())) ||
            (p.barcode && p.barcode.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 10);

        const results = document.getElementById('po-search-results');
        if (filtered.length > 0) {
            results.innerHTML = filtered.map(p => {
                const productJson = JSON.stringify(p).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                return `
                    <div class="search-result-item" onclick="app.addPreOrderProduct(${productJson})">
                        <div>
                            <div class="product-name">${p.name}</div>
                            <div class="product-info">${p.brand_name || ''} | ${p.unit || ''}</div>
                        </div>
                        <div class="product-price">LKR ${p.msrp?.toLocaleString() || '0.00'}</div>
                    </div>
                `;
            }).join('');
            results.style.display = 'block';
        } else {
            results.innerHTML = '<div class="search-result-item text-muted">No products found</div>';
            results.style.display = 'block';
        }
    }

    addPreOrderProduct(product) {
        document.getElementById('po-product-search').value = '';
        document.getElementById('po-search-results').style.display = 'none';

        const tbody = document.getElementById('po-items-body');
        const existingRow = Array.from(tbody.querySelectorAll('tr')).find(row => row.dataset.id == product.id);

        if (existingRow) {
            const qtyInput = existingRow.querySelector('.item-qty');
            qtyInput.value = parseFloat(qtyInput.value) + 1;
            this.updatePreOrderCartonsFromQty(qtyInput);
            this.calculatePreOrderTotal();
            return;
        }

        const row = document.createElement('tr');
        row.dataset.id = product.id;
        row.dataset.name = product.name;
        row.dataset.unit = product.unit || '';
        row.dataset.upc = product.units_per_carton || 1;
        row.dataset.weighted = product.weighted ? 'true' : 'false';
        row.innerHTML = `
            <td>${product.name}</td>
            <td><input type="number" class="form-control item-price" value="${product.msrp || 0}" step="0.01" oninput="app.calculatePreOrderTotal()"></td>
            <td><input type="number" class="form-control item-cartons" placeholder="0" step="${product.weighted ? '0.01' : '1'}" oninput="app.updatePreOrderQtyFromCartons(this)"></td>
            <td><input type="number" class="form-control item-qty" value="1" step="${product.weighted ? '0.01' : '1'}" oninput="app.updatePreOrderCartonsFromQty(this)"></td>
            <td class="item-total">0.00</td>
            <td>
                <button type="button" class="btn-icon text-error" onclick="this.closest('tr').remove(); app.calculatePreOrderTotal();">
                    <i class="fas fa-minus-circle"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
        this.updatePreOrderCartonsFromQty(row.querySelector('.item-qty'));
        this.calculatePreOrderTotal();
    }

    updatePreOrderQtyFromCartons(input) {
        const row = input.closest('tr');
        const upc = parseFloat(row.dataset.upc || 1);
        const cartons = parseFloat(input.value || 0);
        const qtyInput = row.querySelector('.item-qty');
        qtyInput.value = (cartons * upc).toFixed(2);
        this.calculatePreOrderTotal();
    }

    updatePreOrderCartonsFromQty(input) {
        const row = input.closest('tr');
        const upc = parseFloat(row.dataset.upc || 1);
        let qty = parseFloat(input.value || 0);
        const isWeighted = row.dataset.weighted === 'true';

        // Enforce integer for non-weighted
        if (!isWeighted && !Number.isInteger(qty)) {
            // Optional: warn user only once or just subtly round
            // For strict enforcement:
            qty = Math.round(qty);
            input.value = qty; // Update input immediately
        }

        const cartonInput = row.querySelector('.item-cartons');
        if (upc > 0 && qty % upc === 0) {
            cartonInput.value = qty / upc;
        } else if (upc > 0) {
            cartonInput.value = (qty / upc).toFixed(2); // Show decimal cartons if qty doesn't match perfectly
        } else {
            cartonInput.value = '';
        }
        this.calculatePreOrderTotal();
    }

    calculatePreOrderTotal() {
        let grandTotal = 0;
        document.querySelectorAll('#po-items-body tr').forEach(row => {
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const total = price * qty;
            row.querySelector('.item-total').textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
            grandTotal += total;
        });
        document.getElementById('po-total-display').textContent = grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    async handlePreOrderSubmit(e) {
        e.preventDefault();
        const items = [];
        document.querySelectorAll('#po-items-body tr').forEach(row => {
            items.push({
                product_id: parseInt(row.dataset.id),
                price: parseFloat(row.querySelector('.item-price').value),
                quantity: parseFloat(row.querySelector('.item-qty').value),
                line_total: parseFloat(row.querySelector('.item-price').value) * parseFloat(row.querySelector('.item-qty').value)
            });
        });

        if (items.length === 0) {
            this.showNotification('Please add at least one item', 'warning');
            return;
        }

        const customerId = document.getElementById('po-customer').value;
        if (!customerId) {
            this.showNotification('Please select a customer', 'warning');
            return;
        }

        const orderData = {
            customer_id: customerId,
            order_date: document.getElementById('po-date').value,
            total_amount: parseFloat(document.getElementById('po-total-display').textContent.replace(/,/g, '')),
            items: items
        };

        try {
            const res = await this.apiCall('/api/sales/pre-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Pre-order saved successfully', 'success');
                document.getElementById('pre-order-modal').classList.remove('active');
                document.getElementById('pre-order-modal').style.display = 'none';
                this.loadPreOrders();
            } else {
                this.showNotification(data.error || 'Failed to save pre-order', 'error');
            }
        } catch (e) {
            this.showNotification('Connection error', 'error');
        }
    }

    async convertToInvoice(id) {
        try {
            // 1. Check if a truck load has been selected in POS
            if (!this.posState.selectedLoadId) {
                this.showNotification('Please select a truck load in Sales screen first!', 'warning');
                this.navigateTo('sales');
                return;
            }

            const res = await this.apiCall('/api/sales/pre-orders/' + id);
            const data = await res.json();
            const order = data.data;

            if (!order) throw new Error('Order not found');

            if (!confirm(`Convert Pre-order #${order.order_number} to Invoice?`)) return;

            // 2. Validate availability in selected truck
            const stockErrors = [];
            order.items.forEach(item => {
                const truckProd = this.posState.products.find(p => p.id === item.product_id);
                if (!truckProd) {
                    stockErrors.push(`${item.product_name} is NOT loaded in this truck.`);
                } else if (truckProd.available_quantity < item.quantity) {
                    stockErrors.push(`Insufficient truck stock for ${item.product_name} (Need: ${item.quantity}, Available: ${truckProd.available_quantity})`);
                }
            });

            if (stockErrors.length > 0) {
                alert("Stock Validation Errors:\n\n" + stockErrors.join("\n"));
                return;
            }

            // 3. Pre-fill POS Cart items
            this.posState.cart = order.items.map(item => {
                const disc = (this.posState.customerDiscounts || {})[item.product_id] || { percentage: 0, amount: 0 };
                return {
                    id: item.product_id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    name: item.product_name,
                    msrp: item.price,
                    quantity: item.quantity,
                    discount_percentage: disc.percentage,
                    discount_amount: disc.amount,
                    line_total: item.quantity * item.price * (1 - (disc.percentage / 100)),
                    unit: item.unit
                };
            });

            // Select customer in POS
            this.posState.selectedCustomerId = order.customer_id;

            // Refresh UI and Navigate
            await this.navigateTo('sales', true);
            this.updateCartUI();

            // 4. Update order status to converted
            await this.apiCall('/api/sales/pre-orders/' + id + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'converted' })
            });

            this.showNotification('Pre-order loaded to POS Cart successfully!', 'success');

        } catch (e) {
            this.showNotification('Conversion failed: ' + e.message, 'error');
        }
    }

    async deletePreOrder(id) {
        if (!confirm('Delete this pre-order record?')) return;
        try {
            const res = await this.apiCall('/api/sales/pre-orders/' + id, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Pre-order deleted', 'success');
                this.loadPreOrders();
            }
        } catch (e) {
            this.showNotification('Failed to delete pre-order', 'error');
        }
    }

    async viewPreOrder(id) {
        try {
            const res = await this.apiCall('/api/sales/pre-orders/' + id);
            const data = await res.json();
            const po = data.data;
            if (!po) return;

            // Reuse pre-order modal for viewing
            await this.openPreOrderModal();

            // Set Title to Edit
            const modalTitle = document.querySelector('#pre-order-modal .modal-title');
            if (modalTitle) modalTitle.textContent = 'Edit/View Pre-order';

            document.getElementById('po-customer').value = po.customer_id;
            document.getElementById('po-date').value = po.order_date;

            const tbody = document.getElementById('po-items-body');
            tbody.innerHTML = po.items.map(item => `
                <tr data-id="${item.product_id}" data-upc="${item.units_per_carton || 1}" data-weighted="${item.weighted ? 'true' : 'false'}">
                    <td>${item.product_name}</td>
                    <td><input type="number" class="form-control item-price" value="${item.price}" step="0.01" oninput="app.calculatePreOrderTotal()"></td>
                    <td><input type="number" class="form-control item-cartons" placeholder="0" step="${item.weighted ? '0.01' : '1'}" oninput="app.updatePreOrderQtyFromCartons(this)"></td>
                    <td><input type="number" class="form-control item-qty" value="${item.quantity}" step="${item.weighted ? '0.01' : '1'}" oninput="app.updatePreOrderCartonsFromQty(this)"></td>
                    <td class="item-total">${item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                        <button type="button" class="btn-action danger" onclick="this.closest('tr').remove(); app.calculatePreOrderTotal();" title="Remove Item">
                            <i class="fas fa-minus"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            // Update cartons based on quantities
            tbody.querySelectorAll('.item-qty').forEach(input => this.updatePreOrderCartonsFromQty(input));

            this.calculatePreOrderTotal();

            // Change button text if viewing
            const saveBtn = document.querySelector('#pre-order-form button[type="submit"]');
            saveBtn.textContent = 'Update Pre-order';
        } catch (e) {
            this.showNotification('Error loading details', 'error');
        }
    }

    adjustPreOrderWidth(val) {
        const modal = document.querySelector('#pre-order-modal .modal');
        if (modal) {
            modal.style.maxWidth = val + 'px';
            // Also update the slider value if it's called programmatically
            const slider = document.querySelector('#pre-order-modal input[type="range"]');
            if (slider) slider.value = val;
        }
    }

    async loadQuickActions() {
        try {
            const res = await this.apiCall('/api/settings/key/quick_actions');
            const data = await res.json();
            if (data.success && data.data) {
                // Merge with defaults or override? Override fully is simplest.
                // But we must support legacy defaults if DB is fresher
                const savedActions = data.data;
                // Merge in any new system actions that might be missing from saved config
                const defaultActions = [
                    { id: 'visit', label: 'Create Visit Log', icon: 'fas fa-file-invoice', action: 'app.openVisitModal()', color: 'blue', type: 'function', visible: true, isSystem: true, permission: 'visits:create' },
                    { id: 'payment', label: 'Collect Payment', icon: 'fas fa-cash-register', action: 'app.openPaymentModal()', color: 'green', type: 'function', visible: true, isSystem: true, permission: 'payments:create' },
                    { id: 'product', label: 'Add Product', icon: 'fas fa-box-open', action: 'app.openProductModal()', color: 'orange', type: 'function', visible: true, isSystem: true, permission: 'products:create' },
                    { id: 'customer', label: 'Manage Customers', icon: 'fas fa-users', action: "app.navigateTo('customers')", color: 'purple', type: 'function', visible: true, isSystem: true, permission: 'customers:view' },
                    { id: 'dbtools', label: 'Database Tools', icon: 'fas fa-database', action: 'app.openDatabaseTools()', color: 'indigo', type: 'function', visible: true, isSystem: true, permission: 'admin:manage_settings' }
                ];

                // Add any default system actions that are NOT in the saved list (matched by ID)
                defaultActions.forEach(def => {
                    if (!savedActions.find(sa => sa.id === def.id)) {
                        savedActions.push(def);
                    }
                });

                this.quickActions = savedActions;
            }
        } catch (e) {
            console.warn('Failed to load quick actions config, using defaults');
        }
        this.renderQuickActions();
    }

    renderQuickActions() {
        const grid = document.querySelector('.quick-actions-grid');
        if (!grid) return;

        // Generate Buttons HTML
        const buttonsHtml = this.quickActions
            .filter(qa => {
                if (!qa.visible) return false;

                // Check permission if specified
                if (qa.permission) {
                    const [mod, act] = qa.permission.split(':');
                    return this.hasPermission(mod, act);
                }

                // Legacy fallback: check adminOnly
                if (qa.adminOnly) {
                    return this.currentUser?.role === 'admin';
                }

                return true;
            })
            .map(qa => {
                let onclick = '';
                if (qa.type === 'link') onclick = `window.open('${qa.action}', '_blank')`;
                else if (qa.type === 'nav') onclick = `app.navigateTo('${qa.action}')`;
                else if (qa.type === 'function') onclick = qa.action;
                else onclick = qa.action;

                return `
                <button class="quick-action-card bg-gradient-${qa.color}" onclick="${onclick}">
                    <i class="${qa.icon}"></i> ${qa.label}
                </button>
                `;
            }).join('');

        grid.innerHTML = buttonsHtml;
    }

    openQASettings() {
        const modal = document.getElementById('qa-settings-modal');
        const list = document.getElementById('qa-list');
        if (!modal || !list) return;

        list.innerHTML = this.quickActions.map((qa, idx) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border: 1px solid #eee; border-radius: 6px; background: #fff;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 30px; height: 30px; border-radius: 4px; background: var(--gradient-${qa.color}); display: flex; align-items: center; justify-content: center; color: white;">
                        <i class="${qa.icon}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${qa.label}</div>
                        <div style="font-size: 0.75rem; color: #888;">${qa.type === 'function' ? 'System Action' : (qa.type === 'nav' ? 'Navigation' : 'External Link')}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label class="switch" title="Toggle Visibility">
                        <input type="checkbox" ${qa.visible ? 'checked' : ''} onchange="app.toggleQAStatus(${idx}, this.checked)">
                        <span class="slider"></span>
                    </label>
                    ${!qa.isSystem ? `<button class="btn-icon text-error" onclick="app.deleteCustomQA(${idx})"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `).join('');

        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    toggleQAStatus(index, status) {
        if (this.quickActions[index]) {
            this.quickActions[index].visible = status;
        }
    }

    deleteCustomQA(index) {
        if (confirm('Remove this action?')) {
            this.quickActions.splice(index, 1);
            this.openQASettings(); // Refresh list
        }
    }

    addCustomQA(e) {
        e.preventDefault();
        const label = document.getElementById('qa-label').value;
        const icon = document.getElementById('qa-icon').value;
        const type = document.getElementById('qa-type').value;
        const target = document.getElementById('qa-target').value;
        const color = document.getElementById('qa-color').value;

        if (!label || !target) return;

        this.quickActions.push({
            id: Date.now().toString(),
            label,
            icon,
            type, // 'nav', 'link', or 'function'
            action: target,
            color,
            visible: true,
            isSystem: false,
            adminOnly: true
        });

        document.getElementById('qa-add-form').reset();
        this.openQASettings(); // Refresh list
    }

    async saveQASettings() {
        try {
            await this.apiCall('/api/settings/key/quick_actions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: this.quickActions })
            });
            this.showNotification('Quick Actions updated', 'success');
            document.getElementById('qa-settings-modal').classList.remove('active');
            document.getElementById('qa-settings-modal').style.display = 'none';
            this.renderQuickActions();
        } catch (e) {
            this.showNotification('Failed to save settings', 'error');
        }
    }
    openDatabaseTools() {
        const modal = document.getElementById('database-tools-modal');
        if (modal) {
            this.loadSavedQueries(); // Load saved queries when opening
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }

    async loadSavedQueries() {
        try {
            const res = await this.apiCall('/api/settings/key/saved_sql_queries');
            const data = await res.json();
            if (data.success && data.data) {
                this.savedQueries = data.data;
            } else {
                this.savedQueries = [];
            }
            this.renderSavedQueries();
        } catch (e) {
            console.warn('Failed to load saved queries', e);
        }
    }

    async saveDbQuery() {
        const sql = document.getElementById('db-sql-query').value;
        const name = document.getElementById('db-query-name').value;

        if (!sql) return this.showNotification('Enter a query first', 'error');
        if (!name) return this.showNotification('Enter a name for this query', 'error');

        this.savedQueries.push({ name, sql });

        try {
            await this.apiCall('/api/settings/key/saved_sql_queries', {
                method: 'PUT',
                body: JSON.stringify({ value: this.savedQueries })
            });
            this.showNotification('Query saved successfully', 'success');
            document.getElementById('db-query-name').value = ''; // clear name
            this.renderSavedQueries();
        } catch (e) {
            this.showNotification('Failed to save query', 'error');
        }
    }

    async deleteSavedQuery(index) {
        if (!confirm('Delete this saved query?')) return;
        this.savedQueries.splice(index, 1);
        try {
            await this.apiCall('/api/settings/key/saved_sql_queries', {
                method: 'PUT',
                body: JSON.stringify({ value: this.savedQueries })
            });
            this.renderSavedQueries();
        } catch (e) {
            this.showNotification('Failed to delete query', 'error');
        }
    }

    renderSavedQueries() {
        const container = document.getElementById('saved-queries-container');
        const list = document.getElementById('saved-queries-list');

        if (!this.savedQueries.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = this.savedQueries.map((q, idx) => `
            <div class="btn-group" style="display:flex; align-items:center;">
                <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem; border-top-right-radius: 0; border-bottom-right-radius: 0;" onclick="app.setDbQuery('${q.sql.replace(/'/g, "\\'")}')">${q.name}</button>
                <button type="button" class="btn btn-outline text-error" style="padding: 4px 8px; font-size: 0.8rem; border-left: none; border-top-left-radius: 0; border-bottom-left-radius: 0;" onclick="app.deleteSavedQuery(${idx})"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    }

    async runDatabaseQuery() {
        const sql = document.getElementById('db-sql-query').value;
        if (!sql) return this.showNotification('Please enter a query', 'error');

        try {
            const res = await this.apiCall('/api/settings/run-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });

            const data = await res.json();
            if (data.success) {
                this.renderQueryResults(data.data);
                this.showNotification('Query executed successfully', 'success');
            } else {
                this.showNotification(data.error || 'Query failed', 'error');
            }
        } catch (e) {
            this.showNotification('Execution failed', 'error');
        }
    }

    setDbQuery(sql) {
        const textarea = document.getElementById('db-sql-query');
        if (textarea) {
            textarea.value = sql;
            // Optionally auto-run? Yes, for convenience.
            this.runDatabaseQuery();
        }
    }

    renderQueryResults(rows) {
        const resultDiv = document.getElementById('db-query-results');
        const thead = document.getElementById('db-results-head');
        const tbody = document.getElementById('db-results-body');

        resultDiv.style.display = 'block';
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="100%" class="text-center">No results or empty set</td></tr>';
            return;
        }

        // If rows is an object (result from Run/Update/Delete typically { lastID, changes })
        if (!Array.isArray(rows)) {
            thead.innerHTML = '<tr><th>Result Type</th><th>Value</th></tr>';
            tbody.innerHTML = `
                <tr><td>Changes</td><td>${rows.changes}</td></tr>
                <tr><td>Last ID</td><td>${rows.lastID}</td></tr>
            `;
            return;
        }

        // It is an array of objects
        const columns = Object.keys(rows[0]);
        thead.innerHTML = '<tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr>';

        tbody.innerHTML = rows.map(row => {
            return '<tr>' + columns.map(c => {
                let val = row[c];
                if (val === null) val = '<span style="color:#aaa">NULL</span>';
                return `<td>${val}</td>`;
            }).join('') + '</tr>';
        }).join('');
    }


    // Banking Methods
    // Banking Methods
    async loadBankingCheques() {
        // Initialize state if not present
        if (!this.chequeFilter) this.chequeFilter = 'all';

        const res = await this.apiCall('/api/banking/cheques');
        if (!res) return;
        const data = await res.json();

        if (data.success) {
            this.allCheques = data.data || [];

            // Render Stats
            document.getElementById('bank-pending-val').textContent = this.formatCurrency(data.stats.pending_total);
            document.getElementById('bank-pending-count').textContent = `${data.stats.pending_count || 0} cheques waiting`;

            document.getElementById('bank-deposited-val').textContent = this.formatCurrency(data.stats.deposited_total + (data.stats.cleared_total || 0));
            document.getElementById('bank-deposited-count').textContent = `${(data.stats.deposited_count || 0) + (data.stats.cleared_count || 0)} cheques processed`;

            document.getElementById('bank-returned-val').textContent = this.formatCurrency(data.stats.returned_total);
            document.getElementById('bank-returned-count').textContent = `${data.stats.returned_count || 0} cheques bounced`;

            this.renderBankingCheques();
        }
    }

    setChequeFilter(filter, btnElement) {
        this.chequeFilter = filter;

        // Update UI pills
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');

        this.renderBankingCheques();
    }

    filterCheques() {
        this.renderBankingCheques();
    }

    renderBankingCheques() {
        const tbody = document.getElementById('banking-cheques-table-body');
        const searchInput = document.getElementById('cheque-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        // Filter Data
        const filtered = this.allCheques.filter(c => {
            const matchesStatus = this.chequeFilter === 'all' || c.status === this.chequeFilter;
            const matchesSearch = !searchTerm ||
                c.cheque_number?.toLowerCase().includes(searchTerm) ||
                c.customer_name?.toLowerCase().includes(searchTerm) ||
                c.bank_name?.toLowerCase().includes(searchTerm);
            return matchesStatus && matchesSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 3rem; color: #64748b;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No cheques found matching criteria.</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            let statusClass = 'pending';
            let statusIcon = 'fa-clock';

            if (c.status === 'Deposited') { statusClass = 'deposited'; statusIcon = 'fa-paper-plane'; }
            if (c.status === 'Cleared') { statusClass = 'cleared'; statusIcon = 'fa-check'; }
            if (c.status === 'Returned') { statusClass = 'returned'; statusIcon = 'fa-undo'; }

            return `
                <tr>
                    <td>
                        <div style="font-weight: 600; color: var(--text-dark);">${c.bank_name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-light); font-family: monospace; letter-spacing: 0.5px;">#${c.cheque_number}</div>
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">
                            <i class="far fa-calendar-alt"></i> ${new Date(c.cheque_date).toLocaleDateString()}
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 500;">${c.customer_name || 'Walking Customer'}</div>
                        ${c.remarks ? `<div style="font-size: 0.8rem; color: #64748b; font-style: italic;">"${c.remarks}"</div>` : ''}
                    </td>
                    <td class="text-right">
                        <div style="font-weight: 700; font-size: 1rem;">${this.formatCurrency(c.amount)}</div>
                    </td>
                    <td>
                        <span class="cheque-badge ${statusClass}">
                            <i class="fas ${statusIcon}"></i> ${c.status || 'Pending'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick='app.openChequeStatusModal(${JSON.stringify(c).replace(/'/g, "&#39;")})' title="Update Status">
                            <i class="fas fa-pen"></i> Update
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openChequeStatusModal(cheque) {
        document.getElementById('cs-id').value = cheque.id;
        document.getElementById('cs-current-status').value = cheque.status || 'Pending';
        document.getElementById('cs-new-status').value = cheque.status || 'Pending';
        document.getElementById('cs-remarks').value = cheque.remarks || '';
        document.getElementById('cheque-status-modal').classList.add('active');
    }

    async handleChequeStatusUpdate(e) {
        e.preventDefault();
        const id = document.getElementById('cs-id').value;
        const status = document.getElementById('cs-new-status').value;
        const remarks = document.getElementById('cs-remarks').value;

        const res = await this.apiCall(`/api/banking/cheques/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, remarks })
        });

        if (res) {
            this.showNotification('Cheque status updated', 'success');
            document.getElementById('cheque-status-modal').classList.remove('active');
            this.loadBankingCheques();
        }
    }

    // --- REPORTS & ANALYTICS ---
    initReportsView() {
        const fromInput = document.getElementById('report-date-from');
        const toInput = document.getElementById('report-date-to');
        if (fromInput && !fromInput.value) {
            const lastMonth = new Date();
            lastMonth.setDate(lastMonth.getDate() - 30);
            fromInput.value = lastMonth.toISOString().split('T')[0];
        }
        if (toInput && !toInput.value) {
            toInput.value = new Date().toISOString().split('T')[0];
        }

        this.loadAnalyticsSummary();
        this.loadReportData('date'); // Default report
    }

    async loadAnalyticsSummary() {
        const from = document.getElementById('report-date-from').value;
        const to = document.getElementById('report-date-to').value;

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=summary&dateFrom=${from}&dateTo=${to}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const s = data.data;
                const setV = (id, v, cur = true) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = cur ? this.formatCurrency(v) : v;
                };

                setV('rep-total-revenue', s.avgOrder?.total_revenue || 0);
                setV('rep-total-orders', s.avgOrder?.total_orders || 0, false);
                setV('rep-avg-order', s.avgOrder?.avg_value || 0);

                const repeatEl = document.getElementById('rep-repeat-rate');
                if (repeatEl) repeatEl.textContent = (s.repeatRate?.repeat_rate || 0).toFixed(1) + '%';

                const totalDisc = (s.discountImpact?.total_bill_discounts || 0) + (s.discountImpact?.total_item_discounts || 0);
                setV('rep-total-discount', totalDisc);

                // Refresh current active report tab
                const activeTab = document.querySelector('.report-nav-btn.active');
                if (activeTab) {
                    // Extract the type from the onclick attribute or data-type if we had one
                    // Simplest: just look at the active tab and reload based on its text or a data-type
                    const typeMatch = activeTab.getAttribute('onclick').match(/'([^']+)'/);
                    if (typeMatch) this.loadReportData(typeMatch[1]);
                }
            }
        } catch (err) {
            console.error('Analytics load error:', err);
        }
    }

    switchReportTab(type, btn) {
        document.querySelectorAll('.report-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadReportData(type);
    }

    async loadReportData(type) {
        const from = document.getElementById('report-date-from').value;
        const to = document.getElementById('report-date-to').value;
        const groupBy = document.getElementById('report-group-by')?.value || 'daily';
        const titleEl = document.getElementById('report-title');

        let apiType = type;
        if (type === 'products') apiType = 'top_products';
        if (type === 'discounts') apiType = 'discount_impact';

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=${apiType}&dateFrom=${from}&dateTo=${to}&groupBy=${groupBy}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const results = data.data;
                this.updateReportChart(type, results);
                this.updateReportTable(type, results);

                const navBtn = document.querySelector(`.report-nav-btn.active`);
                if (navBtn && titleEl) titleEl.textContent = navBtn.textContent.trim();
            }
        } catch (err) {
            console.error('Report load error:', err);
            this.showNotification('Failed to load report data', 'error');
        }
    }

    updateReportChart(type, data) {
        const ctx = document.getElementById('reportChart');
        if (!ctx) return;

        if (this.charts.reportChart) this.charts.reportChart.destroy();

        let labels = [];
        let values = [];
        let label = 'Revenue (LKR)';
        let chartType = 'bar';

        if (Array.isArray(data)) {
            labels = data.map(d => d.label || 'Unknown');
            values = data.map(d => d.total || 0);
        }

        if (type === 'date') chartType = 'line';
        if (['payments', 'expenses', 'route', 'vehicle'].includes(type)) chartType = 'doughnut';

        if (type === 'discounts') {
            labels = ['Net Sales', 'Bill Discounts', 'Item Discounts'];
            values = [data.total_net_sales || 0, data.total_bill_discounts || 0, data.total_item_discounts || 0];
            chartType = 'pie';
        }

        const colors = [
            '#2E7D32', '#1976D2', '#9c27b0', '#ff9800', '#f44336',
            '#009688', '#3f51b5', '#cddc39', '#ffeb3b', '#795548'
        ];

        this.charts.reportChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: chartType === 'line' ? 'rgba(46, 125, 50, 0.05)' : colors,
                    borderColor: '#2E7D32',
                    borderWidth: 2,
                    fill: chartType === 'line',
                    tension: 0.4,
                    pointBackgroundColor: '#2E7D32',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: chartType !== 'line',
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20, font: { weight: '600', size: 11 } }
                    }
                },
                scales: {
                    y: {
                        display: chartType !== 'pie' && chartType !== 'doughnut',
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.03)' },
                        ticks: {
                            font: { size: 11 },
                            callback: (value) => 'LKR ' + (value >= 1000 ? (value / 1000) + 'k' : value)
                        }
                    },
                    x: {
                        display: chartType !== 'pie' && chartType !== 'doughnut',
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }

    updateReportTable(type, data) {
        const thead = document.getElementById('report-table-head');
        const tbody = document.getElementById('report-table-body');
        if (!tbody || !thead) return;

        tbody.innerHTML = '';
        thead.innerHTML = '';

        if (type === 'discounts') {
            thead.innerHTML = `<tr><th>Metric</th><th>Value</th></tr>`;
            tbody.innerHTML = `
                <tr><td>Total Net Sales</td><td>${this.formatCurrency(data.total_net_sales)}</td></tr>
                <tr><td>Bill Discounts Given</td><td>${this.formatCurrency(data.total_bill_discounts)}</td></tr>
                <tr><td>Item Level Discounts</td><td>${this.formatCurrency(data.total_item_discounts)}</td></tr>
                <tr><td style="font-weight:600">Total Revenue Impact</td><td style="color:var(--error); font-weight:700">${this.formatCurrency(data.total_bill_discounts + data.total_item_discounts)}</td></tr>
                <tr><td>Discounted Invoices</td><td>${data.discounted_invoices_count} / ${data.total_invoices} (${((data.discounted_invoices_count / (data.total_invoices || 1)) * 100).toFixed(1)}%)</td></tr>
            `;
            return;
        }

        let labelName = type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
        if (type === 'sales_rep') labelName = 'Sales Representative';
        if (type === 'date') labelName = 'Period';
        if (type === 'debtors') labelName = 'Customer';
        if (type === 'payments') labelName = 'Payment Type';
        if (type === 'expenses') labelName = 'Expense Category';
        if (type === 'inventory') labelName = 'Product';
        if (type === 'load_consistency') labelName = 'Vehicle';

        let countHeader = 'Invoices / Qty';
        if (type === 'debtors') countHeader = 'Status';
        if (type === 'payments' || type === 'expenses') countHeader = 'Transaction Count';
        if (type === 'load_consistency') countHeader = 'Efficiency %';

        thead.innerHTML = `
            <th>${labelName}</th>
            <th class="text-center">${countHeader}</th>
            <th class="text-right">Total Amount / Value</th>
        `;

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center">No data available for selected period</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(d => {
            let secondaryVal = d.count || d.quantity || 0;
            if (type === 'debtors') {
                const status = d.label_secondary || 'active';
                secondaryVal = `<span class="badge ${status === 'active' ? 'badge-success' : 'badge-danger'}">${status}</span>`;
            }
            if (type === 'load_consistency') {
                secondaryVal = `${(d.total || 0).toFixed(1)}%`;
            }

            return `
                <tr>
                    <td>${d.label || 'Unknown'}</td>
                    <td class="text-center">${secondaryVal}</td>
                    <td class="text-right" style="font-weight: 600;">${type === 'load_consistency' ? d.count + ' Loads' : this.formatCurrency(d.total)}</td>
                </tr>
            `;
        }).join('');
    }

    exportReport(format) {
        const activeTab = document.querySelector('.report-nav-btn.active')?.textContent.trim() || 'Report';
        this.showNotification(`Exporting ${activeTab} as ${format.toUpperCase()}...`, 'info');

        if (format === 'csv') {
            const table = document.getElementById('report-table');
            if (!table) return;

            let csv = [];
            const rows = table.querySelectorAll('tr');
            for (let i = 0; i < rows.length; i++) {
                const row = [], cols = rows[i].querySelectorAll('td, th');
                for (let j = 0; j < cols.length; j++)
                    row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
                csv.push(row.join(','));
            }

            const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${activeTab.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            window.print();
        }
    }

    // --- CUSTOMER INTELLIGENCE ---
    initCustomerIntelligenceView() {
        const fromInput = document.getElementById('ci-date-from');
        const toInput = document.getElementById('ci-date-to');
        if (fromInput && !fromInput.value) {
            const lastMonth = new Date();
            lastMonth.setDate(lastMonth.getDate() - 30);
            fromInput.value = lastMonth.toISOString().split('T')[0];
        }
        if (toInput && !toInput.value) {
            toInput.value = new Date().toISOString().split('T')[0];
        }
        this.loadCustomerIntelligence();
    }

    async loadCustomerIntelligence() {
        const from = document.getElementById('ci-date-from').value;
        const to = document.getElementById('ci-date-to').value;

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=customer_intelligence&dateFrom=${from}&dateTo=${to}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const { metrics, cohort, outstanding } = data.data;

                // 1. Update KPIs
                document.getElementById('ci-new-count').textContent = cohort.new_customers || 0;
                document.getElementById('ci-inactive-count').textContent = cohort.inactive_customers || 0;
                document.getElementById('ci-total-outstanding').textContent = this.formatCurrency(outstanding.total_outstanding || 0);
                document.getElementById('ci-over-limit').textContent = (outstanding.over_limit_count || 0) + ' Accounts';
                document.getElementById('ci-over-limit-amt').textContent = this.formatCurrency(outstanding.over_limit_amount || 0) + ' Over';

                // 2. Render Charts
                this.renderCICharts(metrics, cohort);

                // 3. Render Table
                this.renderCITable(metrics);
            }
        } catch (err) {
            console.error('Customer Intelligence load error:', err);
            this.showNotification('Failed to load intelligence data', 'error');
        }
    }

    renderCICharts(metrics, cohort) {
        // Credit Usage Doughnut
        const usageCtx = document.getElementById('creditUsageChart');
        if (usageCtx) {
            if (this.charts.creditUsageChart) this.charts.creditUsageChart.destroy();

            const over = metrics.filter(m => m.credit_usage_percent > 100).length;
            const high = metrics.filter(m => m.credit_usage_percent > 75 && m.credit_usage_percent <= 100).length;
            const mid = metrics.filter(m => m.credit_usage_percent > 25 && m.credit_usage_percent <= 75).length;
            const low = metrics.filter(m => m.credit_usage_percent <= 25).length;

            this.charts.creditUsageChart = new Chart(usageCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Over Limit', 'High Usage (>75%)', 'Medium Usage', 'Low/Zero Usage'],
                    datasets: [{
                        data: [over, high, mid, low],
                        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    cutout: '70%'
                }
            });
        }

        // Behavior Chart
        const behaviorCtx = document.getElementById('behaviorChart');
        if (behaviorCtx) {
            if (this.charts.behaviorChart) this.charts.behaviorChart.destroy();
            this.charts.behaviorChart = new Chart(behaviorCtx, {
                type: 'bar',
                data: {
                    labels: ['New Customers', 'Active (Returning)', 'Inactive'],
                    datasets: [{
                        label: 'Accounts',
                        data: [cohort.new_customers, cohort.total_customers - cohort.new_customers - cohort.inactive_customers, cohort.inactive_customers],
                        backgroundColor: ['#3b82f6', '#10b981', '#64748b']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }

    renderCITable(metrics) {
        const tbody = document.getElementById('ci-table-body');
        if (!tbody) return;

        tbody.innerHTML = metrics.map(m => {
            const usagePercent = Math.round(m.credit_usage_percent || 0);
            let usageClass = 'progress-bar-success';
            if (usagePercent > 75) usageClass = 'progress-bar-warning';
            if (usagePercent > 100) usageClass = 'progress-bar-danger';

            const lastDate = m.last_purchase ? new Date(m.last_purchase) : null;
            const now = new Date();
            const daysSince = lastDate ? Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)) : 999;

            let statusBadge = '<span class="badge badge-success">ACTIVE</span>';
            if (daysSince > 30) statusBadge = '<span class="badge badge-warning">SLEEPING</span>';
            if (daysSince > 90) statusBadge = '<span class="badge badge-danger">INACTIVE</span>';

            return `
                <tr>
                    <td style="font-weight:700; color:var(--gray-800)">${m.name}</td>
                    <td class="text-right" style="font-weight:600">${this.formatCurrency(m.lifetime_value || 0)}</td>
                    <td class="text-center">${m.period_orders || 0}</td>
                    <td class="text-right" style="color:${m.balance > 0 ? 'var(--error)' : 'var(--gray-600)'}">${this.formatCurrency(m.balance || 0)}</td>
                    <td>
                        <div style="width: 100px; background: #eee; border-radius: 4px; height: 8px; overflow: hidden; margin-top: 5px;">
                            <div style="width: ${Math.min(usagePercent, 100)}%; height: 100%; background: ${usagePercent > 100 ? '#ef4444' : usagePercent > 75 ? '#f59e0b' : '#10b981'}"></div>
                        </div>
                        <span style="font-size: 0.7rem; color: var(--gray-500)">${usagePercent}% used</span>
                    </td>
                    <td style="font-size: 0.85rem">${m.last_purchase || 'Never'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    // --- INVENTORY INTELLIGENCE ---
    initInventoryIntelligenceView() {
        const fromInput = document.getElementById('ii-date-from');
        const toInput = document.getElementById('ii-date-to');
        if (fromInput && !fromInput.value) {
            const lastMonth = new Date();
            lastMonth.setDate(lastMonth.getDate() - 30);
            fromInput.value = lastMonth.toISOString().split('T')[0];
        }
        if (toInput && !toInput.value) {
            toInput.value = new Date().toISOString().split('T')[0];
        }
        this.loadInventoryIntelligence();
    }

    async loadInventoryIntelligence() {
        const from = document.getElementById('ii-date-from').value;
        const to = document.getElementById('ii-date-to').value;

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=inventory_intelligence&dateFrom=${from}&dateTo=${to}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const { loadMetrics, trends, reorderAlerts } = data.data;

                // 1. Update KPIs
                const totalLoaded = loadMetrics.reduce((sum, m) => sum + (m.loaded || 0), 0);
                const totalDelivered = loadMetrics.reduce((sum, m) => sum + (m.delivered || 0), 0);
                const totalVariance = loadMetrics.reduce((sum, m) => sum + (m.total_variance || 0), 0);
                const avgAccuracy = loadMetrics.length > 0
                    ? (loadMetrics.reduce((sum, m) => sum + (m.delivered + m.returned) / m.loaded, 0) / loadMetrics.length * 100)
                    : 100;

                document.getElementById('ii-total-loaded').textContent = totalLoaded.toLocaleString();
                document.getElementById('ii-total-delivered').textContent = totalDelivered.toLocaleString();
                document.getElementById('ii-variance-count').textContent = totalVariance.toLocaleString();
                document.getElementById('ii-avg-accuracy').textContent = Math.round(avgAccuracy) + '%';

                // 2. Render Charts
                this.renderIICharts(loadMetrics, trends);

                // 3. Render Table
                this.renderIITable(loadMetrics);

                // 4. Render Reorder Alerts
                this.renderReorderAlerts(reorderAlerts);
            }
        } catch (err) {
            console.error('Inventory Intelligence load error:', err);
            this.showNotification('Failed to load inventory intelligence', 'error');
        }
    }

    renderIICharts(loadMetrics, trends) {
        // Stock Trend Chart
        const trendCtx = document.getElementById('stockTrendChart');
        if (trendCtx) {
            if (this.charts.stockTrendChart) this.charts.stockTrendChart.destroy();
            this.charts.stockTrendChart = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: trends.map(t => t.label),
                    datasets: [
                        { label: 'Stock Out (Loading)', data: trends.map(t => t.stock_out), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', fill: true, tension: 0.4 },
                        { label: 'Stock In (Returns)', data: trends.map(t => t.stock_in), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)', fill: true, tension: 0.4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        // Load Accuracy by Vehicle
        const accuracyCtx = document.getElementById('loadAccuracyChart');
        if (accuracyCtx) {
            if (this.charts.loadAccuracyChart) this.charts.loadAccuracyChart.destroy();
            this.charts.loadAccuracyChart = new Chart(accuracyCtx, {
                type: 'bar',
                data: {
                    labels: loadMetrics.map(m => m.label),
                    datasets: [{
                        label: 'Accuracy %',
                        data: loadMetrics.map(m => Math.min(100, Math.round(((m.delivered + m.returned) / m.loaded) * 100))),
                        backgroundColor: loadMetrics.map(m => ((m.delivered + m.returned) / m.loaded) >= 0.98 ? '#10b981' : '#f59e0b')
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 100 } }
                }
            });
        }
    }

    renderIITable(loadMetrics) {
        const tbody = document.getElementById('ii-table-body');
        if (!tbody) return;
        tbody.innerHTML = loadMetrics.map(m => {
            const accuracy = Math.round(((m.delivered + m.returned) / m.loaded) * 100);
            return `
                <tr>
                    <td><strong>${m.label}</strong></td>
                    <td class="text-center">${m.loaded}</td>
                    <td class="text-center">${m.delivered}</td>
                    <td class="text-center">${m.returned}</td>
                    <td class="text-center" style="color: ${m.total_variance > 0 ? '#ef4444' : '#10b981'}">${m.total_variance}</td>
                    <td class="text-center">
                        <span class="badge ${accuracy >= 98 ? 'badge-success' : 'badge-warning'}">${accuracy}%</span>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="6" class="text-center">No data found for the selected range</td></tr>';
    }

    renderReorderAlerts(alerts) {
        const container = document.getElementById('ii-reorder-alerts');
        if (!container) return;

        // Show only those with low stock or high sales priority
        const filtered = alerts.filter(a => a.current_stock < 50); // Using 50 as a generic threshold

        if (filtered.length === 0) {
            container.innerHTML = '<p style="color: var(--gray-500); font-size: 0.85rem;">No critical low-stock items.</p>';
            return;
        }

        container.innerHTML = filtered.map(a => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 6px;">
                <div>
                    <h5 style="margin: 0; font-size: 0.85rem; font-weight: 700;">${a.name}</h5>
                    <small style="color: #64748b">Weekly Sales: ${a.weekly_sales || 0}</small>
                </div>
                <div style="text-align: right">
                    <span style="font-size: 0.9rem; font-weight: 800; color: #ef4444;">${a.current_stock}</span>
                    <small style="display: block; font-size: 0.6rem; color: #94a3b8">LEVEL</small>
                </div>
            </div>
        `).join('');
    }

    // --- DEMAND FORECASTING ---
    initDemandForecastingView() {
        const fromInput = document.getElementById('df-date-from');
        const toInput = document.getElementById('df-date-to');
        if (fromInput && !fromInput.value) {
            const lastMonth = new Date();
            lastMonth.setDate(lastMonth.getDate() - 30);
            fromInput.value = lastMonth.toISOString().split('T')[0];
        }
        if (toInput && !toInput.value) {
            toInput.value = new Date().toISOString().split('T')[0];
        }
        this.loadDemandForecasting();
    }

    async loadDemandForecasting() {
        const from = document.getElementById('df-date-from').value;
        const to = document.getElementById('df-date-to').value;

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=demand_forecast&dateFrom=${from}&dateTo=${to}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const { productDemand, fulfillment, routeForecast, leadTime } = data.data;

                // 1. Update KPIs
                const fulfillRate = fulfillment.total_preorders > 0
                    ? Math.round((fulfillment.fulfilled_count / fulfillment.total_preorders) * 100)
                    : 100;
                const backorderRate = fulfillment.total_preorders > 0
                    ? Math.round((fulfillment.backorder_count / fulfillment.total_preorders) * 100)
                    : 0;

                document.getElementById('df-fulfillment-rate').textContent = fulfillRate + '%';
                document.getElementById('df-fulfilled-count').textContent = `${fulfillment.fulfilled_count} orders converted`;
                document.getElementById('df-backorder-rate').textContent = backorderRate + '%';
                document.getElementById('df-backorder-count').textContent = `${fulfillment.backorder_count} orders pending`;
                document.getElementById('df-lost-revenue').textContent = this.formatCurrency(fulfillment.lost_revenue_estimate || 0);
                document.getElementById('df-avg-lead').textContent = `${leadTime} Days`;

                // 2. Render Charts
                this.renderDFCharts(productDemand, routeForecast);

                // 3. Render Table
                this.renderDFTable(productDemand);
            }
        } catch (err) {
            console.error('Demand Forecast load error:', err);
            this.showNotification('Failed to load forecasting data', 'error');
        }
    }

    renderDFCharts(productDemand, routeForecast) {
        // Pre-order vs Sales Comparison
        const comparisonCtx = document.getElementById('preOrderSalesChart');
        if (comparisonCtx) {
            if (this.charts.preOrderSalesChart) this.charts.preOrderSalesChart.destroy();
            this.charts.preOrderSalesChart = new Chart(comparisonCtx, {
                type: 'bar',
                data: {
                    labels: productDemand.map(p => p.label),
                    datasets: [
                        { label: 'Pre-Order Demand', data: productDemand.map(p => p.pre_ordered), backgroundColor: '#8b5cf6' },
                        { label: 'Actual Realized Sales', data: productDemand.map(p => p.actual_sales), backgroundColor: '#10b981' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // Route Demand Concentration
        const routeCtx = document.getElementById('routeDemandChart');
        if (routeCtx) {
            if (this.charts.routeDemandChart) this.charts.routeDemandChart.destroy();
            this.charts.routeDemandChart = new Chart(routeCtx, {
                type: 'doughnut',
                data: {
                    labels: routeForecast.map(r => r.route_name),
                    datasets: [{
                        data: routeForecast.map(r => r.demand_value),
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } },
                    cutout: '60%'
                }
            });
        }
    }

    renderDFTable(productDemand) {
        const tbody = document.getElementById('df-table-body');
        if (!tbody) return;

        tbody.innerHTML = productDemand.map(p => {
            const gap = Math.max(0, p.pre_ordered - p.actual_sales);
            const trendIcon = p.pre_ordered > p.actual_sales ? 'fa-arrow-up' : 'fa-check';
            const trendColor = p.pre_ordered > p.actual_sales ? '#f97316' : '#10b981';

            return `
                <tr>
                    <td style="font-weight:700; color:var(--gray-800)">${p.label}</td>
                    <td class="text-right">${p.pre_ordered}</td>
                    <td class="text-right" style="color:#10b981; font-weight:600">${p.actual_sales}</td>
                    <td class="text-right" style="color:${gap > 0 ? '#ef4444' : '#64748b'}">${gap}</td>
                    <td class="text-center">
                        <i class="fas ${trendIcon}" style="color:${trendColor}"></i>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" class="text-center">No demand data found for this period</td></tr>';
    }

    // --- REPORT CENTER ---
    initReportCenterView() {
        const fromInput = document.getElementById('rc-from');
        const toInput = document.getElementById('rc-to');
        if (fromInput && !fromInput.value) {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            fromInput.value = firstDay.toISOString().split('T')[0];
            toInput.value = today.toISOString().split('T')[0];
        }
    }

    generateA4Report(type) {
        document.getElementById('rc-type').value = type;
        const modal = document.getElementById('report-config-modal');
        modal.classList.add('active');

        // Update active title in modal for visibility
        const titleMap = {
            'daily_sales': 'Revenue Trend Analysis',
            'customer': 'Customer Sales Summary',
            'top_products': 'Top Product Performance',
            'bottom_products': 'Low-Velocity Stock Audit',
            'stock_ledger': 'Real-time Stock Master',
            'debtor_list': 'Master Ageing Ledger',
            'payments': 'Payment Method Distribution',
            'expense_summary': 'Operating Expenses Audit',
            'product_discounts': 'Client Discount Yield Audit'
        };
        document.getElementById('rc-active-title').textContent = titleMap[type] || type.replace('_', ' ').toUpperCase();

        const dateGroup = document.getElementById('rc-date-group');
        const groupingGroup = document.getElementById('rc-grouping-group');
        const customerGroup = document.getElementById('rc-customer-group');

        if (type === 'stock_ledger') {
            dateGroup.style.display = 'none';
            groupingGroup.style.display = 'none';
            if (customerGroup) customerGroup.style.display = 'none';
        } else if (type === 'product_discounts') {
            dateGroup.style.display = 'block';
            groupingGroup.style.display = 'none';
            if (customerGroup) {
                customerGroup.style.display = 'block';
                this.populateReportCustomers();
            }
        } else if (['top_products', 'bottom_products', 'customer', 'payments', 'expense_summary', 'debtor_list'].includes(type)) {
            dateGroup.style.display = 'block';
            groupingGroup.style.display = 'none';
            if (customerGroup) customerGroup.style.display = 'none';
        } else {
            dateGroup.style.display = 'block';
            groupingGroup.style.display = 'block';
            if (customerGroup) customerGroup.style.display = 'none';
        }

        // Reset to daily by default on open
        this.setReportAggregation('daily', document.querySelector('.rc-agg-chip'));
    }

    setReportAggregation(value, element) {
        document.querySelectorAll('.rc-agg-chip').forEach(c => c.classList.remove('selected'));
        if (element) element.classList.add('selected');
        document.getElementById('rc-group-by').value = value;

        const fromInput = document.getElementById('rc-from');
        const toInput = document.getElementById('rc-to');
        if (!fromInput || !toInput) return;

        const today = new Date();
        let fromDate, toDate;

        switch (value) {
            case 'daily':
                // Just Today
                fromDate = today;
                toDate = today;
                break;
            case 'weekly':
                // Last 7 days (One Week)
                fromDate = new Date(today);
                fromDate.setDate(today.getDate() - 7);
                toDate = today;
                break;
            case 'monthly':
                // Last 30 days (One Month)
                fromDate = new Date(today);
                fromDate.setDate(today.getDate() - 30);
                toDate = today;
                break;
            case 'yearly':
                // Last 365 days (One Year)
                fromDate = new Date(today);
                fromDate.setDate(today.getDate() - 365);
                toDate = today;
                break;
            default:
                return;
        }

        fromInput.value = fromDate.toISOString().split('T')[0];
        toInput.value = toDate.toISOString().split('T')[0];
    }

    async populateReportCustomers() {
        const select = document.getElementById('rc-customer-id');
        if (!select) return;

        // If already populated, skip
        if (select.options.length > 1) return;

        try {
            const res = await this.apiCall('/api/customers?limit=1000');
            if (res) {
                const data = await res.json();
                if (data.success) {
                    select.innerHTML = '<option value="">All Customers (Aggregated)</option>' +
                        data.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                }
            }
        } catch (e) {
            console.error('Failed to populate report customers', e);
        }
    }

    async processReportPrint() {
        const type = document.getElementById('rc-type').value;
        const from = document.getElementById('rc-from').value;
        const to = document.getElementById('rc-to').value;
        const groupBy = document.getElementById('rc-group-by').value;

        this.showNotification(`Generating A4 report: ${type.replace('_', ' ')}...`, 'info');

        try {
            let apiType = type;
            if (type === 'daily_sales') apiType = `date&groupBy=${groupBy}`;
            if (type === 'monthly_revenue') apiType = `date&groupBy=monthly`; // Specific button
            if (type === 'debtor_list') apiType = 'debtors';
            if (type === 'expense_summary') apiType = 'expenses';
            if (type === 'stock_ledger') apiType = 'inventory';
            if (type === 'customer') apiType = 'customer';
            if (type === 'top_products') apiType = 'top_products';
            if (type === 'bottom_products') apiType = 'low_products';
            if (type === 'payments') apiType = 'payments';
            if (type === 'product_discounts') apiType = 'product_discounts';

            const customerId = document.getElementById('rc-customer-id')?.value || '';
            const res = await this.apiCall(`/api/reports/sales-analytics?type=${apiType}&dateFrom=${from}&dateTo=${to}&groupBy=${groupBy}&customerId=${customerId}`);
            if (!res) return;
            const data = await res.json();

            if (data.success) {
                this.printA4Document(type, data.data, { from, to });
            }
        } catch (err) {
            console.error('Report Generation Error:', err);
            this.showNotification('Failed to generate report data', 'error');
        }

        document.getElementById('report-config-modal').classList.remove('active');
    }

    printA4Document(type, data, params) {
        const printWindow = window.open('', '_blank');
        const company = JSON.parse(localStorage.getItem('companyDetails') || '{}');
        const title = type.replace('_', ' ').toUpperCase();

        let labelHeader = 'Classification';
        let centerHeader = 'Volume / Count';
        let totalHeader = 'Realization (LKR)';

        if (type === 'debtor_list') {
            labelHeader = 'Customer Account';
            centerHeader = 'Status';
            totalHeader = 'Balance (LKR)';
        } else if (type === 'stock_ledger') {
            labelHeader = 'Product Description';
            centerHeader = 'Available Stock';
            totalHeader = 'Asset Value (LKR)';
        } else if (type.includes('product')) {
            labelHeader = 'Product Name';
        } else if (type === 'customer') {
            labelHeader = 'Customer Name';
        } else if (type === 'product_discounts') {
            labelHeader = 'Product Description';
            centerHeader = 'Qty | Avg Disc %';
            totalHeader = 'Discount Given (LKR)';
        }

        let contentHtml = '';
        if (Array.isArray(data)) {
            contentHtml = `
                <table style="width:100%; border-collapse: separate; border-spacing: 0; margin-top: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">${labelHeader}</th>
                            <th style="padding: 16px; text-align: center; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">${centerHeader}</th>
                            <th style="padding: 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">${totalHeader}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((d, idx) => {
                let centerVal = d.count || d.quantity || 0;
                if (type === 'debtor_list') {
                    centerVal = (d.label_secondary || 'active').toUpperCase();
                } else if (type === 'product_discounts') {
                    centerVal = `${d.quantity} | ${(d.discount_pct || 0).toFixed(1)}%`;
                }

                return `
                                <tr style="background: ${idx % 2 === 0 ? 'white' : '#fcfdfe'};">
                                    <td style="padding: 14px 16px; font-size: 13px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">${d.label || 'N/A'}</td>
                                    <td style="padding: 14px 16px; text-align: center; font-size: 13px; color: ${['debtor_list', 'product_discounts'].includes(type) ? '#10b981' : '#64748b'}; font-weight: ${['debtor_list', 'product_discounts'].includes(type) ? '700' : 'normal'}; border-bottom: 1px solid #f1f5f9;">${centerVal}</td>
                                    <td style="padding: 14px 16px; text-align: right; font-size: 13px; font-weight: 700; color: ${type === 'product_discounts' ? '#ef4444' : '#0f172a'}; border-bottom: 1px solid #f1f5f9;">${this.formatCurrency(d.total)}</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc;">
                            <td colspan="2" style="padding: 18px 16px; font-weight: 800; text-align: right; font-size: 14px; text-transform: uppercase; color: #475569;">Grand Total</td>
                            <td style="padding: 18px 16px; font-weight: 900; text-align: right; font-size: 16px; color: #10b981;">${this.formatCurrency(data.reduce((acc, curr) => acc + (curr.total || 0), 0))}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>${title} - ${company.name || 'MKC'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 15mm 20mm; }
                    body { font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; background: white; }
                    .header-container { border-bottom: 4px solid #10b981; padding-bottom: 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .company-brand h1 { margin: 0; color: #064e3b; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
                    .company-brand p { margin: 6px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500; }
                    .report-identity { text-align: right; }
                    .report-identity h2 { margin: 0; color: #10b981; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
                    .meta-grid { display: grid; grid-template-columns: auto auto; gap: 4px 16px; margin-top: 10px; font-size: 11px; color: #94a3b8; }
                    .meta-grid strong { color: #475569; }
                    .status-bar { background: #f0fdf4; border-radius: 8px; padding: 10px 16px; font-size: 12px; font-weight: 600; color: #166534; margin-top: 20px; border: 1px solid #bbf7d0; display: inline-flex; align-items: center; }
                    .signature-grid { margin-top: 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
                    .sig-block { border-top: 1.5px solid #e2e8f0; padding-top: 12px; text-align: center; }
                    .sig-block span { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
                    .sig-block strong { display: block; margin-top: 4px; font-size: 13px; color: #1e293b; }
                    .footer-watermark { position: fixed; bottom: 0; width: 100%; font-size: 9px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; justify-content: space-between; font-weight: 500; }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="company-brand">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <div style="width: 32px; height: 32px; background: #10b981; border-radius: 8px;"></div>
                            <h1>${company.name || 'M.K.C. TRADE CENTER'}</h1>
                        </div>
                        <p>${company.address || 'District Warehouse, Colombo, Sri Lanka'}</p>
                        <p>Tel: ${company.phone || '+94 XX XXX XXXX'} | Email: support@mkctrade.com</p>
                    </div>
                    <div class="report-identity">
                        <h2>${title}</h2>
                        <div class="meta-grid">
                            <span>Reference ID:</span> <strong>RPT-${Date.now().toString().slice(-6)}</strong>
                            <span>Generated:</span> <strong>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                            <span>Timeline:</span> <strong>${params.from} to ${params.to}</strong>
                        </div>
                    </div>
                </div>

                <div class="status-bar">
                    Certified Audit Document • Official Digital Copy
                </div>
                
                ${contentHtml}

                <div class="signature-grid">
                    <div class="sig-block">
                        <strong>System Administrator</strong>
                        <span>Prepared & Compiled By</span>
                    </div>
                    <div class="sig-block">
                        <div style="height: 40px;"></div>
                        <strong>Managing Director</strong>
                        <span>Verified & Approved Authority</span>
                    </div>
                </div>

                <div class="footer-watermark">
                    <span>${title} | Compiled via AgroDistribution Enterprise Resource Planning (ERP)</span>
                    <span>Copyright &copy; ${new Date().getFullYear()} MKC Trade Center. Page 01 / 01</span>
                </div>

                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new AgroDistributionApp(); });
