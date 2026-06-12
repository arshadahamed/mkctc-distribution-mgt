// ========================================
// AGRO DISTRIBUTION SYSTEM - MAIN APP
// ========================================

class AgroDistributionApp {
    constructor() {
        this.currentUser = null;
        this.token = sessionStorage.getItem('token');
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
            'price-levels': ['view', 'create', 'edit', 'delete'],
            'expenses': ['view', 'create', 'edit', 'delete'],
            'distribution': ['view', 'create', 'edit', 'delete'],
            'vehicles': ['view', 'create', 'edit', 'delete'],
            'routes': ['view', 'create', 'edit', 'delete'],
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
        this.paymentPage = 1;
        this.paymentPageSize = 15;
        this.paymentTotalPages = 1;
        this.logoutProcessing = false;
        this.dashboardEditMode = false;
        this.dragSource = null;

        // POS State
        this.posState = {
            cart: [],
            selectedLoadId: null,
            products: [],
            renderedProducts: [], // Products currently visible
            renderedCount: 0,
            pageSize: 12, // Load in batches of 12
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

        // Periodic Session Validation (every 5s)
        // This ensures kicked users are redirected even if idle
        setInterval(() => this.validateSession(), 5000);

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
            console.warn('No token found in app state, checking sessionStorage directly...');
            this.token = sessionStorage.getItem('token');
        }

        if (!this.token || this.token === 'undefined' || this.token === 'null') {
            console.warn('No valid token found, redirecting to login.');
            window.location.replace('/login');
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
                sessionStorage.setItem('user', JSON.stringify(data.user));
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
            'customers': ['customers-submenu'], // Corrected from customers
            'suppliers': ['suppliers'],
            'sales': ['sales-submenu'], // Parent menu
            'payments': ['payments'],
            'distribution': ['distribution-submenu'], // Parent menu
            'admin': ['admin'],
            'logs': ['logs']
        };

        // Reset all first
        document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'block');

        // Check specific Parent Modules
        if (!this.hasPermission('products', 'view')) {
            const link = document.querySelector('[data-target="product-submenu"]');
            if (link) link.closest('.nav-item').style.display = 'none';
        }
        if (!this.hasPermission('customers', 'view') && !this.hasPermission('visits', 'view')) {
            const link = document.querySelector('[data-target="customers-submenu"]');
            if (link) link.closest('.nav-item').style.display = 'none';
        }
        if (!this.hasPermission('distribution', 'view') && !this.hasPermission('vehicles', 'view') &&
            !this.hasPermission('routes', 'view') && !this.hasPermission('rma', 'view')) {
            const link = document.querySelector('[data-target="distribution-submenu"]');
            if (link) link.closest('.nav-item').style.display = 'none';
        }
        if (!this.hasPermission('sales', 'view') && !this.hasPermission('pre-orders', 'view')) {
            const link = document.querySelector('[data-target="sales-submenu"]');
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
        const subModules = ['customers', 'suppliers', 'sales', 'payments', 'admin', 'logs', 'distribution', 'routes', 'vehicles', 'rma', 'visits', 'pre-orders', 'sales-history', 'customer-map'];
        subModules.forEach(module => {
            let checkMod = module;
            if (module === 'sales-history') checkMod = 'sales';
            if (module === 'customer-map') checkMod = 'customers';

            if (!this.hasPermission(checkMod, 'view') && !(checkMod === 'admin' && role === 'admin')) {
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
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        this.token = null;

        // Clear remaining session and local data
        sessionStorage.clear();
        localStorage.clear(); // Clear themes/layouts too for a full reset if needed, or keep for preference? 
        // User asked to "logout the user", clearing sessionStorage is enough for auth.
        // But logout usually resets everything.
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

        // POS Event Listeners - Moved to loadSalesPOS to handle lazy loading

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
        document.getElementById('cheque-status-form')?.addEventListener('submit', (e) => this.handleChequeStatusUpdate(e));



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
        // --- PERMISSION CHECK ---
        // Check if the page being navigated to requires specific permissions
        // 'dashboard', 'settings', etc. are usually public to authenticated users
        const publicPages = ['dashboard', 'settings', 'profile'];

        if (!publicPages.includes(page)) {
            // Determine module name (sometimes page name differs from module name)
            let module = page;
            if (['categories', 'brands', 'units', 'sizes'].includes(page)) module = page;
            if (page === 'sales-history') module = 'sales';
            if (page === 'customer-map') module = 'customers';
            if (page === 'pre-orders') module = 'pre-orders';

            // If the page is a module in PERMISSIONS, check 'view' access
            if (this.PERMISSIONS[module] && !this.hasPermission(module, 'view')) {
                this.showNotification('Access Denied: You do not have permission to view this section.', 'error');

                // If this was triggered by a URL load (history reset), go to dashboard
                if (this.currentView === page) {
                    this.currentView = 'dashboard';
                    this.navigateTo('dashboard', true);
                }
                return;
            }
        }

        this.currentView = page;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
        document.querySelectorAll('.view-content').forEach(v => v.style.display = 'none');

        // Dynamic View Selection
        let targetView = document.getElementById(`${page}-view`);
        if (!targetView && ['categories', 'brands', 'units', 'sizes', 'routes', 'price-levels'].includes(page)) targetView = document.getElementById('master-view');

        if (targetView) {
            // Lazy load HTML template if empty or only contains a placeholder comment
            const isLoaded = targetView.children.length > 0 || (targetView.innerHTML.trim() !== '' && !targetView.innerHTML.includes('<!--'));
            if (!isLoaded) {
                // Show a subtle loading indicator
                targetView.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: var(--gray-400);">
                        <div class="loading-spinner"></div>
                        <p style="margin-top: 15px; font-weight: 500;">Loading content...</p>
                    </div>
                `;
                targetView.style.display = 'block';

                try {
                    const viewToFetch = ['categories', 'brands', 'units', 'sizes', 'routes', 'price-levels'].includes(page) ? 'master' : page;
                    console.log(`Lazy loading view: ${viewToFetch}`);
                    const response = await fetch(`/api/views/${viewToFetch}`);
                    if (!response.ok) throw new Error(`Failed to load view: ${viewToFetch}`);
                    const html = await response.text();

                    // If the fetched content is a full <div id="...-view">...</div>, extract the innerHTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    const innerView = tempDiv.querySelector('.view-content');
                    if (innerView) {
                        targetView.innerHTML = innerView.innerHTML;
                    } else {
                        targetView.innerHTML = html;
                    }

                    // Execute any scripts found in the template
                    this.executeScripts(targetView);
                } catch (err) {
                    console.error('Lazy Loading Error:', err);
                    targetView.innerHTML = `
                        <div class="alert alert-error" style="margin: 20px; border-radius: 12px;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>Error:</strong> Could not load view content. Please try refreshing the page.
                        </div>
                    `;
                }
            }
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

    async loadScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async loadStyle(href) {
        if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    async loadView(view) {
        const loaders = {
            dashboard: async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
                await this.loadDashboardData();
                this.initializeCharts();
            },
            products: async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js');
                await this.loadProducts();
            },
            customers: () => this.loadCustomers(),
            suppliers: () => this.loadSuppliers(),
            categories: () => this.loadMasterData('categories'),
            brands: () => this.loadMasterData('brands'),
            units: () => this.loadMasterData('units'),
            routes: () => this.loadRoutes(),
            'price-levels': () => this.loadMasterData('price-levels'),
            'grn': () => this.loadGrnData(),
            payments: () => this.loadPayments(),
            visits: () => { this.loadVisits(); this.loadVisitFilters(); },
            settings: () => this.loadSettings(),
            logs: () => this.loadLogs(),
            sizes: () => this.loadMasterData('sizes'),
            admin: () => this.loadUsers(),
            vehicles: () => this.loadVehicles(),
            expenses: () => this.loadExpenses(),
            distribution: () => this.loadDistributionData(),
            sales: async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js');
                await this.loadSalesPOS();
            },
            'sales-history': () => this.loadSalesHistory(),
            'pre-orders': () => this.loadPreOrders(),
            'banking-cheques': () => this.loadBankingCheques(),
            reports: async () => {
                await Promise.all([
                    this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'),
                    this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
                    this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js')
                ]);
                this.initReportsView();
            },
            'customer-intelligence': async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
                this.initCustomerIntelligenceView();
            },
            'inventory-intelligence': async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
                this.initInventoryIntelligenceView();
            },
            'demand-forecast': async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
                this.initDemandForecastingView();
            },
            'report-center': async () => {
                await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
                this.initReportCenterView();
            },
            rma: () => this.loadRmaData(),
            'customer-map': async () => {
                await Promise.all([
                    this.loadStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
                    this.loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
                ]);
                this.loadCustomerMap();
            }
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

        const plOptions = (this.availablePriceLevels || []).map(pl =>
            `<option value="${pl.id}" ${data?.price_level_id == pl.id ? 'selected' : ''} data-name="${pl.name}">${pl.name}</option>`
        ).join('');

        row.innerHTML = `
            <div style="flex: 1.2;">
                <label style="font-size: 0.65rem; display: block; color: #666; margin-bottom: 2px;">Price Level</label>
                <select class="form-control price-level-select" style="margin-bottom: 0;">
                    <option value="">Custom/Other</option>
                    ${plOptions}
                </select>
                <input type="text" class="form-control price-label" placeholder="Custom Label" value="${data?.label || ''}" style="margin-top: 4px; display: ${data?.price_level_id ? 'none' : 'block'}; height: 26px; font-size: 0.75rem;">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 0.65rem; display: block; color: #666; margin-bottom: 2px;">MSRP (LKR)</label>
                <input type="number" class="form-control price-value" step="0.01" placeholder="Selling Price" value="${data?.price || ''}" style="margin-bottom: 0;" oninput="app.calculateProductCost()">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 0.65rem; display: block; color: #666; margin-bottom: 2px;">Supplier Disc (%)</label>
                <input type="number" class="form-control price-discount" step="0.01" placeholder="Disc %" value="${data?.supplier_discount || ''}" style="margin-bottom: 0;" oninput="app.calculateProductCost()">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 0.65rem; display: block; color: #666; margin-bottom: 2px;">Cost (LKR)</label>
                <input type="number" class="form-control price-cost" step="0.01" placeholder="Cost" title="Calculated Cost" value="${data?.cost || ''}" style="margin-bottom: 0; background: #f8fafc; font-weight: 600;" readonly>
            </div>
            <div style="flex: 0.8;">
                <label style="font-size: 0.65rem; display: block; color: #666; margin-bottom: 2px;">Batch #</label>
                <input type="text" class="form-control price-batch" placeholder="Batch" value="${data?.batch_number || ''}" style="margin-bottom: 0; padding: 4px 8px; font-size: 0.85rem;">
            </div>
            <div style="flex: 0.8; text-align: center;">
                <label style="font-size: 0.65rem; display: block; color: #666; margin-bottom: 2px;">Primary</label>
                <input type="radio" name="primary-price" class="price-primary" ${data?.is_primary || count === 0 ? 'checked' : ''} onchange="app.calculateProductCost()">
            </div>
            <div style="flex: 0.4;">
                <button type="button" class="btn btn-sm" onclick="this.closest('.price-row').remove(); app.calculateProductCost();" style="background: #fee2e2; color: #ef4444; border: none; padding: 5px 8px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.appendChild(row);

        // Add event listener for price level change
        const select = row.querySelector('.price-level-select');
        const labelInput = row.querySelector('.price-label');
        select.addEventListener('change', (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            if (e.target.value) {
                labelInput.style.display = 'none';
                labelInput.value = selectedOpt.dataset.name;
            } else {
                labelInput.style.display = 'block';
            }
        });
    }

    calculateProductCost() {
        const discountField = document.getElementById('p-discount');
        const costField = document.getElementById('p-cost');
        if (!costField) return;

        const globalDiscount = (discountField ? parseFloat(discountField.value) : 0) || 0;
        const priceRows = document.querySelectorAll('.price-row');
        let primaryCost = 0;
        let primaryMsrp = 0;
        let primaryDiscount = globalDiscount;

        priceRows.forEach(row => {
            const msrp = parseFloat(row.querySelector('.price-value').value) || 0;
            const rowDiscountInput = row.querySelector('.price-discount');
            let discount = rowDiscountInput ? parseFloat(rowDiscountInput.value) : globalDiscount;

            // If row discount is 0 and global is not, maybe use global?
            // Better to just use what's in the row, defaulting to 0 if not provided.
            if (rowDiscountInput && rowDiscountInput.value === "" && globalDiscount > 0) {
                discount = globalDiscount;
                rowDiscountInput.placeholder = globalDiscount + "%";
            }

            const cost = msrp * (1 - (discount / 100));
            const costInput = row.querySelector('.price-cost');
            if (costInput) costInput.value = cost.toFixed(2);

            const isPrimary = row.querySelector('.price-primary').checked;
            if (isPrimary) {
                primaryCost = cost;
                primaryMsrp = msrp;
                primaryDiscount = discount;
            }
        });

        // Update overall product cost/msrp/discount based on primary selection
        if (costField) costField.value = primaryCost.toFixed(2);
        const msrpField = document.getElementById('p-msrp');
        if (msrpField) msrpField.value = primaryMsrp.toFixed(2);
        if (discountField && primaryDiscount !== globalDiscount && primaryMsrp > 0) {
            // Only update global discount if we have a primary row with its own discount
            // Actually, keep them in sync if possible or just rely on primary row
            discountField.value = primaryDiscount.toFixed(2);
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

            const [sups, cats, brands, units, priceLevels] = await Promise.all([
                fetchJson('/api/suppliers'),
                fetchJson('/api/categories'),
                fetchJson('/api/brands'),
                fetchJson('/api/units'),
                fetchJson('/api/price-levels')
            ]);

            this.availablePriceLevels = priceLevels.data || [];

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

                const weightedEl = document.getElementById('p-weighted');
                if (weightedEl) weightedEl.checked = !!p.weighted;

                const allowFreeEl = document.getElementById('p-allow-free');
                if (allowFreeEl) allowFreeEl.checked = p.allow_free_issue !== 0;

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
                const allowFreeEl = document.getElementById('p-allow-free');
                if (allowFreeEl) allowFreeEl.checked = true;
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
            const discount = parseFloat(row.querySelector('.price-discount').value) || 0;
            const cost = parseFloat(row.querySelector('.price-cost').value) || 0;
            const isPrimary = row.querySelector('.price-primary').checked;
            const priceLevelId = row.querySelector('.price-level-select').value || null;
            const batchNumber = row.querySelector('.price-batch').value || null;

            if (label || price) {
                prices.push({
                    label,
                    batch_number: batchNumber,
                    price,
                    supplier_discount: discount,
                    cost,
                    price_level_id: priceLevelId,
                    is_primary: isPrimary
                });
                if (isPrimary) {
                    primaryMsrp = price;
                }
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
            weighted: document.getElementById('p-weighted').checked,
            allow_free_issue: document.getElementById('p-allow-free').checked
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

                // Refresh truck stock if in POS view and a load is selected
                if (this.currentView === 'sales' && this.posState.selectedLoadId) {
                    this.loadTruckStock(this.posState.selectedLoadId);
                }

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
        this._currentLedgerCustomerId = customerId;
        this._currentLedgerCustomer = null;
        this._fullLedgerData = [];

        // Reset filter controls
        const filterMode = document.getElementById('ledger-filter-mode');
        const monthGroup = document.getElementById('ledger-month-group');
        const rangeGroup = document.getElementById('ledger-range-group');
        const sortMode = document.getElementById('ledger-sort-mode');
        if (filterMode) filterMode.value = 'all';
        if (monthGroup) monthGroup.style.display = 'none';
        if (rangeGroup) rangeGroup.style.display = 'none';
        if (sortMode) sortMode.value = 'date-asc';
        const fMonth = document.getElementById('ledger-filter-month');
        const fFrom = document.getElementById('ledger-filter-from');
        const fTo = document.getElementById('ledger-filter-to');
        if (fMonth) fMonth.value = '';
        if (fFrom) fFrom.value = '';
        if (fTo) fTo.value = '';

        // Only open the modal once data actually loaded, otherwise it would
        // display the previously viewed customer's ledger.
        const loaded = await this._fetchAndRenderLedger(customerId);
        if (!loaded) {
            this.showNotification('Failed to load customer ledger', 'error');
            return;
        }
        document.getElementById('ledger-modal').classList.add('active');
    }

    async _fetchAndRenderLedger(customerId, dateFrom, dateTo) {
        let url = `/api/customers/${customerId}/ledger`;
        const qp = [];
        if (dateFrom) qp.push(`dateFrom=${encodeURIComponent(dateFrom)}`);
        if (dateTo) qp.push(`dateTo=${encodeURIComponent(dateTo)}`);
        if (qp.length > 0) url += '?' + qp.join('&');

        const res = await this.apiCall(url);
        if (!res) return false;
        const result = await res.json();
        if (!result.success) return false;

        const { customer, ledger, openingBalance } = result.data;
        this._currentLedgerCustomer = customer;
        this._fullLedgerData = ledger;
        this._ledgerOpeningBalance = dateFrom ? (parseFloat(openingBalance) || 0) : 0;
        this._ledgerFilterActive = !!dateFrom;

        document.getElementById('ledger-customer-info').textContent = `${customer.name} | ${customer.contact || 'No Contact'}`;

        const genDateEl = document.getElementById('ledger-generated-date');
        if (genDateEl) genDateEl.textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        this.renderLedgerTable(ledger, customer);
        return true;
    }

    renderLedgerTable(ledger, customer) {
        const openingBalance = this._ledgerOpeningBalance || 0;

        // Compute each entry's running balance in CHRONOLOGICAL order first,
        // so the balance column stays historically correct no matter which
        // display sort is selected.
        const chrono = [...ledger].sort((a, b) => new Date(a.date) - new Date(b.date));
        const balances = new Map();
        let runningBalance = openingBalance;
        let totalSales = 0;
        let totalPaid = 0;
        chrono.forEach(entry => {
            runningBalance += ((entry.debit || 0) - (entry.credit || 0));
            totalSales += (entry.debit || 0);
            totalPaid += (entry.credit || 0);
            balances.set(entry, runningBalance);
        });
        const finalBalance = runningBalance;

        // Display sort
        const sortMode = document.getElementById('ledger-sort-mode')?.value || 'date-asc';
        const sorted = [...ledger];
        switch (sortMode) {
            case 'date-asc': sorted.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
            case 'date-desc': sorted.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
            case 'amount-desc': sorted.sort((a, b) => ((b.debit||0)+(b.credit||0)) - ((a.debit||0)+(a.credit||0))); break;
            case 'amount-asc': sorted.sort((a, b) => ((a.debit||0)+(a.credit||0)) - ((b.debit||0)+(b.credit||0))); break;
        }

        const typeBadge = (type) => {
            if (!type) return '';
            const t = type.toLowerCase();
            if (t.includes('partial')) return `<span style="background:#ede9fe;color:#6d28d9;padding:2px 7px;border-radius:3px;font-size:0.65rem;font-weight:800;text-transform:uppercase;">Partial</span>`;
            if (t.includes('invoice')) return `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:3px;font-size:0.65rem;font-weight:800;text-transform:uppercase;">Invoice</span>`;
            if (t.includes('credit note') || t.includes('rma')) return `<span style="background:#fef3c7;color:#d97706;padding:2px 7px;border-radius:3px;font-size:0.65rem;font-weight:800;text-transform:uppercase;">Credit Note</span>`;
            if (t.includes('receipt')) return `<span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:3px;font-size:0.65rem;font-weight:800;text-transform:uppercase;">Receipt</span>`;
            if (t.includes('cheque') || t.includes('returned')) return `<span style="background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:3px;font-size:0.65rem;font-weight:800;text-transform:uppercase;">Returned Chq</span>`;
            return `<span style="background:#f3f4f6;color:#374151;padding:2px 7px;border-radius:3px;font-size:0.65rem;font-weight:800;text-transform:uppercase;">${type}</span>`;
        };

        const rows = sorted.map(entry => {
            const entryBalance = balances.get(entry);

            const debitCell = entry.debit > 0
                ? `<span style="color:#dc2626;font-weight:700;">${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>`
                : `<span style="color:#d1d5db;">—</span>`;

            const creditCell = entry.credit > 0
                ? `<span style="color:#16a34a;font-weight:700;">${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>`
                : `<span style="color:#d1d5db;">—</span>`;

            const balColor = entryBalance > 0 ? '#dc2626' : '#16a34a';

            return `
                <tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding: 9px 12px; font-size:0.77rem;">${new Date(entry.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</td>
                    <td style="padding: 9px 12px;"><span style="font-family: monospace; font-weight: 700; font-size:0.8rem; color: #065f46;">${entry.reference}</span></td>
                    <td style="padding: 9px 12px;">${typeBadge(entry.type)}</td>
                    <td style="padding: 9px 12px; text-align:right;">${debitCell}</td>
                    <td style="padding: 9px 12px; text-align:right;">${creditCell}</td>
                    <td style="padding: 9px 12px; text-align:right; font-weight: 800; font-size:0.82rem; color:${balColor};">
                        ${entryBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                </tr>
            `;
        });

        // Opening balance carried forward (shown when a from-date filter is active)
        if (this._ledgerFilterActive) {
            const obColor = openingBalance > 0 ? '#dc2626' : '#16a34a';
            rows.unshift(`
                <tr style="border-bottom:1px solid #f3f4f6; background:#f8fafc;">
                    <td style="padding: 9px 12px; font-size:0.77rem;" colspan="3"><em style="color:#64748b; font-weight:600;">Opening Balance b/f</em></td>
                    <td style="padding: 9px 12px;"></td>
                    <td style="padding: 9px 12px;"></td>
                    <td style="padding: 9px 12px; text-align:right; font-weight: 800; font-size:0.82rem; color:${obColor};">
                        ${openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                </tr>
            `);
        }

        document.getElementById('ledger-body').innerHTML = rows.join('') || '<tr><td colspan="6" class="text-center" style="padding: 30px; color: #999;">No transactions found for the selected period</td></tr>';

        // Populate Summary Cards (balance includes any opening balance b/f)
        document.getElementById('ledger-sum-sales').textContent = `LKR ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        document.getElementById('ledger-sum-paid').textContent = `LKR ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        document.getElementById('ledger-sum-balance').textContent = `LKR ${Math.abs(finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        // Balance indicator banner
        const indicator = document.getElementById('ledger-balance-indicator');
        if (indicator) {
            if (finalBalance > 0) {
                indicator.style.cssText = 'display:flex; margin:0 16px 12px 16px; padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; font-size:0.8rem; font-weight:600; align-items:center; gap:8px;';
                indicator.innerHTML = `<i class="fas fa-exclamation-circle" style="color:#ef4444;"></i> Outstanding balance of <strong style="color:#dc2626; margin: 0 4px;">LKR ${Math.abs(finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> is payable to the company.`;
            } else if (finalBalance < 0) {
                indicator.style.cssText = 'display:flex; margin:0 16px 12px 16px; padding:10px 14px; border-radius:8px; background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #3b82f6; font-size:0.8rem; font-weight:600; align-items:center; gap:8px;';
                indicator.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> Account is in credit by <strong style="color:#2563eb; margin: 0 4px;">LKR ${Math.abs(finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>.`;
            } else {
                indicator.style.cssText = 'display:flex; margin:0 16px 12px 16px; padding:10px 14px; border-radius:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-left:4px solid #22c55e; font-size:0.8rem; font-weight:600; align-items:center; gap:8px;';
                indicator.innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e;"></i> Account is <strong style="color:#16a34a; margin: 0 4px;">fully settled</strong> with no outstanding balance.`;
            }
        }
    }

    // ===== Ledger Filter Helpers =====
    toggleLedgerFilterMode() {
        const mode = document.getElementById('ledger-filter-mode')?.value || 'all';
        const monthGroup = document.getElementById('ledger-month-group');
        const rangeGroup = document.getElementById('ledger-range-group');
        if (monthGroup) monthGroup.style.display = mode === 'month' ? 'flex' : 'none';
        if (rangeGroup) rangeGroup.style.display = mode === 'range' ? 'flex' : 'none';
    }

    getLedgerFilterDates() {
        const mode = document.getElementById('ledger-filter-mode')?.value || 'all';
        let dateFrom = null, dateTo = null;

        if (mode === 'month') {
            const monthVal = document.getElementById('ledger-filter-month')?.value;
            if (monthVal) {
                const [y, m] = monthVal.split('-').map(Number);
                dateFrom = `${y}-${String(m).padStart(2, '0')}-01`;
                const lastDay = new Date(y, m, 0).getDate();
                dateTo = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }
        } else if (mode === 'range') {
            dateFrom = document.getElementById('ledger-filter-from')?.value || null;
            dateTo = document.getElementById('ledger-filter-to')?.value || null;
        }

        return { dateFrom, dateTo };
    }

    async applyLedgerFilter() {
        if (!this._currentLedgerCustomerId) return;
        const { dateFrom, dateTo } = this.getLedgerFilterDates();
        await this._fetchAndRenderLedger(this._currentLedgerCustomerId, dateFrom, dateTo);
    }

    // Sorting is purely cosmetic: re-render from the cached dataset instead
    // of re-running the ledger query on the server.
    resortLedger() {
        if (!this._currentLedgerCustomer) return;
        this.renderLedgerTable(this._fullLedgerData, this._currentLedgerCustomer);
    }

    async resetLedgerFilter() {
        if (!this._currentLedgerCustomerId) return;
        const filterMode = document.getElementById('ledger-filter-mode');
        const sortMode = document.getElementById('ledger-sort-mode');
        if (filterMode) filterMode.value = 'all';
        if (sortMode) sortMode.value = 'date-asc';
        this.toggleLedgerFilterMode();
        const fMonth = document.getElementById('ledger-filter-month');
        const fFrom = document.getElementById('ledger-filter-from');
        const fTo = document.getElementById('ledger-filter-to');
        if (fMonth) fMonth.value = '';
        if (fFrom) fFrom.value = '';
        if (fTo) fTo.value = '';
        await this._fetchAndRenderLedger(this._currentLedgerCustomerId);
    }


    // --- GRN LOGIC ---
    async loadGrnData() {
        // Implement logic to fetch and display GRN list
        // For MVP, just show placeholder or fetch empty list
        const searchVal = document.getElementById('grn-search')?.value || '';
        const limit = document.getElementById('grn-limit')?.value || 20;
        const page = this.grnPage || 1;

        // Construct URL with query params
        // let url = `/api/grn?page=${page}&limit=${limit}`; 
        // if (searchVal) url += `&search=${searchVal}`;

        // const res = await this.apiCall(url);
        // const data = await res.json();
        // ... Render table rows ...
        console.log('Loading GRN Data... (Not fully implemented)');

        // --- Temporary Placeholder ---
        const tbody = document.getElementById('grn-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center">No GRN records found (Endpoint pending)</td></tr>`;
    }

    changeGrnPage(delta) {
        this.grnPage = (this.grnPage || 1) + delta;
        if (this.grnPage < 1) this.grnPage = 1;
        this.loadGrnData();
    }

    async openGrnModal() {
        const modal = document.getElementById('grn-modal');
        const form = document.getElementById('grn-form');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('grn-items-body').innerHTML = '';
        document.getElementById('grn-total-amount').textContent = 'LKR 0.00';

        // Set today's date
        document.getElementById('grn-date').valueAsDate = new Date();

        // Load Suppliers
        const supSelect = document.getElementById('grn-supplier');
        if (supSelect) {
            supSelect.innerHTML = '<option value="">Loading...</option>';
            const res = await this.apiCall('/api/suppliers'); // Assuming this endpoint returns all for dropdown
            if (res && res.ok) {
                const data = await res.json();
                if (data.success) {
                    supSelect.innerHTML = '<option value="">Select Supplier</option>' +
                        data.data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                }
            }
        }

        modal.classList.add('active');
    }

    async searchGrnProducts(query) {
        const resultsDiv = document.getElementById('grn-search-results');
        if (!query || query.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        // Reuse product search API
        const res = await this.apiCall(`/api/products?search=${encodeURIComponent(query)}&limit=10`);
        if (!res) return;
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            resultsDiv.innerHTML = data.data.map(p => `
                <div class="search-result-item" onclick='app.addGrnItem(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
                    <div style="font-weight:600;">${p.name}</div>
                    <div style="font-size:0.8rem; color:#666;">Code: ${p.reference_code || '-'} | Stock: ${p.stock_quantity || 0}</div>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.style.display = 'none';
        }
    }

    addGrnItem(product) {
        const tbody = document.getElementById('grn-items-body');
        const rowId = 'grn-row-' + Date.now();

        const tr = document.createElement('tr');
        tr.id = rowId;
        tr.innerHTML = `
            <td>
                <div style="font-weight:600;">${product.name}</div>
                <input type="hidden" class="grn-item-id" value="${product.id}">
            </td>
            <td>
                <input type="number" class="form-control grn-cost" style="margin-bottom:0; width:100px;" 
                    value="${product.cost || 0}" step="0.01" oninput="app.calcGrnRowTotal('${rowId}')">
            </td>
            <td>
                <input type="number" class="form-control grn-qty" style="margin-bottom:0; width:100px;" 
                    value="1" min="1" oninput="app.calcGrnRowTotal('${rowId}')">
            </td>
            <td>
                <div class="grn-row-total" style="font-weight:600;">${(product.cost || 0).toFixed(2)}</div>
            </td>
            <td>
                <input type="date" class="form-control grn-expiry" style="margin-bottom:0; width:130px;">
            </td>
            <td>
                <button type="button" class="btn-icon btn-delete" onclick="this.closest('tr').remove(); app.calcGrnTotal();">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        document.getElementById('grn-search-results').style.display = 'none';
        document.getElementById('grn-product-search').value = '';
        this.calcGrnTotal();
    }

    calcGrnRowTotal(rowId) {
        const row = document.getElementById(rowId);
        const cost = parseFloat(row.querySelector('.grn-cost').value) || 0;
        const qty = parseFloat(row.querySelector('.grn-qty').value) || 0;
        row.querySelector('.grn-row-total').textContent = (cost * qty).toFixed(2);
        this.calcGrnTotal();
    }

    calcGrnTotal() {
        let total = 0;
        document.querySelectorAll('#grn-items-body tr').forEach(row => {
            const cost = parseFloat(row.querySelector('.grn-cost').value) || 0;
            const qty = parseFloat(row.querySelector('.grn-qty').value) || 0;
            total += (cost * qty);
        });
        document.getElementById('grn-total-amount').textContent = 'LKR ' + total.toLocaleString(undefined, { minimumFractionDigits: 2 });
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
                                ${this.hasPermission('customers', 'edit') ? `<button class="btn btn-secondary btn-sm" style="background:#f59e0b; color:white;" onclick="app.syncCustomerBalance(${c.id}, this)" title="Recalculate balance from actual transactions"><i class="fas fa-sync-alt"></i></button>` : ''}
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

    async syncCustomerBalance(id, btn) {
        // Visual feedback
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await this.apiCall(`/api/customers/${id}/reconcile-balance`, { method: 'POST' });
            if (!res) throw new Error('No response');
            const data = await res.json();
            if (data.success) {
                const fmt = (n) => parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
                this.showNotification(`✅ Balance synced → LKR ${fmt(data.data.trueBalance)}`, 'success');
                this.loadCustomers();
            } else {
                throw new Error(data.error || 'Sync failed');
            }
        } catch (err) {
            this.showNotification('Sync failed: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = original;
        }
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

            // 2. Try loading routes and price levels (Don't crash if this fails)
            try {
                const routeSelect = document.getElementById('c-route');
                const plSelect = document.getElementById('c-price-level');

                const [routeRes, plRes] = await Promise.all([
                    this.apiCall('/api/master/routes'),
                    this.apiCall('/api/price-levels')
                ]);

                if (routeSelect && routeRes) {
                    const routeData = await routeRes.json();
                    if (routeData.success && Array.isArray(routeData.data)) {
                        routeSelect.innerHTML = '<option value="">Select Route</option>' +
                            routeData.data.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
                    }
                }

                if (plSelect && plRes) {
                    const plData = await plRes.json();
                    if (plData.success && Array.isArray(plData.data)) {
                        plSelect.innerHTML = '<option value="">Select Price Level (Default)</option>' +
                            plData.data.map(pl => `<option value="${pl.id}">${pl.name}</option>`).join('');
                    }
                }
            } catch (routeErr) {
                console.error('Could not load dropdown data:', routeErr);
            }

            // 3. Populate fields
            if (c) {
                const status = c.status || 'active';
                const fields = {
                    'c-name': c.name,
                    'c-address': c.address || '',
                    'c-contact': c.contact || '',
                    'c-email': c.email || '',
                    'c-category': c.category || 'Retailer',
                    'c-route': c.route_id || '',
                    'c-price-level': c.price_level_id || '',
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
            email: document.getElementById('c-email').value,
            category: document.getElementById('c-category').value,
            route_id: document.getElementById('c-route').value,
            price_level_id: document.getElementById('c-price-level').value || null,
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

    async loadRoutes() {
        const search = document.getElementById('route-search')?.value || '';
        let url = `/api/master/routes?1=1`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        try {
            const res = await this.apiCall(url);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const container = document.getElementById('route-grid-container');
                if (container) {
                    if (data.data.length === 0) {
                        container.innerHTML = `
                            <div style="grid-column: 1/-1; padding: 5rem; text-align: center; color: var(--gray-400);">
                                <i class="fas fa-map-marked" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                                <p>No delivery routes found. Add a new route to get started.</p>
                            </div>
                        `;
                    } else {
                        container.innerHTML = data.data.map(r => `
                            <div class="log-card" style="min-height: 200px;">
                                <div class="status-strip" style="background: var(--primary-green);"></div>
                                <div class="log-card-header">
                                    <div class="log-customer-info">
                                        <div class="log-customer-name">${r.name}</div>
                                        <div class="log-date" style="color: var(--primary-green); font-weight: 700;">
                                            <i class="fas fa-users"></i> ${r.customer_count} Customers
                                        </div>
                                    </div>
                                    <div class="log-status-badge" style="background: rgba(46, 125, 50, 0.1); color: var(--primary-green);">
                                        <i class="fas fa-route"></i> ROUTE
                                    </div>
                                </div>
                                <div class="log-remarks" style="background: #fff; border: none; padding: 0; font-size: 0.85rem; color: var(--gray-600);">
                                    ${r.description || '<span style="opacity: 0.5;">No description provided.</span>'}
                                </div>
                                <div class="log-footer" style="border-top: 1px solid #f8fafc; padding-top: 1rem; margin-top: 1rem;">
                                    <div class="log-user">
                                        <i class="fas fa-barcode" style="color: var(--gray-300);"></i>
                                        <span style="font-size: 0.7rem; color: var(--gray-400); font-family: monospace;">RID-${r.id.toString().padStart(4, '0')}</span>
                                    </div>
                                    <div class="action-btns">
                                        ${this.hasPermission('routes', 'edit') ? `<button class="btn-icon btn-edit" title="Edit Route" onclick="app.openRouteModal(${JSON.stringify(r).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>` : ''}
                                        ${this.hasPermission('routes', 'delete') ? `<button class="btn-icon btn-delete" title="Delete Route" onclick="app.handleDelete('routes', ${r.id}, '${r.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('');

                        // GSAP Animation
                        if (window.gsap) {
                            gsap.from("#route-grid-container .log-card", {
                                duration: 0.5,
                                opacity: 0,
                                y: 20,
                                stagger: 0.05,
                                ease: "power2.out"
                            });
                        }
                    }
                }

                // Update Stats
                this.updateRouteStats(data.data);
            }
        } catch (err) {
            console.error('LoadRoutes Error:', err);
        }
    }

    updateRouteStats(routes) {
        const totalCustomers = routes.reduce((sum, r) => sum + (r.customer_count || 0), 0);
        const topRoute = routes.length > 0 ? routes.reduce((prev, current) => (prev.customer_count > current.customer_count) ? prev : current) : null;

        const totalEl = document.getElementById('route-stat-total');
        const custEl = document.getElementById('route-stat-customers');
        const topEl = document.getElementById('route-stat-top');

        if (totalEl) totalEl.textContent = routes.length;
        if (custEl) custEl.textContent = totalCustomers;
        if (topEl) topEl.textContent = topRoute ? `${topRoute.name} (${topRoute.customer_count})` : 'N/A';
    }

    openRouteModal(r = null) {
        const form = document.getElementById('route-form');
        form.reset();

        document.getElementById('route-id').value = r?.id || '';
        document.getElementById('route-modal-title').textContent = r ? 'Edit Route Path' : 'Create New Route';
        document.getElementById('route-name').value = r?.name || '';
        document.getElementById('route-description').value = r?.description || '';

        const modal = document.getElementById('route-modal');
        modal.classList.add('active');
        if (modal.style.display === 'none' || !modal.style.display) modal.style.display = 'flex';
    }

    async handleRouteSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('route-id').value;
        const d = {
            name: document.getElementById('route-name').value,
            description: document.getElementById('route-description').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/master/routes/${id}` : '/api/master/routes';

        try {
            const res = await this.apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(d)
            });
            if (!res) return;
            const resData = await res.json();
            if (resData.success) {
                this.showNotification(id ? 'Route Updated' : 'Route Created');
                document.getElementById('route-modal').classList.remove('active');
                this.loadRoutes();
            } else {
                this.showNotification(resData.error || 'Operation failed', 'error');
            }
        } catch (err) {
            this.showNotification('Error saving route', 'error');
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
                    'routes': 'Route',
                    'price-levels': 'Price Level'
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
            'routes': 'Route',
            'price-levels': 'Price Level'
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

    showResetConfirmation() {
        // Generate a random code: 3 groups of 3 digits or just RESET-XXXX
        // Let's stick to the new UI style: A simple 4-digit or 6-digit pin? 
        // The HTML indicates "RESET-0000" style. Let's make it random alphanumeric 
        // or just keep it simple "RESET-" + 4 digits.
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const code = 'RESET-' + suffix;
        this.resetCode = code;

        document.getElementById('reset-code-display').textContent = code;
        const input = document.getElementById('reset-confirmation-input');
        input.value = '';
        input.focus();

        document.getElementById('final-reset-btn').disabled = true;

        // Hide initial button with fade
        const initialAction = document.getElementById('initial-reset-action');
        initialAction.style.opacity = '0';
        initialAction.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            initialAction.style.display = 'none';

            // Show confirmation with animation
            const confirmStep = document.getElementById('danger-confirmation-step');
            confirmStep.style.display = 'block';
            // Force reflow
            void confirmStep.offsetWidth;
            confirmStep.style.opacity = '1';
            confirmStep.style.transform = 'translateY(0)';
        }, 300);
    }

    cancelReset() {
        const confirmStep = document.getElementById('danger-confirmation-step');
        confirmStep.style.opacity = '0';
        confirmStep.style.transform = 'translateY(20px)';

        setTimeout(() => {
            confirmStep.style.display = 'none';

            const initialAction = document.getElementById('initial-reset-action');
            initialAction.style.display = 'block';
            void initialAction.offsetWidth;
            initialAction.style.opacity = '1';
            initialAction.style.transform = 'translateY(0)';
        }, 300);
    }

    validateResetCode(val) {
        const btn = document.getElementById('final-reset-btn');
        if (val.trim().toUpperCase() === this.resetCode) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    }

    cancelReset() {
        document.getElementById('initial-reset-action').style.display = 'block';
        document.getElementById('danger-confirmation-step').style.display = 'none';
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
    async loadSettings(skipTabSwitch = false) {
        const timeoutInput = document.getElementById('setting-timeout');
        const enabledInput = document.getElementById('setting-timer-enabled');

        // Check if user is admin
        const userRole = this.currentUser?.role?.toLowerCase();
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        // Load local user settings
        const timeout = localStorage.getItem('session_timeout') || '10';
        const enabled = localStorage.getItem('timer_enabled') !== 'false';
        const fontSize = localStorage.getItem('system_font_size') || '100';

        if (timeoutInput) timeoutInput.value = timeout;
        if (enabledInput) enabledInput.checked = enabled;
        if (timeoutInput) timeoutInput.disabled = !enabled;

        const fsInput = document.getElementById('setting-font-size');
        const fsLabel = document.getElementById('font-size-label');
        if (fsInput) fsInput.value = fontSize;
        if (fsLabel) fsLabel.textContent = `${fontSize}%`;

        if (isAdmin) {
            // Add admin notice for timer if not present
            const settingsContainer = document.getElementById('settings-view');
            if (settingsContainer && !document.getElementById('admin-timer-notice')) {
                const notice = document.createElement('div');
                notice.id = 'admin-timer-notice';
                notice.className = 'admin-notice';
                notice.style = "background: #fdf2f8; border: 1px solid #fce7f3; color: #db2777; padding: 1rem; border-radius: 16px; margin-bottom: 2rem; display: flex; align-items: center; gap: 12px; font-weight: 500;";
                notice.innerHTML = '<i class="fas fa-crown" style="font-size: 1.2rem;"></i><span><strong>Administrator Privilege:</strong> Session timeout is automatically disabled for your account. You have unlimited session duration.</span>';
                const mainContent = settingsContainer.querySelector('.settings-main');
                if (mainContent) mainContent.prepend(notice);
            }

            // Show Admin Sidebar Links
            const companyLink = document.getElementById('nav-link-company');
            const dataLink = document.getElementById('nav-link-data');
            if (companyLink) companyLink.style.display = 'flex';
            if (dataLink) dataLink.style.display = 'flex';

            // Load Company Details
            await this.loadCompanyDetails();
        }

        // Load Notification Settings
        try {
            const res = await this.apiCall('/api/settings');
            const data = await res.json();
            if (data.success) {
                const settings = data.settings;

                // Email
                this.setCheckboxValue('setting-email-enabled', settings.email_enabled);
                this.setInputValue('setting-email-host', settings.email_host);
                this.setInputValue('setting-email-port', settings.email_port);
                this.setInputValue('setting-email-user', settings.email_user);
                this.setInputValue('setting-email-pass', settings.email_pass);
                this.setInputValue('setting-email-from', settings.email_from);

                // SMS
                this.setCheckboxValue('setting-sms-enabled', settings.sms_enabled);
                this.setInputValue('setting-sms-provider', settings.sms_provider);
                this.setInputValue('setting-sms-api-key', settings.sms_api_key);
                this.setInputValue('setting-sms-twilio-sid', settings.sms_twilio_sid);
                this.setInputValue('setting-sms-twilio-token', settings.sms_twilio_token);
                this.setInputValue('setting-sms-twilio-from', settings.sms_twilio_from);

                // Trigger dynamic field toggle
                this.toggleSmsProviderFields();

                // Triggers
                this.setCheckboxValue('setting-notify-invoice', settings.notify_invoice);
                this.setCheckboxValue('setting-notify-receipt', settings.notify_receipt);
                this.setCheckboxValue('setting-notify-rma', settings.notify_rma);

                // Load extra company details if they were in the main settings
                if (isAdmin && settings.invoice_template) {
                    this.selectInvoiceTemplate(settings.invoice_template);
                }
            }
        } catch (err) {
            console.error('Error loading notification settings:', err);
        }

        // Default to General Tab only if not skipping
        if (!skipTabSwitch) {
            this.switchSettingsTab('general');
        }
    }
    setCheckboxValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.checked = val === 'true' || val === true;
    }

    setInputValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }

    async saveNotificationSettings() {
        try {
            const settings = {
                email_enabled: document.getElementById('setting-email-enabled')?.checked.toString(),
                email_host: document.getElementById('setting-email-host')?.value,
                email_port: document.getElementById('setting-email-port')?.value,
                email_user: document.getElementById('setting-email-user')?.value,
                email_pass: document.getElementById('setting-email-pass')?.value,
                email_from: document.getElementById('setting-email-from')?.value,
                sms_enabled: document.getElementById('setting-sms-enabled')?.checked.toString(),
                sms_provider: document.getElementById('setting-sms-provider')?.value,
                sms_api_key: document.getElementById('setting-sms-api-key')?.value,
                sms_twilio_sid: document.getElementById('setting-sms-twilio-sid')?.value,
                sms_twilio_token: document.getElementById('setting-sms-twilio-token')?.value,
                sms_twilio_from: document.getElementById('setting-sms-twilio-from')?.value,
                notify_invoice: document.getElementById('setting-notify-invoice')?.checked.toString(),
                notify_receipt: document.getElementById('setting-notify-receipt')?.checked.toString(),
                notify_rma: document.getElementById('setting-notify-rma')?.checked.toString()
            };

            const res = await this.apiCall('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });

            const data = await res.json();
            if (data.success) {
                this.showNotification('Notification preferences saved', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            this.showNotification('Error saving: ' + err.message, 'error');
        }
    }

    async testEmailConfig() {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Testing...';

        try {
            const config = {
                host: document.getElementById('setting-email-host').value,
                port: document.getElementById('setting-email-port').value,
                user: document.getElementById('setting-email-user').value,
                pass: document.getElementById('setting-email-pass').value
            };

            const res = await this.apiCall('/api/settings/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const data = await res.json();
            if (data.success) {
                this.showNotification('Email test successful!', 'success');
            } else {
                this.showNotification('Email test failed: ' + data.message, 'error');
            }
        } catch (err) {
            this.showNotification('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    toggleSmsProviderFields() {
        const provider = document.getElementById('setting-sms-provider')?.value;
        const twilioFields = document.getElementById('sms-twilio-fields');
        const genericFields = document.getElementById('sms-generic-fields');
        const keyLabel = document.getElementById('sms-key-label');

        if (!twilioFields || !genericFields) return;

        if (provider === 'twilio') {
            twilioFields.style.display = 'grid';
            genericFields.style.display = 'none';
        } else {
            twilioFields.style.display = 'none';
            genericFields.style.display = 'grid';
            if (keyLabel) {
                keyLabel.textContent = (provider === 'textbelt') ? 'Textbelt API Key' : 'Full Webhook Endpoint URL';
            }
        }
    }

    async testSmsConfig() {
        const phone = prompt('Enter recipient phone number for test (with +country code):');
        if (!phone) return;

        const btn = event.target;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Transmitting...';

        // Auto-save settings first
        await this.saveNotificationSettings();

        try {
            const res = await this.apiCall('/api/settings/test-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('SMS dispatched successfully!', 'success');
            } else {
                throw new Error(data.message || 'Check connection or tokens');
            }
        } catch (err) {
            this.showNotification('SMS Test Failed: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
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



    selectInvoiceTemplate(template) {
        // Update hidden field if it exists
        const sel = document.getElementById('comp-invoice-template');
        if (sel) sel.value = template;

        // Update visuals
        document.querySelectorAll('.invoice-card').forEach(card => {
            if (card.getAttribute('onclick').includes(`'${template}'`) || card.dataset.template === template) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        // Toggle Custom Config Panel
        const configPanel = document.getElementById('custom-template-config');
        if (configPanel) {
            configPanel.style.display = (template === 'custom') ? 'block' : 'none';
        }
    }
    updateCustomConfig() {
        const getColorVal = () => document.getElementById('cfg-color')?.value || '#000000';
        const getFontVal = () => document.getElementById('cfg-font')?.value || 'Inter, sans-serif';

        const config = {
            color: getColorVal(),
            font: getFontVal(),
            header: getHeaderVal(),
            showLogo: getLogoChecked(),
            showFooter: getFooterChecked()
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
                color: document.getElementById('cfg-color')?.value || '#2E7D32',
                font: document.getElementById('cfg-font')?.value || 'Inter, sans-serif',
                header: document.getElementById('cfg-header')?.value || 'left',
                showLogo: document.getElementById('cfg-show-logo')?.checked !== false,
                showFooter: document.getElementById('cfg-show-footer')?.checked !== false
            };
            const encoded = encodeURIComponent(JSON.stringify(config));
            url += `&customConfig=${encoded}`;
        }

        window.open(url, '_blank', 'width=900,height=1200');
    }

    switchSettingsTab(tabName, event) {
        if (event) event.preventDefault();

        // Hide all tabs
        document.querySelectorAll('.settings-section-card').forEach(el => el.classList.remove('active'));
        // Deselect all links
        document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));

        // Show selected tab
        const target = document.getElementById('tab-settings-' + tabName);
        if (target) {
            target.classList.add('active');
        }

        // Activate link
        const links = document.querySelectorAll('.settings-nav-item');
        links.forEach(link => {
            if (link.getAttribute('onclick')?.includes(`'${tabName}'`)) {
                link.classList.add('active');
            }
        });

        if (tabName === 'backup') {
            this.loadBackupSettings();
            this.loadBackups();
        }
        if (tabName === 'notifications') {
            this.loadSettings(true); // Skip switching back to general
        }
    }
    async handleDataReset() {
        // UI has already handled confirmation code
        if (document.getElementById('final-reset-btn').disabled) return;

        try {
            const btn = document.getElementById('final-reset-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> INCINERATING DATA...';
            btn.disabled = true;

            this.showNotification('Initiating System Destruction Sequence...', 'info');

            // Artificial delay for dramatic effect (and to let users see the state)
            await new Promise(r => setTimeout(r, 1500));

            const res = await this.apiCall('/api/settings/reset-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res) {
                const data = await res.json();
                if (data.success) {
                    this.showNotification('SYSTEM WIPE COMPLETE. TERMINATING SESSION.', 'success');
                    btn.innerHTML = '<i class="fas fa-check"></i> DESTRUCTION COMPLETE';
                    btn.style.background = '#10b981'; // Green

                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    this.showNotification(data.error || 'Reset failed', 'error');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Error during reset protocol', 'error');
            document.getElementById('final-reset-btn').disabled = false;
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
        // Filters changed: go back to page 1. The page is committed only on
        // success so a failed request can't desync the counter.
        const ok = await this.loadPaymentsPage(1, { scroll: false });
        if (ok) this.paymentPage = 1;
    }

    // Debounced variant for the search box so each keystroke doesn't fire
    // its own pair of DB queries.
    debouncedLoadPayments() {
        if (this._paymentSearchTimer) clearTimeout(this._paymentSearchTimer);
        this._paymentSearchTimer = setTimeout(() => this.loadPayments(), 300);
    }

    updatePaymentPaginationControls(pagination) {
        const paginationContainer = document.getElementById('payment-pagination');
        const prevBtn = document.getElementById('btn-prev-page');
        const nextBtn = document.getElementById('btn-next-page');
        const pageInput = document.getElementById('payment-page-input');
        const totalPagesSpan = document.getElementById('payment-total-pages');
        const recordCountSpan = document.getElementById('payment-record-count');

        if (paginationContainer) {
            // Show pagination only if there are multiple pages
            paginationContainer.style.display = pagination.totalPages > 1 ? 'flex' : 'none';

            if (prevBtn) prevBtn.disabled = !pagination.hasPrev;
            if (nextBtn) nextBtn.disabled = !pagination.hasNext;
            if (pageInput) {
                pageInput.value = pagination.page;
                pageInput.max = pagination.totalPages;
            }
            if (totalPagesSpan) totalPagesSpan.textContent = `of ${pagination.totalPages}`;
            if (recordCountSpan) {
                const start = (pagination.page - 1) * pagination.limit + 1;
                const end = Math.min(pagination.page * pagination.limit, pagination.total);
                recordCountSpan.textContent = `Showing ${start}-${end} of ${pagination.total} records`;
            }
        }
    }

    async nextPaymentPage() {
        if (this.paymentPage < this.paymentTotalPages) {
            // Commit the page only after a successful load so a failed
            // request can't drift the counter away from what's displayed.
            const ok = await this.loadPaymentsPage(this.paymentPage + 1);
            if (ok) this.paymentPage++;
        }
    }

    async prevPaymentPage() {
        if (this.paymentPage > 1) {
            const ok = await this.loadPaymentsPage(this.paymentPage - 1);
            if (ok) this.paymentPage--;
        }
    }

    async goToPaymentPage() {
        const pageInput = document.getElementById('payment-page-input');
        const page = parseInt(pageInput.value) || 1;
        if (page >= 1 && page <= this.paymentTotalPages) {
            const ok = await this.loadPaymentsPage(page);
            if (ok) this.paymentPage = page;
        } else if (pageInput) {
            // Out-of-range input: snap back to the current page
            pageInput.value = this.paymentPage;
        }
    }

    async loadPaymentsPage(page, { scroll = true } = {}) {
        const search = document.getElementById('payment-search')?.value || '';
        const method = document.getElementById('payment-method-filter')?.value || '';
        const cat = document.getElementById('payment-cat-filter')?.value || '';

        let url = `/api/payments?page=${page}&limit=${this.paymentPageSize}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (method) url += `&payment_method=${method}`;
        if (cat) url += `&receipt_category=${cat}`;

        // Drop out-of-order responses (e.g. rapid search keystrokes) so a
        // slow earlier request can't paint over a newer one.
        const reqSeq = (this._paymentsReqSeq = (this._paymentsReqSeq || 0) + 1);

        try {
            const res = await this.apiCall(url);
            if (!res) return false;
            const data = await res.json();
            if (reqSeq !== this._paymentsReqSeq) return false;
            if (data.success) {
                const container = document.getElementById('payment-grid-container');
                if (container) {
                    if (data.data.length === 0) {
                        container.innerHTML = `
                            <div style="grid-column: 1/-1; padding: 5rem; text-align: center; color: var(--gray-400);">
                                <i class="fas fa-receipt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                                <p>No financial records found matching your selection.</p>
                            </div>
                        `;
                    } else {
                        container.innerHTML = data.data.map(p => {
                            const isReturn = p.receipt_category === 'return';
                            const displayDate = this.parseDBDate(p.receipt_date).toLocaleDateString();

                            return `
                                <div class="log-card payment-premium-card" data-id="${p.id}">
                                    <div class="status-strip ${isReturn ? 'closed' : 'open'}"></div>
                                    <div class="log-card-header" style="margin-bottom: 0.8rem;">
                                        <div>
                                            <div class="log-customer-name" style="font-size: 1.05rem;">${p.customer_name}</div>
                                            <div class="log-date"><i class="far fa-calendar-alt"></i> ${displayDate}</div>
                                        </div>
                                        <div class="payment-amount-badge ${isReturn ? 'neg' : 'pos'}" style="text-align: right;">
                                            <div style="font-size: 0.7rem; font-weight: 700; color: var(--gray-400); text-transform: uppercase;">Amount</div>
                                            <div style="font-size: 1.1rem; font-weight: 800; letter-spacing: -0.5px;">
                                                ${isReturn ? '-' : ''}LKR ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; background: #f8fafc; padding: 10px 15px; border-radius: 12px; border: 1px solid #f1f5f9;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 32px; height: 32px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                                <i class="fas ${p.payment_type === 'cash' ? 'fa-wallet' : 'fa-money-check-alt'}" style="color: ${p.payment_type === 'cash' ? '#2ecc71' : '#3498db'}"></i>
                                            </div>
                                            <div>
                                                <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Method</div>
                                                <div style="font-size: 0.85rem; font-weight: 700; color: #475569;">${p.payment_type.toUpperCase()}</div>
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Receipt #</div>
                                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-green-dark); font-family: monospace;">${p.receipt_number}</div>
                                        </div>
                                    </div>

                                    <div class="log-footer" style="padding-top: 0.8rem; border-top: 1px dashed #e2e8f0;">
                                        <div class="log-user" style="font-size: 0.75rem;">
                                            <div class="log-user-avatar" style="width: 20px; height: 20px; font-size: 0.6rem;">${(p.receiver_name || 'S')[0].toUpperCase()}</div>
                                            <span>Staff: <strong>${p.receiver_name || 'System'}</strong></span>
                                        </div>
                                        <div class="action-btns">
                                            ${this.hasPermission('payments', 'view') ? `<button class="btn-icon" title="Print Receipt" onclick="app.printReceipt(${p.id})"><i class="fas fa-print"></i></button>` : ''}
                                            ${this.hasPermission('payments', 'edit') ? `<button class="btn-icon" title="Edit Record" onclick='app.openPaymentModal(null, ${JSON.stringify(p).replace(/"/g, '&quot;')})'><i class="fas fa-edit"></i></button>` : ''}
                                            ${this.hasPermission('payments', 'delete') ? `<button class="btn-icon text-danger" title="Void Payment" onclick="app.handleDeletePayment(${p.id})"><i class="fas fa-trash"></i></button>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        // GSAP Animation
                        if (window.gsap) {
                            gsap.from("#payment-grid-container .log-card", {
                                duration: 0.6,
                                opacity: 0,
                                y: 30,
                                stagger: 0.05,
                                ease: "power3.out"
                            });
                        }
                    }
                }

                // Update pagination controls
                if (data.pagination) {
                    this.paymentTotalPages = data.pagination.totalPages;
                    this.updatePaymentPaginationControls(data.pagination);
                }

                // Update Stats
                this.updatePaymentStats(data.data, data.stats);

                // Scroll to top of payment grid (paging only, not filter loads)
                if (scroll) container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return true;
            }
        } catch (err) {
            console.error('LoadPaymentsPage Error:', err);
        }
        return false;
    }

    updatePaymentStats(payments, serverStats) {
        // Prefer the server aggregate (totals over ALL matching receipts).
        // Computing from `payments` alone only covers the current page.
        const stats = serverStats ? {
            total: parseFloat(serverStats.total) || 0,
            returns: parseFloat(serverStats.returns) || 0,
            cash: parseFloat(serverStats.cash) || 0,
            cheque: parseFloat(serverStats.cheque) || 0
        } : {
            total: 0,
            returns: 0,
            cash: 0,
            cheque: 0
        };

        if (!serverStats) payments.forEach(p => {
            const amt = parseFloat(p.amount) || 0;
            const isReturn = p.receipt_category === 'return';

            if (isReturn) {
                stats.returns += amt;
                if (p.payment_type === 'cash') stats.cash -= amt;
                else stats.cheque -= amt;
            } else {
                stats.total += amt;
                if (p.payment_type === 'cash') stats.cash += amt;
                else stats.cheque += amt;
            }
        });

        const totalEl = document.getElementById('pay-stat-total');
        const returnEl = document.getElementById('pay-stat-returns');
        const cashEl = document.getElementById('pay-stat-cash');
        const chqEl = document.getElementById('pay-stat-cheque');

        if (totalEl) totalEl.textContent = stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (returnEl) returnEl.textContent = stats.returns.toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (cashEl) cashEl.textContent = stats.cash.toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (chqEl) chqEl.textContent = stats.cheque.toLocaleString(undefined, { minimumFractionDigits: 2 });
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
            const container = document.getElementById('visit-grid-container');
            if (container) {
                if (data.data.length === 0) {
                    container.innerHTML = `
                        <div style="grid-column: 1/-1; padding: 5rem; text-align: center; color: var(--gray-400);">
                            <i class="fas fa-ghost" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                            <p>No visit logs found matching your filters.</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = data.data.map(v => {
                        const visitDate = this.parseDBDate(v.visit_date);
                        const isToday = visitDate.toDateString() === new Date().toDateString();
                        const statusClass = v.shop_status === 'open' ? 'open' : 'closed';
                        const statusLabel = v.shop_status === 'open' ? 'Shop Open' : 'Shop Closed';

                        return `
                            <div class="log-card" data-id="${v.id}">
                                <div class="status-strip ${statusClass}"></div>
                                <div class="log-card-header">
                                    <div class="log-customer-info">
                                        <div class="log-customer-name">${v.customer_name}</div>
                                        <div class="log-date">
                                            <i class="far fa-calendar-alt"></i> ${visitDate.toLocaleDateString()}
                                            ${isToday ? '<span class="badge-today">Today</span>' : ''}
                                        </div>
                                    </div>
                                    <div class="log-status-badge ${statusClass}">
                                        <i class="fas ${v.shop_status === 'open' ? 'fa-door-open' : 'fa-door-closed'}"></i> ${statusLabel}
                                    </div>
                                </div>
                                <div class="log-route">
                                    <i class="fas fa-truck-loading"></i> ${v.route_name || 'No Route'}
                                </div>
                                <div class="log-remarks">
                                    ${v.remarks || '<span style="opacity: 0.5; font-style: italic;">No remarks provided for this visit.</span>'}
                                </div>
                                <div class="log-footer">
                                    <div class="log-user">
                                        <div class="log-user-avatar">${(v.user_name || 'U')[0].toUpperCase()}</div>
                                        <span>Logged by <strong>${v.user_name}</strong></span>
                                    </div>
                                    <div class="action-btns">
                                        ${this.hasPermission('visits', 'edit') ? `<button class="btn-icon btn-edit" title="Edit Visit" onclick="app.openVisitModal(${JSON.stringify(v).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>` : ''}
                                        ${this.hasPermission('visits', 'delete') ? `<button class="btn-icon btn-delete" title="Delete Visit" onclick="app.handleDelete('visits', ${v.id}, 'Visit on ${v.visit_date}')"><i class="fas fa-trash"></i></button>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Update Table body for fallback/other uses
                    const tableBody = document.getElementById('visit-table-body');
                    if (tableBody) tableBody.innerHTML = '';
                }
            }

            // GSAP Animation for premium feel
            if (window.gsap && data.data.length > 0) {
                gsap.from(".log-card", {
                    duration: 0.6,
                    opacity: 0,
                    y: 30,
                    stagger: 0.08,
                    ease: "power3.out",
                    clearProps: "all"
                });
            }

            // Update Stats
            this.updateVisitStats(data.data);
        }
    }

    updateVisitStats(visits) {
        const todayStr = new Date().toISOString().split('T')[0];
        const stats = {
            today: visits.filter(v => v.visit_date === todayStr).length,
            open: visits.filter(v => v.shop_status === 'open').length,
            closed: visits.filter(v => v.shop_status === 'closed').length,
            routes: new Set(visits.map(v => v.route_id)).size
        };

        const todayEl = document.getElementById('visit-stat-today');
        const openEl = document.getElementById('visit-stat-open');
        const closedEl = document.getElementById('visit-stat-closed');
        const routesEl = document.getElementById('visit-stat-routes');

        if (todayEl) todayEl.textContent = stats.today;
        if (openEl) openEl.textContent = stats.open;
        if (closedEl) closedEl.textContent = stats.closed;
        if (routesEl) routesEl.textContent = stats.routes;
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
            // 1. Fetch Stats for KPIs
            if (this.currentUser?.role === 'admin') {
                try {
                    const statsRes = await this.apiCall('/api/dashboard/logs/stats');
                    if (statsRes) {
                        const statsData = await statsRes.json();
                        if (statsData.success) {
                            const s = statsData.data;
                            const totalEl = document.getElementById('log-stat-total');
                            const errorEl = document.getElementById('log-stat-errors');
                            const adminEl = document.getElementById('log-stat-admin');
                            const userEl = document.getElementById('log-stat-top-user');

                            if (totalEl) totalEl.textContent = (s.total || 0).toLocaleString();
                            if (errorEl) errorEl.textContent = (s.errors || 0).toLocaleString();
                            if (adminEl) adminEl.textContent = (s.admin_actions || 0).toLocaleString();
                            if (userEl) userEl.textContent = s.top_user || 'None';
                        }
                    }
                } catch (e) {
                    console.warn('Log stats fetch failed', e);
                }
            }

            // 2. Prepare Filters
            const query = document.getElementById('log-search')?.value || '';
            const action = document.getElementById('log-action-filter')?.value || '';
            const from = document.getElementById('log-date-from')?.value || '';
            const to = document.getElementById('log-date-to')?.value || '';

            // 3. Fetch Filtered Logs
            const url = `/api/dashboard/logs?query=${encodeURIComponent(query)}&action=${action}&dateFrom=${from}&dateTo=${to}`;
            const res = await this.apiCall(url);
            if (!res) return;
            const data = await res.json();

            // Show clear button only for admins
            const clearBtn = document.getElementById('clear-logs-btn');
            if (clearBtn) {
                clearBtn.style.display = this.currentUser?.role === 'admin' ? 'block' : 'none';
            }

            if (data.success) {
                const body = document.getElementById('logs-table-body');
                if (body) {
                    body.innerHTML = data.data.map(l => {
                        const isError = l.action === 'ERROR';
                        const isDelete = l.action === 'DELETE' || l.action === 'CLEAR_LOGS';
                        const isUpdate = l.action === 'UPDATE';
                        const isSecurity = l.action === 'LOGIN' || l.action === 'LOGOUT';

                        let icon = 'fa-info-circle';
                        let badgeClass = 'badge-info';

                        if (isError) { icon = 'fa-exclamation-triangle'; badgeClass = 'badge-error'; }
                        else if (isDelete) { icon = 'fa-trash-can'; badgeClass = 'badge-warning'; }
                        else if (isUpdate) { icon = 'fa-edit'; badgeClass = 'badge-warning'; }
                        else if (isSecurity) { icon = 'fa-shield-halved'; badgeClass = 'badge-primary'; }
                        else if (l.action === 'CREATE') { icon = 'fa-plus-circle'; badgeClass = 'badge-success'; }

                        const logDate = this.parseDBDate(l.created_at);

                        return `
                        <tr style="${isError ? 'background: rgba(239, 68, 68, 0.02);' : ''}">
                            <td>
                                <div style="font-weight:700; color:var(--gray-800); font-size:0.85rem;">
                                    ${logDate.toLocaleDateString()}
                                </div>
                                <div style="font-size:0.75rem; color:var(--gray-500);">
                                    ${logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </div>
                            </td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 28px; height: 28px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; color: #64748b; border: 1px solid #e2e8f0;">
                                        ${(l.user_name || 'S')[0].toUpperCase()}
                                    </div>
                                    <div style="font-weight:600; font-size: 0.9rem; color: var(--gray-800);">${l.user_name || 'System'}</div>
                                </div>
                            </td>
                            <td class="text-center">
                                <span class="badge ${badgeClass}" style="padding: 4px 10px; font-size: 0.7rem; letter-spacing: 0.05em; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px;">
                                    <i class="fas ${icon}" style="font-size: 0.7rem;"></i> ${l.action}
                                </span>
                            </td>
                            <td>
                                <div style="font-size: 0.85rem; max-width: 600px; color: var(--gray-700);">
                                    <span style="font-weight: 800; color: #4f46e5; text-transform: uppercase; font-size: 0.65rem; background: #eef2ff; padding: 2px 6px; border-radius: 4px; margin-right: 8px; border: 1px solid #e0e7ff;">
                                        ${l.table_name || 'GENERAL'}
                                    </span>
                                    <span style="line-height: 1.5;">${l.details || ''}</span>
                                </div>
                            </td>
                        </tr>
                    `}).join('') || '<tr><td colspan="4" class="text-center" style="padding: 60px; color: var(--gray-400);"><i class="fas fa-search" style="font-size: 2.5rem; display: block; margin-bottom: 15px; opacity: 0.2;"></i> No logs matching your search parameters.</td></tr>';
                }
            }
        } catch (err) {
            console.error('Load Logs Error:', err);
            this.showNotification('Failed to retrieve system logs', 'error');
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
                const container = document.getElementById('vehicle-grid-container');
                const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f8fafc'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' font-weight='600' fill='%23cbd5e1'>NO IMAGE</text></svg>`;

                if (container) {
                    if (data.data.length === 0) {
                        container.innerHTML = `
                            <div style="grid-column: 1/-1; padding: 5rem; text-align: center; color: var(--gray-400);">
                                <i class="fas fa-truck-fade" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                                <p>No vehicles registered in your fleet yet.</p>
                            </div>
                        `;
                    } else {
                        container.innerHTML = data.data.map(v => {
                            const statusClass = (v.status || 'active').toLowerCase();
                            const statusIcon = statusClass === 'active' ? 'fa-check-circle' : (statusClass === 'maintenance' ? 'fa-tools' : 'fa-times-circle');

                            return `
                                <div class="log-card vehicle-premium-card" data-id="${v.id}">
                                    <div class="status-strip ${statusClass === 'active' ? 'open' : 'closed'}" style="${statusClass === 'maintenance' ? 'background: #f1c40f;' : ''}"></div>
                                    <div class="log-card-header" style="margin-bottom: 1rem;">
                                        <div style="display: flex; gap: 15px; align-items: center;">
                                            <div class="vehicle-img-wrapper" style="width: 60px; height: 60px; border-radius: 14px; overflow: hidden; border: 2px solid #f1f5f9; flex-shrink: 0;">
                                                <img src="${v.vehicle_image || placeholder}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${placeholder}'">
                                            </div>
                                            <div>
                                                <div class="log-customer-name" style="font-size: 1.1rem; letter-spacing: -0.2px;">${v.registration_number}</div>
                                                <div class="log-date" style="font-size: 0.75rem;">${v.model || 'Standard Unit'}</div>
                                            </div>
                                        </div>
                                        <div class="log-status-badge ${statusClass === 'active' ? 'open' : 'closed'}" style="${statusClass === 'maintenance' ? 'background: rgba(241, 196, 15, 0.1); color: #d4ac0d;' : ''}">
                                            <i class="fas ${statusIcon}"></i> ${v.status?.toUpperCase() || 'ACTIVE'}
                                        </div>
                                    </div>
                                    
                                    <div class="vehicle-specs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1.5rem;">
                                        <div class="spec-item" style="background: #f8fafc; padding: 10px; border-radius: 10px; text-align: center;">
                                            <span style="display: block; font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Type</span>
                                            <span style="font-size: 0.85rem; font-weight: 700; color: #475569;">${v.vehicle_type || 'Truck'}</span>
                                        </div>
                                        <div class="spec-item" style="background: #f8fafc; padding: 10px; border-radius: 10px; text-align: center;">
                                            <span style="display: block; font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Capacity</span>
                                            <span style="font-size: 0.85rem; font-weight: 700; color: #475569;">${v.capacity || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div class="log-route" style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 28px; height: 28px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #475569;">
                                                <i class="fas fa-user-tie"></i>
                                            </div>
                                            <span style="font-size: 0.85rem; font-weight: 600; color: #64748b;">${v.driver_name || 'No Pilot Assigned'}</span>
                                        </div>
                                        <div style="font-size: 0.75rem; font-weight: 700; color: #94a3b8;">
                                            <i class="fas fa-gas-pump"></i> ${v.fuel_type || 'Diesel'}
                                        </div>
                                    </div>

                                    <div class="log-footer" style="padding-top: 1rem; border-top: 1px solid #f1f5f9;">
                                        <div class="log-user" style="font-size: 0.75rem;">
                                            <i class="fas fa-map-marker-alt" style="color: var(--primary-green);"></i> ${v.current_location || 'Warehouse'}
                                        </div>
                                        <div class="action-btns">
                                            ${this.hasPermission('vehicles', 'edit') ? `<button class="btn-icon btn-edit" title="Edit Vehicle" onclick="app.openVehicleModal(${JSON.stringify(v).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>` : ''}
                                            ${this.hasPermission('vehicles', 'delete') ? `<button class="btn-icon btn-delete" title="Delete Vehicle" onclick="app.handleDelete('vehicles', ${v.id}, '${v.registration_number}')"><i class="fas fa-trash"></i></button>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        // GSAP Stagger
                        if (window.gsap) {
                            gsap.from("#vehicle-grid-container .log-card", {
                                duration: 0.6,
                                opacity: 0,
                                y: 30,
                                stagger: 0.08,
                                ease: "power3.out"
                            });
                        }
                    }
                }

                // Update Stats
                this.updateVehicleStats(data.data);
            }
        } catch (err) {
            console.error('Error loading vehicles:', err);
        }
    }

    updateVehicleStats(vehicles) {
        const stats = {
            total: vehicles.length,
            active: vehicles.filter(v => (v.status || 'active').toLowerCase() === 'active').length,
            maintenance: vehicles.filter(v => (v.status || 'active').toLowerCase() === 'maintenance').length,
            capacity: vehicles.reduce((sum, v) => sum + (parseFloat(v.capacity) || 0), 0)
        };

        const totalEl = document.getElementById('vehicle-stat-total');
        const activeEl = document.getElementById('vehicle-stat-active');
        const maintEl = document.getElementById('vehicle-stat-maintenance');
        const capEl = document.getElementById('vehicle-stat-capacity');

        if (totalEl) totalEl.textContent = stats.total;
        if (activeEl) activeEl.textContent = stats.active;
        if (maintEl) maintEl.textContent = stats.maintenance;
        if (capEl) capEl.textContent = `${stats.capacity.toLocaleString()} KG`;
    }

    openVehicleModal(v = null) {
        document.getElementById('vehicle-form').reset();
        document.getElementById('vehicle-id').value = v?.id || '';
        document.getElementById('vehicle-modal-title').textContent = v ? 'Edit Vehicle Information' : 'Register New Vehicle';

        if (v) {
            document.getElementById('v-plate').value = v.registration_number || '';
            document.getElementById('v-type').value = v.vehicle_type || 'Truck';
            document.getElementById('v-model').value = v.model || '';
            document.getElementById('v-driver').value = v.driver_name || '';
            document.getElementById('v-capacity').value = v.capacity || '';
            document.getElementById('v-location').value = v.current_location || 'Warehouse';
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
            model: document.getElementById('v-model').value,
            driver_name: document.getElementById('v-driver').value,
            capacity: document.getElementById('v-capacity').value,
            current_location: document.getElementById('v-location').value,
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
                this.renderLoadsCards(active.data, 'active-loads-grid');
            }
            if (allRes) {
                const all = await allRes.json();
                this.renderLoadsCards(all.data, 'history-loads-grid');
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

    renderLoadsCards(loads, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!loads || loads.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--gray-400);">No truck loads found in this category.</div>';
            return;
        }

        container.innerHTML = loads.map(l => {
            const statusColor = l.status === 'loaded' ? '#3b82f6' : '#10b981';
            const statusLabel = l.status === 'loaded' ? 'Loaded' : 'Completed';

            // Placeholder for data not yet in some records
            const model = l.model || 'Standard Delivery Truck';
            const capacity = l.capacity || '4,500 Kg';
            const location = l.current_location || 'Warehouse';

            // Real data from recalculated repository results
            const totalQty = (l.total_quantity || 0).toLocaleString();
            const totalCartons = (l.total_cartons || 0).toFixed(1);

            return `
                <div class="truck-card-modern" onclick="app.toggleTruckActions(this, event)">
                    <div class="truck-card-header">
                        <div class="truck-card-title">
                            <h3>${l.registration_number}</h3>
                            <span>${model}</span>
                        </div>
                        <div class="truck-status-indicator active"></div>
                    </div>

                    <div class="truck-info-grid">
                        <div class="truck-info-item">
                            <span class="truck-info-label">Status</span>
                            <span class="truck-info-value status">
                                <i class="fas fa-check-circle"></i> ${statusLabel}
                            </span>
                        </div>
                        <div class="truck-info-item">
                            <span class="truck-info-label">Capacity</span>
                            <span class="truck-info-value">${capacity}</span>
                        </div>
                        <div class="truck-info-item">
                            <span class="truck-info-label">Location</span>
                            <span class="truck-info-value">${location}</span>
                        </div>
                    </div>

                    <!-- Dynamic Truck Visual -->
                    <div class="truck-visual-wrapper">
                        <!-- Redesigned Integrated Truck Tractor SVG (Facing Left) -->
                        <svg class="truck-cabin-img" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
                            <!-- Main Chassis (Continuous Beam) -->
                            <rect x="10" y="72" width="125" height="10" rx="2" fill="#1e293b"/>
                            
                            <!-- Cabin Main Shell -->
                            <path d="M125,75 L125,20 Q125,12 115,12 L70,12 Q65,12 60,20 L25,48 L15,55 L15,75 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
                            
                            <!-- Aerodynamic Roof Cap -->
                            <path d="M125,25 L125,18 Q125,10 115,10 L75,10 Q70,10 65,15 Z" fill="#f8fafc"/>

                            <!-- Improved Glass & Pillars -->
                            <path d="M62,18 L35,45 L22,53 L45,53 L65,18 Z" fill="#3b82f6" opacity="0.3"/> <!-- Front Windshield -->
                            <rect x="70" y="20" width="45" height="28" rx="4" fill="#3b82f6" opacity="0.15"/> <!-- Main Side Window -->
                            
                            <!-- Front Details (Grille & Bumper) -->
                            <rect x="15" y="58" width="5" height="15" fill="#f1f5f9"/> <!-- Front Edge -->
                            <rect x="10" y="68" width="25" height="10" rx="3" fill="#0f172a"/> <!-- Heavy Bumper -->
                            <rect x="15" y="62" width="8" height="4" rx="1" fill="#fbbf24" opacity="0.9"/> <!-- Headlight -->

                            <!-- Mirrors & Handles -->
                            <rect x="55" y="28" width="4" height="12" rx="2" fill="#1e293b"/> <!-- Side Mirror -->
                            <rect x="95" y="52" width="12" height="3" rx="1.5" fill="#94a3b8"/> <!-- Door Handle -->

                            <!-- Integrated Heavy-Duty Wheels - Matched to CSS .wheel styling -->
                            <g class="tractor-wheels">
                                <!-- Steering Wheel -->
                                <circle cx="35" cy="88" r="14" fill="#1e293b" stroke="#475569" stroke-width="4"/>
                                <circle cx="35" cy="88" r="7" fill="#94a3b8" opacity="0.3"/>
                                
                                <!-- Drive Wheel -->
                                <circle cx="105" cy="88" r="14" fill="#1e293b" stroke="#475569" stroke-width="4"/>
                                <circle cx="105" cy="88" r="7" fill="#94a3b8" opacity="0.3"/>
                            </g>
                        </svg>





                        <div class="truck-cargo-container ${l.status === 'loaded' ? '' : 'unloaded'}" onclick="app.toggleTruckActions(this.closest('.truck-card-modern'), event)">
                            ${l.status === 'loaded' ? `
                                <div class="cargo-weight" style="font-size: 0.65rem; margin-bottom: 2px; text-transform: uppercase; opacity: 0.7;">TOTAL QUANTITY</div>
                                <div class="cargo-percent" style="font-size: 1.4rem; margin-bottom: 5px;">${totalQty}</div>
                                <div class="cargo-weight" style="font-size: 0.8rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 4px; font-weight: 700;">${totalCartons} CARTONS</div>
                            ` : `
                                <div class="cargo-percent" style="font-size: 1.1rem; letter-spacing: 2px;">EMPTY</div>
                                <div class="cargo-weight" style="font-size: 0.6rem; text-transform: uppercase;"><i class="fas fa-check"></i> Stock Delivered</div>
                            `}
                        </div>

                        <div class="truck-wheels">
                            <!-- Integrated Tractor Wheels are above inside SVG. Only Rear Trailer Wheels here. -->
                            <div class="wheel" style="margin-left: auto;"></div> <!-- Rear Trailer 1 -->
                            <div class="wheel" style="margin-left: 10px; margin-right: 15px;"></div> <!-- Rear Trailer 2 -->
                        </div>
                    </div>



                    <div class="truck-card-actions">
                        ${l.status === 'loaded' ? `
                            <button class="btn btn-sm btn-primary" onclick="app.openUnloadModal(${l.id})">
                                <i class="fas fa-box-open"></i> Unload
                            </button>
                            <button class="btn-icon btn-edit" onclick="app.openLoadModal(${l.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-secondary" onclick="app.viewLoadReport(${l.id})">
                                <i class="fas fa-file-alt"></i> Report
                            </button>
                        `}
                        <button class="btn-icon btn-delete" onclick="app.handleDeleteLoad(${l.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>

                    <div style="margin-top: auto; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #718096;">
                        <span><i class="fas fa-calendar"></i> ${new Date(l.load_date).toLocaleDateString()}</span>
                        <span><i class="fas fa-user"></i> ${l.driver_name || 'No Driver'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    toggleTruckActions(card, event) {
        if (event) event.stopPropagation();

        // Hide all others first
        document.querySelectorAll('.truck-card-modern').forEach(c => {
            if (c !== card) c.classList.remove('actions-visible');
        });

        // Toggle the current one
        card.classList.toggle('actions-visible');
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
        const center = [7.99125, 80.26873];
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

        // If it's a manual add (itemData is null), check for authorization
        if (itemData === null) {
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            if (user.role !== 'admin') {
                this.pendingRmaProduct = { isManualRow: true };
                this.openSupervisorModal();
                return;
            }
        }

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

        const qty = itemData ? itemData.quantity : 0;
        const price = itemData ? itemData.msrp : 0;
        const productId = itemData ? itemData.product_id : '';
        const notes = itemData ? (itemData.notes || '') : '';
        const maxQty = itemData ? (itemData.max_qty || '') : '';

        const batchNumber = itemData ? (itemData.batch_number || '') : '';
        const priceId = itemData ? (itemData.price_id || '') : '';

        row.innerHTML = `
            <td>
                <input type="hidden" class="rma-batch" value="${batchNumber}">
                <input type="hidden" class="rma-price-id" value="${priceId}">
                <select class="form-control rma-product-select" style="margin:0;" required onchange="app.updateRmaItemPrice(this)">
                    <option value="">Search Product...</option>
                    ${this.allProducts?.map(p => `<option value="${p.id}" data-price="${p.msrp}" ${p.id == productId ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
                ${maxQty ? `<small style="color:var(--gray-500); display:block; font-size:0.7rem;">Invoice Qty: ${maxQty} | Batch: ${batchNumber || 'N/A'}</small>` : ''}
            </td>
            <td><input type="number" step="0.01" class="form-control rma-qty" value="${qty}" style="margin:0;" required oninput="app.updateRmaTotal()" ${maxQty ? `max="${maxQty}"` : ''}></td>
            <td><input type="number" step="0.01" class="form-control rma-price" value="${price}" style="margin:0;" required oninput="app.updateRmaTotal()"></td>
            <td><input type="text" class="form-control rma-reason" placeholder="e.g. Broken Seal" value="${notes}" style="margin:0;" required></td>
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
        tbody.appendChild(row);
        this.updateRmaTotal();
    }

    async searchRmaProducts(query) {
        const resultsDiv = document.getElementById('rma-search-results');
        if (!query || query.length < 1) {
            resultsDiv.style.display = 'none';
            return;
        }

        if (!this.allProducts) {
            const res = await this.apiCall('/api/products?limit=1000');
            if (res) {
                const pData = await res.json();
                this.allProducts = pData.data;
            }
        }

        const filtered = this.allProducts.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.brand_name && p.brand_name.toLowerCase().includes(query.toLowerCase())) ||
            (p.category_name && p.category_name.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 10);

        if (filtered.length > 0) {
            resultsDiv.innerHTML = filtered.map(p => `
                <div class="search-result-item" onclick="app.selectRmaProduct(${p.id})">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <div>
                            <div class="product-name" style="font-weight:700;">${p.name}</div>
                            <div class="product-info" style="font-size:0.75rem; color:var(--gray-500);">${p.brand_name || ''} | ${p.category_name || ''}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:700; color:var(--primary-green);">${this.formatCurrency(p.msrp)}</div>
                            <div style="font-size:0.7rem; color:var(--gray-400);">Stock: ${p.initial_stock || 0} ${p.unit || ''}</div>
                        </div>
                    </div>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = '<div class="search-result-item text-muted">No products found</div>';
            resultsDiv.style.display = 'block';
        }
    }

    selectFirstRmaProduct() {
        const resultsDiv = document.getElementById('rma-search-results');
        const firstResult = resultsDiv.querySelector('.search-result-item');
        if (firstResult && !firstResult.classList.contains('text-muted')) {
            firstResult.click();
        }
    }

    async selectRmaProduct(productId) {
        const product = this.allProducts.find(p => p.id == productId);
        if (product) {
            // Check if supervisor authorization is needed
            // If there's a linked invoice, check if this product is in that invoice
            const invoiceId = document.getElementById('rma-invoice').value;
            let needsAuth = true;

            if (invoiceId) {
                // If it's in the invoice, it might have been loaded already or user is re-adding it
                // But generally, the prompt implies manual entry "apart from linked invoice" needs auth
            }

            // Always ask for auth for manual search additions for now to be safe, unless user is admin
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            if (user.role === 'admin') {
                needsAuth = false;
            }

            if (needsAuth) {
                this.pendingRmaProduct = product;
                this.openSupervisorModal();
                return;
            }

            await this.addRmaItemRow({
                product_id: product.id,
                quantity: 1,
                msrp: product.msrp
            });
            document.getElementById('rma-product-search').value = '';
            document.getElementById('rma-search-results').style.display = 'none';
        }
    }

    openSupervisorModal() {
        const modal = document.getElementById('supervisor-auth-modal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            document.getElementById('sup-username').focus();
        }
    }

    closeSupervisorModal() {
        const modal = document.getElementById('supervisor-auth-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        document.getElementById('supervisor-auth-form').reset();
        this.pendingRmaProduct = null;
    }

    async handleSupervisorAuth(e) {
        e.preventDefault();
        const username = document.getElementById('sup-username').value;
        const password = document.getElementById('sup-password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (data.success && (data.data.user.role === 'admin' || data.data.user.role === 'supervisor')) {
                this.showNotification('Authorization Successful', 'success');
                const adminName = data.data.user.name;
                this.closeSupervisorModal();

                if (this.pendingRmaProduct) {
                    if (this.pendingRmaProduct.isManualRow) {
                        // Special item Data to bypass the auth check in addRmaItemRow
                        await this.addRmaItemRow({
                            product_id: '',
                            quantity: 0,
                            msrp: 0,
                            notes: `Manual row authorized by ${adminName}`
                        });
                    } else {
                        await this.addRmaItemRow({
                            product_id: this.pendingRmaProduct.id,
                            quantity: 1,
                            msrp: this.pendingRmaProduct.msrp,
                            notes: `Authorized by ${adminName}`
                        });
                        document.getElementById('rma-product-search').value = '';
                        document.getElementById('rma-search-results').style.display = 'none';
                    }
                }
            } else {
                this.showNotification('Unauthorized: Supervisor or Admin credentials required', 'error');
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            this.showNotification('Authentication service unavailable', 'error');
        }
    }

    async toggleRmaLoadSelect(val) {
        const container = document.getElementById('rma-load-container');
        const select = document.getElementById('rma-load');
        if (val === 'truck') {
            container.style.display = 'block';
            select.innerHTML = '<option value="">Loading Loads...</option>';
            const res = await this.apiCall('/api/distribution/active-loads');
            if (res && res.ok) {
                const data = await res.json();
                select.innerHTML = '<option value="">Select Active Load</option>' +
                    data.data.map(l => `<option value="${l.id}">${l.registration_number} - ${l.driver_name || 'No Driver'} (${this.parseDBDate(l.load_date).toLocaleDateString()})</option>`).join('');
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
        if (!invoiceId) {
            const tbody = document.getElementById('rma-items-body');
            if (tbody.children.length === 0) {
                await this.addRmaItemRow();
            }
            return;
        }

        this.showNotification('Loading invoice items...', 'info');
        const res = await this.apiCall(`/api/sales/${invoiceId}`);
        if (res && res.ok) {
            const data = await res.json();
            const invoice = data.data;

            if (invoice && invoice.items) {
                const tbody = document.getElementById('rma-items-body');
                tbody.innerHTML = ''; // Clear current rows

                // Track items in invoice for later validation if needed
                this.currentRmaInvoiceItems = invoice.items;

                for (const item of invoice.items) {
                    // Calculate price based on net_total / quantity if available to get actual sold price
                    const soldPrice = item.quantity > 0 ? (item.line_total / item.quantity) : item.msrp;

                    await this.addRmaItemRow({
                        product_id: item.product_id,
                        quantity: 0, // Default to 0, user will enter how many they want to return
                        msrp: soldPrice,
                        max_qty: item.quantity,
                        batch_number: item.batch_number,
                        price_id: item.price_id || null,
                        notes: `From Invoice ${invoice.invoice_number}`
                    });
                }
                this.showNotification(`Loaded ${invoice.items.length} items from invoice. Use "Add Item" or search for items not in this invoice.`, 'success');
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
            const qty = parseFloat(row.querySelector('.rma-qty').value) || 0;
            if (pId && qty > 0) {
                items.push({
                    product_id: pId,
                    quantity: qty,
                    unit_price: parseFloat(row.querySelector('.rma-price').value),
                    reason: row.querySelector('.rma-reason').value,
                    condition: row.querySelector('.rma-condition').value,
                    batch_number: row.querySelector('.rma-batch')?.value || null,
                    price_id: row.querySelector('.rma-price-id')?.value || null
                });
            }
        });

        if (items.length === 0) {
            this.showNotification('Please add at least one item with a quantity greater than zero', 'warning');
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
                                price_id: item.price_id,
                                batch_number: item.batch_number,
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
                <select class="form-control item-product" required onchange="app.updateLoadItemBatches(this)">
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
                <select class="form-control item-batch" style="margin-bottom: 0;">
                    <option value="">Default/Primary</option>
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

        if (data && data.product_id) {
            // If data is passed (e.g. from existing load), populate batches dropdown
            await this.updateLoadItemBatches(row.querySelector('.item-product'), data.price_id);
        }
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

    async updateLoadItemBatches(select, selectedPriceId = null) {
        const row = select.closest('tr');
        const productId = select.value;
        const batchSelect = row.querySelector('.item-batch');
        const unit = select.options[select.selectedIndex].dataset.unit || '';
        row.querySelector('.unit-text').textContent = unit;

        if (!productId) {
            batchSelect.innerHTML = '<option value="">-</option>';
            return;
        }

        try {
            const res = await this.apiCall(`/api/products/${productId}`);
            if (res) {
                const product = (await res.json()).data;
                const prices = product.prices || [];

                if (prices.length > 0) {
                    batchSelect.innerHTML = prices.map(p => `
                        <option value="${p.id}" data-batch="${p.batch_number || ''}" ${selectedPriceId == p.id ? 'selected' : ''}>
                            ${p.batch_number || 'Default'} - LKR ${p.price}
                        </option>
                    `).join('');
                } else {
                    batchSelect.innerHTML = '<option value="">Default</option>';
                }
            }
        } catch (err) {
            console.error('Error fetching product prices:', err);
        }

        const cartonInput = row.querySelector('.item-cartons');
        if (cartonInput && cartonInput.value) {
            this.updateLoadItemQtyFromCartons(cartonInput);
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
                if (firstSelect && (firstSelect.value === '' || firstSelect.value == productId) && firstQty && firstQty.value === '') {
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
            const batchSelect = tr.querySelector('.item-batch');
            const priceId = batchSelect.value;
            const batchNumber = batchSelect.options[batchSelect.selectedIndex]?.dataset.batch || null;
            const qty = tr.querySelector('.item-qty').value;

            if (productId && qty) {
                items.push({
                    product_id: productId,
                    price_id: priceId || null,
                    batch_number: batchNumber,
                    quantity_loaded: parseFloat(qty)
                });
            }
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
            const vInfo = varianceData.find(v => v.product_name === item.product_name && v.batch_number === item.batch_number) || { sold: 0 };
            return `
                <tr data-product-id="${item.product_id}" data-price-id="${item.price_id || ''}" data-batch="${item.batch_number || ''}">
                    <td>
                        <strong>${item.product_name}</strong>
                        <div style="font-size: 0.75rem; color: #64748b;">Batch: ${item.batch_number || 'Default'}</div>
                    </td>
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
                price_id: tr.dataset.priceId || null,
                batch_number: tr.dataset.batch || null,
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
            this.loadPOSCustomers(),
            this.loadPOSPriceLevels()
        ]);

        // Attach POS Event Listeners after view is loaded
        const searchInput = document.getElementById('pos-product-search');
        if (searchInput) {
            // Remove existing listener if any (to avoid duplicates)
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            newSearchInput.addEventListener('input', (e) => {
                if (this.posState.products) {
                    this.renderProductTiles(this.filterPOSProducts(e.target.value));
                }
            });
        }

        const loadSelector = document.getElementById('pos-load-selector');
        if (loadSelector) {
            // Remove existing listener if any
            const newLoadSelector = loadSelector.cloneNode(true);
            loadSelector.parentNode.replaceChild(newLoadSelector, loadSelector);
            newLoadSelector.addEventListener('change', async (e) => {
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

            // If a load is already selected (e.g. from state), trigger loading its stock
            if (this.posState.selectedLoadId) {
                loadSelector.value = this.posState.selectedLoadId;
                await this.loadTruckStock(this.posState.selectedLoadId);
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

    async loadPOSPriceLevels() {
        try {
            const res = await this.apiCall('/api/price-levels');
            const data = await res.json();
            if (data.success) {
                this.availablePriceLevels = data.data || [];
            }
        } catch (e) {
            console.error('Failed to load POS price levels:', e);
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

        document.getElementById('pos-customer-selector').value = customer.id;

        document.getElementById('pos-cust-name').textContent = customer.name;
        document.getElementById('pos-cust-detail').textContent =
            (customer.address || '') + (customer.phone ? ' • ' + customer.phone : '');

        const balanceEl = document.getElementById('pos-cust-balance');
        if (balanceEl) {
            const bal = customer.account_balance || customer.outstanding_balance || 0;
            const limit = customer.credit_limit || 0;

            balanceEl.innerHTML = `${parseFloat(bal).toLocaleString(undefined, { minimumFractionDigits: 2 })} <br>
                           <span style="font-size:0.6rem; color: rgba(255,255,255,0.7);">Limit: ${parseFloat(limit).toLocaleString()}</span>`;

            // Colors for Dark Green Background:
            // Over Limit: Light Red / Pink
            // Debt (>0): Pale Yellow
            // Credit/Zero: White
            balanceEl.style.color = bal > limit ? '#fca5a5' : (bal > 0 ? '#fef08a' : '#ffffff');
        }

        this.posState.selectedCustomer = customer;

        // Auto-update cart items to customer's price level if applicable
        if (customer.price_level_id && this.posState.cart.length > 0) {
            let updatedCount = 0;
            this.posState.cart.forEach(item => {
                if (item.is_free) return;
                const product = this.posState.products.find(p => p.id === item.product_id);
                if (product && product.prices) {
                    const leveledPrice = product.prices.find(p =>
                        p.price_level_id == customer.price_level_id &&
                        (!item.batch_number || p.batch_number === item.batch_number)
                    );
                    if (leveledPrice) {
                        item.msrp = leveledPrice.price;
                        item.batch_number = leveledPrice.batch_number; // Sync batch number if it changed or was missing
                        item.selected_price_id = leveledPrice.id;
                        this.recalculateLineTotal(item);
                        updatedCount++;
                    }
                }
            });
            if (updatedCount > 0) {
                this.showNotification(`Updated ${updatedCount} items to Customer's Price Level`, 'info');
                this.updateCartUI();
            }
        }

        // Fetch customer-specific discounts
        this.posState.customerDiscounts = {};
        try {
            const res = await this.apiCall(`/api/sales/customer-discounts/${customer.id}`);
            if (res) {
                const data = await res.json();
                if (data.success) {
                    data.data.forEach(d => {
                        // Store as specific key
                        const specKey = d.price_id ? `${d.product_id}_${d.price_id}` : d.product_id;
                        this.posState.customerDiscounts[specKey] = {
                            percentage: d.discount_percentage,
                            amount: d.discount_amount
                        };
                        // Also store as simple product key if not already set (fallback for UI)
                        if (!this.posState.customerDiscounts[d.product_id]) {
                            this.posState.customerDiscounts[d.product_id] = {
                                percentage: d.discount_percentage,
                                amount: d.discount_amount
                            };
                        }
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
                const specKey = item.selected_price_id ? `${item.product_id}_${item.selected_price_id}` : item.product_id;
                const disc = (this.posState.customerDiscounts || {})[specKey] || (this.posState.customerDiscounts || {})[item.product_id];

                if (disc && !item.is_free) {
                    item.discount_percentage = disc.percentage;
                    this.recalculateLineTotal(item);
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

    getCartQtyForProduct(productId) {
        return (this.posState.cart || [])
            .filter(item => item.product_id == productId)
            .reduce((sum, item) => sum + item.quantity, 0);
    }

    renderProductTiles(products) {
        const grid = document.getElementById('pos-product-grid');
        const footer = document.getElementById('pos-truck-footer');
        if (!grid) return;

        // Reset lazy loading state
        this.posState.renderedCount = 0;
        this.posState.renderedProducts = products || [];
        grid.innerHTML = '';

        if (!products || products.length === 0) {
            grid.innerHTML = '<div class="pos-empty-state"><p>No products found in this truck load.</p></div>';
            if (footer) footer.style.display = 'none';
            return;
        }

        // Calculate Truck Totals (always based on full product list)
        let totalQty = products.reduce((sum, p) => {
            const cartQty = this.getCartQtyForProduct(p.id);
            return sum + Math.max(0, (p.available_quantity || 0) - cartQty);
        }, 0);

        if (footer) {
            footer.style.display = 'flex';
            document.getElementById('pos-total-items-count').textContent = products.length;
            document.getElementById('pos-total-truck-qty').textContent = totalQty.toLocaleString();
            const selector = document.getElementById('pos-load-selector');
            if (selector && selector.selectedIndex > 0) {
                document.getElementById('pos-selected-truck-name').textContent = selector.options[selector.selectedIndex].text;
            }
        }

        // Render first batch
        this.renderNextPOSBatch();

        // Add scroll listener if not already added
        if (!grid.dataset.lazyBound) {
            grid.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = grid;
                if (scrollTop + clientHeight >= scrollHeight - 50) {
                    this.renderNextPOSBatch();
                }
            });
            grid.dataset.lazyBound = 'true';
        }
    }

    renderNextPOSBatch() {
        const grid = document.getElementById('pos-product-grid');
        if (!grid) return;

        const start = this.posState.renderedCount;
        const end = start + (this.posState.pageSize || 12);
        const batch = this.posState.renderedProducts.slice(start, end);

        if (batch.length === 0) return;

        const html = batch.map(p => {
            const cartQty = this.getCartQtyForProduct(p.id);
            const remainingQty = Math.max(0, p.available_quantity - cartQty);
            const stockStatus = remainingQty <= 0 ? 'out' : (remainingQty < 10 ? 'low' : 'in');
            const stockClass = remainingQty <= 0 ? 'no-stock' : (remainingQty < 10 ? 'low-stock' : '');
            const stockLabel = remainingQty <= 0 ? 'Out of Stock' : (remainingQty < 10 ? 'Low Stock' : 'In Stock');

            const lastDisc = (this.posState.customerDiscounts || {})[p.id];
            const discHtml = (lastDisc && lastDisc.percentage > 0) ? `
                <div class="special-rate-hint" style="font-size: 0.75rem; color: var(--primary-green); font-weight: 700; background: rgba(46, 125, 50, 0.1); padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; margin-top: 5px;">
                    <i class="fas fa-certificate"></i> Last: ${lastDisc.percentage}%
                </div>
            ` : '';

            return `
                <div class="product-card ${stockClass}" data-product-id="${p.id}" onclick="${remainingQty > 0 ? `app.checkAndAddToCart(${p.id}, false)` : ''}">
                    <div class="product-sku">${p.reference_code || 'N/A'}</div>
                    ${p.allow_free_issue === 1 && remainingQty > 0 ? `
                        <button class="btn-free-add" title="Add as FREE Issue" onclick="event.stopPropagation(); app.checkAndAddToCart(${p.id}, true)" style="position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; background: var(--primary-green); color: white; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); cursor: pointer; z-index: 10;">
                            <i class="fas fa-gift"></i>
                        </button>
                    ` : ''}
                    <div class="product-name">${p.name}</div>
                    <div class="product-stock">
                        <span class="stock-tag ${stockStatus}">
                            <i class="fas ${stockStatus === 'out' ? 'fa-times-circle' : (stockStatus === 'low' ? 'fa-exclamation-triangle' : 'fa-check-circle')}"></i>
                            <span class="stock-label-text">${stockLabel}: ${remainingQty}</span>
                        </span>
                    </div>
                    <div class="product-price">${remainingQty <= 0 ? '---' : p.msrp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    ${discHtml}
                </div>
            `;
        }).join('');

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        while (wrapper.firstChild) {
            grid.appendChild(wrapper.firstChild);
        }

        this.posState.renderedCount = end;
    }

    updateProductGridQuantities() {
        const grid = document.getElementById('pos-product-grid');
        if (!grid) return;

        // Iterate through all rendered product cards
        const cards = grid.querySelectorAll('.product-card[data-product-id]');
        cards.forEach(card => {
            const productId = card.dataset.productId;
            const p = this.posState.products.find(prod => prod.id == productId);
            if (!p) return;

            const cartQty = this.getCartQtyForProduct(p.id);
            const remainingQty = Math.max(0, p.available_quantity - cartQty);
            const stockStatus = remainingQty <= 0 ? 'out' : (remainingQty < 10 ? 'low' : 'in');
            const stockClass = remainingQty <= 0 ? 'no-stock' : (remainingQty < 10 ? 'low-stock' : '');
            const stockLabel = remainingQty <= 0 ? 'Out of Stock' : (remainingQty < 10 ? 'Low Stock' : 'In Stock');

            // Update Classes
            card.classList.remove('no-stock', 'low-stock');
            if (stockClass) card.classList.add(stockClass);

            // Update Click Handler (toggle based on stock)
            card.onclick = remainingQty > 0 ? () => this.checkAndAddToCart(p.id, false) : null;

            // Update Stock Tag
            const tag = card.querySelector('.stock-tag');
            if (tag) {
                tag.className = `stock-tag ${stockStatus}`;
                const icon = tag.querySelector('i');
                if (icon) {
                    icon.className = `fas ${stockStatus === 'out' ? 'fa-times-circle' : (stockStatus === 'low' ? 'fa-exclamation-triangle' : 'fa-check-circle')}`;
                }
                const labelText = tag.querySelector('.stock-label-text');
                if (labelText) {
                    labelText.textContent = `${stockLabel}: ${remainingQty}`;
                }
            }

            // Update Price display (in case it marks --- for out of stock)
            const priceEl = card.querySelector('.product-price');
            if (priceEl) {
                priceEl.textContent = remainingQty <= 0 ? '---' : p.msrp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        });

        // Also update footer stats
        const footer = document.getElementById('pos-truck-footer');
        if (footer && this.posState.products.length > 0) {
            let totalQty = this.posState.products.reduce((sum, p) => {
                const cartQty = this.getCartQtyForProduct(p.id);
                return sum + Math.max(0, (p.available_quantity || 0) - cartQty);
            }, 0);
            const qtyEl = document.getElementById('pos-total-truck-qty');
            if (qtyEl) qtyEl.textContent = totalQty.toLocaleString();
        }
    }


    filterPOSProducts(query) {
        if (!query) return this.posState.products;
        query = query.toLowerCase();
        return this.posState.products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.reference_code && p.reference_code.toLowerCase().includes(query))
        );
    }

    checkAndAddToCart(productId, isFree = false) {
        // Feature Request: Popup/Notify if discount exists
        const disc = (this.posState.customerDiscounts || {})[productId];
        if (!isFree && disc && disc.percentage > 0) {
            this.showNotification(`Applying ${disc.percentage}% discount from last invoice!`, 'info');
        }
        this.addToCart(productId, isFree);
    }

    openBatchSelectionModal(product, isFree) {
        const modal = document.getElementById('pos-batch-modal');
        const body = document.getElementById('batch-selection-body');
        document.getElementById('batch-product-name').textContent = product.name;
        document.getElementById('batch-product-code').textContent = product.reference_code || 'SKU: N/A';

        // Filter valid prices
        const priceLevels = (this.availablePriceLevels || []);

        body.innerHTML = product.prices.map(p => {
            const level = priceLevels.find(l => l.id == p.price_level_id);
            const levelName = level ? level.name : (p.label || 'Default');
            const isMatch = this.posState.selectedCustomer?.price_level_id == p.price_level_id;
            const available = p.available_qty !== undefined ? p.available_qty : product.available_quantity;

            return `
                <tr style="${isMatch ? 'background: #f0fdf4;' : ''}; ${available <= 0 ? 'opacity: 0.6;' : ''}">
                    <td><strong>${p.batch_number || '-'}</strong></td>
                    <td><span class="badge ${isMatch ? 'badge-success' : 'badge-secondary'}">${levelName}</span></td>
                    <td class="text-right"><strong>${p.price.toFixed(2)}</strong></td>
                    <td class="text-right" style="color: ${available <= 0 ? 'var(--error)' : 'inherit'}; font-weight: 600;">${available.toFixed(2)}</td>
                    <td class="text-center">
                        <button class="btn btn-primary btn-sm" onclick="app.selectBatchPrice(${product.id}, ${p.id}, ${isFree})" ${available <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i> Select
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        modal.classList.add('active');
    }

    selectBatchPrice(productId, priceId, isFree) {
        const product = this.posState.products.find(p => p.id == productId);
        if (!product) return;
        const price = product.prices.find(p => p.id == priceId);
        if (!price) return;

        // Close modal
        document.getElementById('pos-batch-modal').classList.remove('active');

        // Add to cart with specific price
        this.addToCart(productId, isFree, price);
    }

    addToCart(productId, isFree = false) {
        const product = this.posState.products.find(p => p.id == productId);
        if (!product) return;

        const currentCartQty = this.getCartQtyForProduct(productId);
        if (currentCartQty + 1 > product.available_quantity) {
            this.showNotification('Exceeds available truck stock', 'warning');
            return;
        }

        if (isFree && product.allow_free_issue !== 1) {
            this.showNotification('This product is not allowed for Free Issue', 'warning');
            return;
        }

        // Feature: Batch/Price Selection
        if (!isFree && product.prices && product.prices.length > 1 && !arguments[2]) {
            this.openBatchSelectionModal(product, isFree);
            return;
        }

        const selectedPrice = arguments[2]; // If passed from modal

        // Determine the price level to use
        let targetPrice = selectedPrice || (product.prices || []).find(p => p.is_primary);
        if (!selectedPrice && this.posState.selectedCustomer?.price_level_id) {
            const leveledPrice = (product.prices || []).find(p => p.price_level_id == this.posState.selectedCustomer.price_level_id);
            if (leveledPrice) targetPrice = leveledPrice;
        }

        const priceId = targetPrice ? targetPrice.id : null;

        // Lookup discount: Check price-specific first, then product-default
        const specKey = priceId ? `${productId}_${priceId}` : productId;
        const disc = (this.posState.customerDiscounts || {})[specKey] || (this.posState.customerDiscounts || {})[productId];

        // Merge with existing item ONLY if the FREE status AND Price ID matches.
        // This allows having multiple lines for the same product with different prices/batches.
        const cartItem = this.posState.cart.find(item =>
            item.product_id == productId &&
            !!item.is_free === !!isFree &&
            item.selected_price_id == priceId
        );

        if (cartItem) {
            cartItem.quantity += 1;
            this.recalculateLineTotal(cartItem);
        } else {
            // Fallback to basic product fields if no prices found
            const msrp = targetPrice ? targetPrice.price : product.msrp;
            // const priceId = targetPrice ? targetPrice.id : null; (already defined above)

            const appliedDisc = isFree ? 0 : (disc ? disc.percentage : 0);

            this.posState.cart.push({
                product_id: product.id,
                product_name: product.name,
                msrp: msrp,
                quantity: 1,
                batch_number: targetPrice ? targetPrice.batch_number : null,
                discount_percentage: appliedDisc,
                discount_amount: isFree ? 0 : (msrp * (appliedDisc / 100)),
                is_free: isFree,
                line_total: isFree ? 0 : msrp * (1 - (appliedDisc / 100)),
                weighted: product.weighted,
                allow_free_issue: product.allow_free_issue,
                selected_price_id: priceId
            });

            if (!isFree && disc && disc.percentage > 0) {
                this.showNotification(`Applied last discount: ${disc.percentage}% for this customer`, 'info');
            }
        }

        this.updateCartUI();
    }

    removeFromCart(index) {
        this.posState.cart.splice(index, 1);
        this.updateCartUI();
    }


    updateCartQty(index, newQty) {
        const item = this.posState.cart[index];
        if (!item) return;
        const product = this.posState.products.find(p => p.id == item.product_id);

        if (item && product) {
            let qty = parseFloat(newQty) || 0;

            // INTEGER CHECK
            if (!product.weighted && !Number.isInteger(qty)) {
                this.showNotification('Product is not weighted. Only integer quantities allowed.', 'warning');
                qty = Math.round(qty); // Force integer
            }

            // Total cart qty excluding this line
            const otherCartQty = this.posState.cart
                .filter((_, idx) => idx !== index && _.product_id === item.product_id)
                .reduce((sum, i) => sum + i.quantity, 0);

            if (otherCartQty + qty > product.available_quantity) {
                this.showNotification('Exceeds available truck stock', 'warning');
                this.updateCartUI(); // Reset UI
                return;
            }

            item.quantity = qty;
            this.recalculateLineTotal(item);
            this.updateCartUI();
        }
    }

    updateCartPrice(index, newPrice) {
        const item = this.posState.cart[index];
        if (item) {
            const price = parseFloat(newPrice) || 0;
            item.msrp = price;
            item.is_custom_price = true;
            this.recalculateLineTotal(item);
            this.updateCartUI();
        }
    }

    updateCartPriceLevel(index, priceId) {
        const item = this.posState.cart[index];
        if (!item) return;

        if (priceId === 'custom') {
            item.is_custom_price = true;
            this.updateCartUI();
            return;
        }

        const product = this.posState.products.find(p => p.id == item.product_id);
        if (product && product.prices) {
            const priceLevel = product.prices.find(p => p.id == priceId);
            if (priceLevel) {
                // Check if another item already exists with this price level to merge
                const otherIndex = this.posState.cart.findIndex((i, idx) =>
                    idx !== index &&
                    i.product_id == item.product_id &&
                    i.is_free === item.is_free &&
                    i.selected_price_id == priceLevel.id
                );

                if (otherIndex !== -1) {
                    const otherItem = this.posState.cart[otherIndex];
                    otherItem.quantity += item.quantity;
                    this.recalculateLineTotal(otherItem);
                    this.posState.cart.splice(index, 1);
                    this.showNotification('Items merged under same price level', 'info');
                } else {
                    item.msrp = priceLevel.price;
                    item.batch_number = priceLevel.batch_number;
                    item.selected_price_id = priceLevel.id;
                    item.is_custom_price = false;
                    this.recalculateLineTotal(item);
                }

                this.updateCartUI();
            }
        }
    }

    updateCartDiscount(index, newDisc) {
        const item = this.posState.cart[index];
        if (item) {
            const disc = Math.min(Math.max(parseFloat(newDisc) || 0, 0), 100);
            item.discount_percentage = disc;
            this.recalculateLineTotal(item);
            this.updateCartUI();
        }
    }

    toggleFreeIssue(index, isFree) {
        const item = this.posState.cart[index];
        if (item) {
            if (isFree && item.allow_free_issue !== 1) {
                this.showNotification('This product is not allowed for Free Issue', 'warning');
                this.updateCartUI(); // Reset UI checkbox state
                return;
            }
            item.is_free = isFree;

            // Check if there is another item of the same product with the same status AND price ID to merge
            const otherIndex = this.posState.cart.findIndex((i, idx) =>
                idx !== index &&
                i.product_id == item.product_id &&
                i.is_free === isFree &&
                i.selected_price_id == item.selected_price_id
            );

            if (otherIndex !== -1) {
                const otherItem = this.posState.cart[otherIndex];
                otherItem.quantity += item.quantity;
                this.recalculateLineTotal(otherItem);
                this.posState.cart.splice(index, 1);
            } else {
                this.recalculateLineTotal(item);
            }

            this.updateCartUI();
        }
    }

    recalculateLineTotal(item) {
        if (item.is_free) {
            item.line_total = 0;
            item.discount_percentage = 0;
            item.discount_amount = 0;
        } else {
            const discPerUnit = item.msrp * (item.discount_percentage / 100);
            item.discount_amount = discPerUnit * item.quantity;
            item.line_total = item.quantity * (item.msrp - discPerUnit);
        }
    }

    updateCartUI() {
        const tbody = document.getElementById('pos-cart-body');
        if (!tbody) return;

        // NEW: Real-time update of product tile quantities
        // Move to top so it runs even if cart matches 0 (e.g. after removing last item)
        if (this.posState.products.length > 0) {
            this.updateProductGridQuantities();
        }

        const countEl = document.getElementById('pos-cart-count');

        if (this.posState.cart.length === 0) {
            tbody.innerHTML = '<div class="text-center" style="padding: 4rem 2rem; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 15px;"><i class="fas fa-shopping-basket" style="font-size: 3rem; opacity: 0.3;"></i><span style="font-weight: 600; font-size: 1.1rem;">Cart is empty</span></div>';

            if (document.getElementById('pos-subtotal')) document.getElementById('pos-subtotal').textContent = '0.00';
            if (document.getElementById('pos-total-discount')) document.getElementById('pos-total-discount').textContent = '0.00';
            if (document.getElementById('pos-net-total')) document.getElementById('pos-net-total').textContent = '0.00';

            if (countEl) countEl.textContent = '0 Items / 0 Qty';
            return;
        }

        tbody.innerHTML = this.posState.cart.map((item, index) => {
            // Determine step based on weighted property
            // We need to check the product from posState.products to be sure
            const prod = this.posState.products.find(p => p.id == item.product_id);
            const isWeighted = prod ? prod.weighted : false; // Safe fallback
            const step = isWeighted ? "0.01" : "1";

            const priceInput = (prod?.prices?.length > 1 && !item.is_free) ? `
                <select class="cart-qty-input premium-input" style="width: 100%; height: 32px; padding: 4px 8px; font-size: 0.8rem; border-color: rgba(0,0,0,0.05); background: white;" onchange="app.updateCartPriceLevel(${index}, this.value)">
                    ${prod.prices.map(p => `<option value="${p.id}" ${item.selected_price_id == p.id ? 'selected' : ''}>${p.label}: ${p.price.toFixed(2)}</option>`).join('')}
                    <option value="custom" ${item.is_custom_price ? 'selected' : ''}>Custom...</option>
                </select>
                ${item.is_custom_price ? `
                    <input type="number" class="cart-qty-input premium-input" style="width: 100%; height: 32px; margin-top: 4px; padding: 4px 8px; text-align: center; background: white; font-size: 0.9rem;" value="${item.msrp.toFixed(2)}" 
                        onchange="app.updateCartPrice(${index}, this.value)" step="0.01">
                ` : ''}
            ` : `
                <input type="number" class="cart-qty-input premium-input" style="width: 100%; height: 32px; padding: 4px 8px; text-align:center; background: white; font-size: 0.9rem;" value="${item.msrp.toFixed(2)}" 
                    onchange="app.updateCartPrice(${index}, this.value)" step="0.01" ${item.is_free ? 'disabled style="background: #f1f5f9; color: #94a3b8;"' : ''}>
            `;

            return `
            <div class="cart-item-card ${item.is_free ? 'is-free-issue' : ''}" style="background: white; border-radius: 12px; padding: 10px 14px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 2px 6px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 8px; position: relative;">
                
                <button class="btn btn-sm" onclick="app.removeFromCart(${index})" title="Remove Item" style="position: absolute; top: 12px; right: 12px; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: none; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                    <i class="fas fa-times" style="font-size: 0.8rem;"></i>
                </button>

                <div style="display: flex; flex-direction: column; padding-right: 35px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: #f1f5f9; color: #64748b; font-size: 0.65rem; font-weight: 800; padding: 3px 6px; border-radius: 4px;">#${index + 1}</span>
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.95rem; line-height: 1.1;">${item.product_name}</span>
                        ${item.is_free ? '<span class="free-badge-premium" style="zoom: 0.75; margin-left: auto;"><i class="fas fa-gift"></i> FREE</span>' : ''}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr auto 1.5fr 1fr 1.2fr; gap: 10px; align-items: end; background: #f8fafc; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.03);">
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.6rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Qty</label>
                        <input type="number" class="cart-qty-input premium-input" value="${item.quantity}" 
                            oninput="app.updateCartQty(${index}, this.value)" min="${isWeighted ? '0.01' : '1'}" step="${step}"
                            style="width: 100%; height: 32px; padding: 4px 8px; text-align: center; background: white; border: 1px solid rgba(0,0,0,0.08); font-size: 0.95rem;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; height: 100%;">
                        <label style="font-size: 0.6rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Free</label>
                        <input type="checkbox" class="free-issue-check" ${item.is_free ? 'checked' : ''} 
                            onchange="app.toggleFreeIssue(${index}, this.checked)" 
                            ${item.allow_free_issue !== 1 && !item.is_free ? 'disabled title="Free issue not allowed"' : ''}
                            style="width: 18px; height: 18px; margin-bottom: 6px; cursor: pointer; accent-color: var(--primary-green);">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.6rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Price (RS)</label>
                        ${priceInput}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.6rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Disc %</label>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="number" class="cart-qty-input premium-input" style="width: 100%; height: 32px; padding: 4px 20px 4px 8px; text-align: center; font-size: 0.95rem; background: white; border: 1px solid rgba(0,0,0,0.08);" value="${item.discount_percentage}" 
                                onchange="app.updateCartDiscount(${index}, this.value)" min="0" max="100" ${item.is_free ? 'disabled' : ''}>
                            <span style="position: absolute; right: 8px; font-size: 0.75rem; color: #94a3b8; font-weight: 700; pointer-events: none;">%</span>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; padding-bottom: 6px;">
                        <label style="font-size: 0.6rem; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 2px;">Line Total</label>
                        <strong style="font-size: 1.1rem; letter-spacing: -0.5px; color: ${item.is_free ? 'var(--primary-green)' : '#0f172a'};">${item.is_free ? '0.00' : item.line_total.toFixed(2)}</strong>
                    </div>

                </div>
            </div>
        `}).join('');

        let realSubtotal = 0;
        let realNetTotal = 0;

        this.posState.cart.forEach(item => {
            realSubtotal += item.quantity * item.msrp;
            realNetTotal += item.line_total;
        });

        const totalDiscount = realSubtotal - realNetTotal;
        const totalQty = this.posState.cart.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);

        if (document.getElementById('pos-subtotal')) document.getElementById('pos-subtotal').textContent = this.formatCurrency(realSubtotal);
        if (document.getElementById('pos-total-discount')) document.getElementById('pos-total-discount').textContent = '-' + this.formatCurrency(totalDiscount);
        if (document.getElementById('pos-net-total')) document.getElementById('pos-net-total').textContent = this.formatCurrency(realNetTotal);

        if (countEl) {
            countEl.textContent = `${this.posState.cart.length} Items / ${totalQty} Qty`;
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
                this.resetPOSCustomer(); // Ensure we don't accidentally bill the next transaction to this customer
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
        }
    }

    showCreditWarningModal(limit, currentDebt, available) {
        document.getElementById('cw-limit').textContent = this.formatCurrency(limit);
        document.getElementById('cw-balance').textContent = this.formatCurrency(currentDebt);
        document.getElementById('cw-available').textContent = this.formatCurrency(available);

        const modal = document.getElementById('credit-warning-modal');
        modal.classList.add('active');
        modal.style.display = 'flex';
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

        // --- CLIENT-SIDE CREDIT LIMIT CHECK ---
        const customerBalance = parseFloat(document.getElementById('pos-cust-balance')?.textContent.replace(/,/g, '')) || 0;
        // In POS UI, positive balance usually means 'Amount customer owes us'.
        // However, we need to verify how "Credit Limit" is stored vs "Balance".
        // Assuming customer object is stored in this.posState.selectedCustomer
        const customer = this.posState.selectedCustomer;

        if (credit > 0 && customer) {
            const limit = parseFloat(customer.credit_limit || 0);
            // If balance is debt, then (currentDebt + newCredit) must be <= Limit
            // If balance is credit (negative debt), logic handles accordingly.
            const currentDebt = customer.account_balance || 0;

            if (currentDebt + credit > limit) {
                // this.showNotification(`Credit Limit Exceeded! Available: ${(limit - currentDebt).toLocaleString()}. Limit: ${limit.toLocaleString()}`, 'error');
                this.showCreditWarningModal(limit, currentDebt, limit - currentDebt);
                return;
            }
        }
        // -------------------------------------

        const cashChange = Math.max(0, cash + chequeAmountTotal - total);
        const paymentData = {
            method: (cash > 0 && chequeAmountTotal === 0 && credit === 0) ? 'cash' :
                (cash === 0 && chequeAmountTotal > 0 && credit === 0) ? 'cheque' :
                    (cash === 0 && chequeAmountTotal === 0 && credit > 0) ? 'account' : 'split',
            details: {
                cash: cash,
                cheque: chequeAmountTotal,
                credit: credit,
                cheques: this.posState.tempCheques, // Send the array!
                cash_tendered: cash,
                cash_change: cashChange
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

    filterRecallList() {
        const input = document.getElementById('recall-search-input');
        const filter = input.value.toUpperCase();
        const list = document.getElementById('recall-list');
        const items = list.getElementsByClassName('invoice-list-item');

        for (let i = 0; i < items.length; i++) {
            const h4 = items[i].getElementsByTagName("h4")[0];
            if (h4) {
                const txtValue = h4.textContent || h4.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    items[i].style.display = "flex";
                } else {
                    items[i].style.display = "none";
                }
            }
        }
    }

    async deleteHeldInvoice(id) {
        if (!confirm('Are you sure you want to permanently delete this held invoice?')) return;

        try {
            const res = await this.apiCall(`/api/sales/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showNotification('Held invoice deleted', 'success');
                this.recallInvoiceModal(); // Refresh list
            } else {
                this.showNotification('Failed to delete', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Error deleting invoice', 'error');
        }
    }

    async recallInvoiceModal() {
        try {
            const res = await this.apiCall('/api/sales');
            const data = await res.json();
            const heldInvoices = (data.data || []).filter(inv => inv.status === 'held');

            if (heldInvoices.length === 0) {
                this.showNotification('No held invoices found', 'info');
                const modal = document.getElementById('recall-modal');
                if (modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }
                return;
            }

            const listContainer = document.getElementById('recall-list');
            if (listContainer) {
                listContainer.innerHTML = heldInvoices.map(inv => `
                    <div class="invoice-list-item" style="display:flex; justify-content:space-between; align-items:center; padding: 10px; border-bottom: 1px solid #eee;">
                        <div class="invoice-item-info">
                            <h4 style="margin:0;">${inv.invoice_number} <span style="font-weight:normal;">- ${inv.customer_name}</span></h4>
                            <span style="font-size:0.85rem; color:#64748b;">Date: ${new Date(inv.invoice_date).toLocaleDateString()} | Total: ${this.formatCurrency(inv.net_total)}</span>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-sm btn-primary" onclick="app.recallInvoice(${inv.id})">
                                Recall
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="app.deleteHeldInvoice(${inv.id})" title="Delete Permanently" style="background: #ef4444; color: white; border: none;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('');

                // Clear search input
                const searchInput = document.getElementById('recall-search-input');
                if (searchInput) searchInput.value = '';

                const modal = document.getElementById('recall-modal');
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Failed to fetch held invoices', 'error');
        }
    }

    async recallInvoice(id) {
        if (this.posState.cart.length > 0 && !confirm('Discard current cart and recall this invoice?')) {
            return;
        }

        try {
            const res = await this.apiCall(`/api/sales/${id}`);
            if (!res || !res.ok) throw new Error('Failed to fetch invoice data');

            const result = await res.json();
            const invoice = result.data;

            if (invoice) {
                // Set Invoice Metadata
                this.posState.currentInvoiceId = invoice.id;
                this.posState.selectedLoadId = invoice.load_id;
                if (invoice.invoice_date) {
                    document.getElementById('pos-date').value = invoice.invoice_date.split('T')[0];
                }

                // Load Truck Stock if applicable
                if (invoice.load_id) {
                    const loadSelector = document.getElementById('pos-load-selector');
                    if (loadSelector) loadSelector.value = invoice.load_id;
                    await this.loadTruckStock(invoice.load_id);
                }

                // Restore Customer
                if (invoice.customer_id) {
                    const customerRes = await this.apiCall(`/api/customers/${invoice.customer_id}`);
                    const customerData = await customerRes.json();
                    if (customerData.success && Array.isArray(customerData.data) && customerData.data.length > 0) {
                        await this.selectPOSCustomer(customerData.data[0]);
                    }
                }

                // Restore Cart Items
                this.posState.cart = invoice.items.map(item => {
                    // Try to match product in currently loaded products to get current metadata
                    const availableProducts = Array.isArray(this.posState.products) ? this.posState.products : [];
                    const product = availableProducts.find(p => p.id === item.product_id);

                    let allowedDiscount = 0;
                    let weighted = false;
                    let allowFreeIssue = 1;

                    if (product) {
                        weighted = product.weighted;
                        allowFreeIssue = product.allow_free_issue;
                        const priceLevel = (product.prices || []).find(p => p.price == item.msrp) || { supplier_discount: product.supplier_discount || 0 };
                        allowedDiscount = priceLevel.supplier_discount || 0;
                    }

                    return {
                        product_id: item.product_id,
                        product_name: item.product_name,
                        batch_number: item.batch_number,
                        msrp: item.msrp,
                        quantity: item.quantity,
                        discount_percentage: item.discount_percentage,
                        discount_amount: item.discount_amount,
                        is_free: item.is_free === 1,
                        line_total: item.line_total,
                        weighted: weighted,
                        allow_free_issue: allowFreeIssue,
                        allowed_discount: allowedDiscount,
                        selected_price_id: null
                    };
                });

                // Update UI
                this.updateCartUI();

                // Close modal safely (hide, do not remove)
                const modal = document.getElementById('recall-modal');
                if (modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                }

                this.showNotification('Invoice recalled successfully', 'success');
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Failed to recall invoice: ' + (e.message || 'Unknown Error'), 'error');
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
            const upc = parseFloat(existingRow.dataset.upc || 1);
            qtyInput.value = parseFloat(qtyInput.value) + upc;
            this.updatePreOrderCartonsFromQty(qtyInput);
            this.calculatePreOrderTotal();
            return;
        }

        const upc = product.units_per_carton || 1;
        const row = document.createElement('tr');
        row.dataset.id = product.id;
        row.dataset.name = product.name;
        row.dataset.unit = product.unit || '';
        row.dataset.upc = upc;
        row.dataset.weighted = product.weighted ? 'true' : 'false';
        row.innerHTML = `
            <td>${product.name}</td>
            <td><input type="number" class="form-control item-price" value="${product.msrp || 0}" step="any" oninput="app.calculatePreOrderTotal()"></td>
            <td><input type="number" class="form-control item-cartons" value="1" step="any" oninput="app.updatePreOrderQtyFromCartons(this)" onblur="app.enforcePreOrderMinimums(this)"></td>
            <td><input type="number" class="form-control item-qty" value="${upc}" step="any" oninput="app.updatePreOrderCartonsFromQty(this)" onblur="app.enforcePreOrderMinimums(this)"></td>
            <td class="item-total">0.00</td>
            <td>
                <button type="button" class="btn-icon text-error" onclick="this.closest('tr').remove(); app.calculatePreOrderTotal();">
                    <i class="fas fa-minus-circle"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
        this.calculatePreOrderTotal();
    }

    updatePreOrderQtyFromCartons(input) {
        const row = input.closest('tr');
        const upc = parseFloat(row.dataset.upc || 1);
        let cartons = parseFloat(input.value || 0);

        // If user is typing 0.x, we let them type, but for calculation/sync:
        const effectiveCartons = (cartons > 0 && cartons < 1) ? 1 : cartons;

        const qtyInput = row.querySelector('.item-qty');
        qtyInput.value = (effectiveCartons * upc).toFixed(2);

        // If it was forced to 1 effectively, we should probably update the field too if they are not active on it
        // But for now, just ensure calculation is correct.

        this.calculatePreOrderTotal();
    }

    updatePreOrderCartonsFromQty(input) {
        const row = input.closest('tr');
        const upc = parseFloat(row.dataset.upc || 1);
        let qty = parseFloat(input.value || 0);
        const isWeighted = row.dataset.weighted === 'true';

        // Enforce integer for non-weighted
        if (!isWeighted && qty > 0 && !Number.isInteger(qty)) {
            qty = Math.round(qty);
            input.value = qty;
        }

        const cartonInput = row.querySelector('.item-cartons');

        // Effective minimum of 1 carton worth of units
        const effectiveQty = (qty > 0 && qty < upc) ? upc : qty;

        if (upc > 0) {
            const calculatedCartons = effectiveQty / upc;
            if (Number.isInteger(calculatedCartons)) {
                cartonInput.value = calculatedCartons;
            } else {
                cartonInput.value = calculatedCartons.toFixed(2);
            }
        } else {
            cartonInput.value = '';
        }
        this.calculatePreOrderTotal();
    }

    enforcePreOrderMinimums(input) {
        const row = input.closest('tr');
        const upc = parseFloat(row.dataset.upc || 1);

        if (input.classList.contains('item-cartons')) {
            let cartons = parseFloat(input.value || 0);
            if (cartons > 0 && cartons < 1) {
                input.value = 1;
                const qtyInput = row.querySelector('.item-qty');
                qtyInput.value = upc;
            }
        } else if (input.classList.contains('item-qty')) {
            let qty = parseFloat(input.value || 0);
            if (qty > 0 && qty < upc) {
                input.value = upc;
                const cartonInput = row.querySelector('.item-cartons');
                cartonInput.value = 1;
            }
        }
        this.calculatePreOrderTotal();
    }

    calculatePreOrderTotal() {
        let grandTotal = 0;
        document.querySelectorAll('#po-items-body tr').forEach(row => {
            const upc = parseFloat(row.dataset.upc || 1);
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            let qty = parseFloat(row.querySelector('.item-qty').value) || 0;

            // Treat < 1 carton as 1 full carton for the total calculation
            if (qty > 0 && qty < upc) {
                qty = upc;
            }

            const total = price * qty;
            row.querySelector('.item-total').textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
            grandTotal += total;
        });
        document.getElementById('po-total-display').textContent = grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    async handlePreOrderSubmit(e) {
        e.preventDefault();

        // Before submitting, force all minimums again
        document.querySelectorAll('#po-items-body tr').forEach(row => {
            const upc = parseFloat(row.dataset.upc || 1);
            const qtyInput = row.querySelector('.item-qty');
            const cartonInput = row.querySelector('.item-cartons');
            let qty = parseFloat(qtyInput.value || 0);
            if (qty > 0 && qty < upc) {
                qtyInput.value = upc;
                cartonInput.value = 1;
            }
        });
        this.calculatePreOrderTotal();

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
                const truckProd = this.posState.products.find(p => p.id == item.product_id);
                // Fallback discount if we can't find specific ones yet 
                // (though selecting customer later will refresh this)
                const disc = (this.posState.customerDiscounts || {})[item.product_id] || { percentage: 0, amount: 0 };

                // Find primary price or just use msrp from product if price list missing in truck context
                let targetPrice = truckProd?.prices?.find(p => p.is_primary) || truckProd;
                const msrp = item.price || truckProd?.msrp || 0;
                const allowed = targetPrice?.supplier_discount || truckProd?.supplier_discount || 0;

                return {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    msrp: msrp,
                    quantity: item.quantity,
                    batch_number: targetPrice?.batch_number || null,
                    discount_percentage: disc.percentage,
                    discount_amount: msrp * (disc.percentage / 100) * item.quantity,
                    is_free: false,
                    line_total: item.quantity * msrp * (1 - (disc.percentage / 100)),
                    weighted: truckProd?.weighted || false,
                    allow_free_issue: truckProd?.allow_free_issue ?? 1,
                    allowed_discount: allowed,
                    selected_price_id: targetPrice?.id || null
                };
            });

            // Select customer in POS
            const cust = this.posState.customers.find(c => c.id == order.customer_id);
            if (cust) {
                await this.selectPOSCustomer(cust);
            } else {
                this.posState.selectedCustomerId = order.customer_id;
            }

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
        const modal = document.getElementById('cheque-status-modal');
        modal.style.display = 'flex';
        modal.classList.add('active');
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

        if (!res || !res.ok) {
            this.showNotification('Failed to update cheque status', 'error');
            return;
        }

        const data = await res.json();
        if (data.success) {
            this.showNotification('Cheque status updated successfully', 'success');
            const modal = document.getElementById('cheque-status-modal');
            modal.classList.remove('active');
            modal.style.display = 'none';
            this.loadBankingCheques();
        } else {
            this.showNotification(data.error || 'Failed to update cheque status', 'error');
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

        this.showNotification('Analyzing customer behavior patterns...', 'info');

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=customer_intelligence&dateFrom=${from}&dateTo=${to}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const { metrics, cohort, outstanding } = data.data;

                // 1. Update KPIs with Animation
                const counters = [
                    { id: 'ci-new-count', val: (cohort.new_customers || 0) },
                    { id: 'ci-inactive-count', val: (cohort.inactive_customers || 0) },
                    { id: 'ci-total-outstanding', val: this.formatCurrency(outstanding.total_outstanding || 0) },
                    { id: 'ci-over-limit', val: (outstanding.over_limit_count || 0) }
                ];

                counters.forEach(c => {
                    if (document.getElementById(c.id)) document.getElementById(c.id).textContent = c.val;
                });

                if (document.getElementById('ci-over-limit-amt')) {
                    document.getElementById('ci-over-limit-amt').textContent = this.formatCurrency(outstanding.over_limit_amount || 0) + ' Excess';
                }

                // 2. Render Charts
                this.renderCICharts(metrics, cohort);

                // 3. Render Table
                this.renderCITable(metrics);

                this.showNotification('Customer intelligence analysis complete', 'success');
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

        if (metrics.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 30px;">No customer data found for this period.</td></tr>';
            return;
        }

        tbody.innerHTML = metrics.map(m => {
            const usagePercent = Math.round(m.credit_usage_percent || 0);

            // Logic for bar color
            const barColor = usagePercent > 100 ? '#ef4444' : (usagePercent > 75 ? '#f59e0b' : '#3b82f6');

            const lastDate = m.last_purchase ? new Date(m.last_purchase) : null;
            const now = new Date();
            const daysSince = lastDate ? Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)) : 999;

            let statusBadge = '<span class="badge" style="background: #ecfdf5; color: #10b981;">ACTIVE</span>';
            if (daysSince > 30) statusBadge = '<span class="badge" style="background: #fffbeb; color: #b45309;">DORMANT</span>';
            if (daysSince > 90) statusBadge = '<span class="badge" style="background: #fef2f2; color: #ef4444;">LOST</span>';

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <td style="padding: 16px 24px;">
                        <div style="font-weight: 700; color: #1e293b;">${m.name}</div>
                        <small style="color: #94a3b8; font-size: 0.75rem;">ID: #${m.id}</small>
                    </td>
                    <td class="text-right" style="padding: 16px 24px;">
                        <span style="font-weight: 700; color: #0f172a;">${this.formatCurrency(m.lifetime_value || 0)}</span>
                    </td>
                    <td class="text-center" style="padding: 16px 24px;">
                        <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; color: #475569;">${m.period_orders || 0}</span>
                    </td>
                    <td class="text-right" style="padding: 16px 24px;">
                        <span style="font-weight: 700; color: ${m.balance > 0 ? '#ef4444' : '#64748b'}">${this.formatCurrency(m.balance || 0)}</span>
                    </td>
                    <td style="padding: 16px 24px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="flex-grow: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                <div style="width: ${Math.min(usagePercent, 100)}%; height: 100%; background: ${barColor}; border-radius: 3px;"></div>
                            </div>
                            <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; width: 40px; text-align: right;">${usagePercent}%</span>
                        </div>
                    </td>
                    <td class="text-center" style="padding: 16px 24px;">
                        <div style="font-size: 0.85rem; color: #475569; font-weight: 500;">${m.last_purchase ? daysSince + ' days ago' : 'Never'}</div>
                        <small style="color: #94a3b8; font-size: 0.7rem;">${m.last_purchase || '--'}</small>
                    </td>
                    <td class="text-center" style="padding: 16px 24px;">${statusBadge}</td>
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

        this.showNotification('Synchronizing warehouse and logistics data...', 'info');

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

                // Improve accuracy calculation: (Delivered + Returned) / Loaded
                // If loaded is 0, ignore
                let accuracySum = 0;
                let accuracyCount = 0;
                loadMetrics.forEach(m => {
                    if (m.loaded > 0) {
                        const rec = (m.delivered || 0) + (m.returned || 0);
                        // Cap at 100% logic or allow >100 if surplus? Usually 100 is max ideal. 
                        // Let's use simple match rate. 1 - abs(variance)/loaded
                        const match = 1 - (Math.abs(m.total_variance || 0) / m.loaded);
                        accuracySum += (match * 100);
                        accuracyCount++;
                    }
                });
                const avgAccuracy = accuracyCount > 0 ? (accuracySum / accuracyCount) : 100;

                // Animate Counters
                const counters = [
                    { id: 'ii-total-loaded', val: totalLoaded.toLocaleString() },
                    { id: 'ii-total-delivered', val: totalDelivered.toLocaleString() },
                    { id: 'ii-variance-count', val: totalVariance.toLocaleString() },
                    { id: 'ii-avg-accuracy', val: Math.round(avgAccuracy) + '%' }
                ];
                counters.forEach(c => {
                    if (document.getElementById(c.id)) document.getElementById(c.id).textContent = c.val;
                });

                // 2. Render Charts
                this.renderIICharts(loadMetrics, trends);

                // 3. Render Table
                this.renderIITable(loadMetrics);

                // 4. Render Reorder Alerts
                this.renderReorderAlerts(reorderAlerts);

                this.showNotification('Logistics intelligence analysis complete', 'success');
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

        // Show only those with low stock or highly active sales
        // let's adjust threshold or logic inside logic
        const filtered = alerts.filter(a => a.current_stock < 100);

        if (filtered.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; font-size: 0.9rem; text-align: center; font-style: italic;">No active stock warnings.</p>';
            return;
        }

        container.innerHTML = filtered.map(a => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fff; border: 1px solid #fee2e2; border-radius: 12px; transition: all 0.2s; cursor: default;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="width: 36px; height: 36px; background: #fef2f2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                        <i class="fas fa-boxes"></i>
                    </div>
                    <div>
                        <h5 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: #1e293b;">${a.name}</h5>
                        <div style="display: flex; gap: 8px; margin-top: 2px;">
                            <span style="font-size: 0.7rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
                                <i class="fas fa-bolt" style="font-size: 0.6rem; color: #f59e0b;"></i> ${a.weekly_sales || 0} / wk
                            </span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 1rem; font-weight: 800; color: #ef4444;">${a.current_stock}</span>
                    <small style="display: block; font-size: 0.65rem; color: #ef4444; opacity: 0.8; font-weight: 600;">CRITICAL</small>
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

        // Add loading state to button if feasible or simple notification
        this.showNotification('Crunching predictive models...', 'info');

        try {
            const res = await this.apiCall(`/api/reports/sales-analytics?type=demand_forecast&dateFrom=${from}&dateTo=${to}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                const { productDemand, fulfillment, routeForecast, leadTime } = data.data;

                // Animate KPI Updates
                const counters = [
                    { id: 'df-fulfillment-rate', val: (fulfillment.total_preorders > 0 ? Math.round((fulfillment.fulfilled_count / fulfillment.total_preorders) * 100) : 100), suffix: '%' },
                    { id: 'df-backorder-rate', val: (fulfillment.total_preorders > 0 ? Math.round((fulfillment.backorder_count / fulfillment.total_preorders) * 100) : 0), suffix: '%' },
                ];

                // Simple counter update logic
                counters.forEach(c => {
                    if (document.getElementById(c.id))
                        document.getElementById(c.id).textContent = c.val + c.suffix;
                });

                if (document.getElementById('df-fulfilled-count'))
                    document.getElementById('df-fulfilled-count').innerHTML = `<i class="fas fa-check-circle"></i> ${fulfillment.fulfilled_count} Orders Completed`;

                if (document.getElementById('df-backorder-count'))
                    document.getElementById('df-backorder-count').innerHTML = `<i class="fas fa-clock"></i> ${fulfillment.backorder_count} Pending`;

                if (document.getElementById('df-lost-revenue'))
                    document.getElementById('df-lost-revenue').textContent = this.formatCurrency(fulfillment.lost_revenue_estimate || 0);

                if (document.getElementById('df-avg-lead'))
                    document.getElementById('df-avg-lead').textContent = `${leadTime} Days`;

                // 2. Render Charts
                this.renderDFCharts(productDemand, routeForecast);

                // 3. Render Table
                this.renderDFTable(productDemand);

                // Store for export
                this.lastDemandForecastData = productDemand;

                this.showNotification('Demand intelligence analysis complete', 'success');
            }
        } catch (err) {
            console.error('Demand Forecast load error:', err);
            this.showNotification('Failed to load forecasting data', 'error');
        }
    }

    downloadDemandReport() {
        if (!this.lastDemandForecastData || this.lastDemandForecastData.length === 0) {
            this.showNotification('No data available to export. Please run analysis first.', 'warning');
            return;
        }

        const csvContent = [
            ['Product Model', 'Forecasted Demand', 'Fulfilled', 'Gap (Backorder)', 'Trend'],
            ...this.lastDemandForecastData.map(p => {
                const gap = Math.max(0, p.pre_ordered - p.actual_sales);
                const trend = p.pre_ordered > p.actual_sales ? 'High Demand' : 'Fulfilled';
                return [p.label, p.pre_ordered, p.actual_sales, gap, trend];
            })
        ].map(e => e.join(",")).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `demand_forecast_report_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    async loadCustomerMap() {
        const mapContainer = document.getElementById('customer-leaflet-map');
        if (!mapContainer) return;

        // Ensure Leaflet is loaded
        if (typeof L === 'undefined') {
            this.showNotification('Map library (Leaflet) not loaded.', 'error');
            return;
        }

        try {
            // 1. Fetch ALL customers (limit to a large number to get all on map)
            const res = await this.apiCall('/api/customers?limit=2000');
            if (!res) return;
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            const customers = data.data;
            const located = customers.filter(c => c.latitude && c.longitude);

            // Update stats
            document.getElementById('map-total-count').textContent = customers.length;
            document.getElementById('map-located-count').textContent = located.length;
            document.getElementById('map-unlocated-count').textContent = customers.length - located.length;

            // 2. Initialize or Refresh Map
            if (this.customerMap) {
                this.customerMap.remove();
            }

            // Default center (Sri Lanka approximate center if no customers, otherwise center of located items)
            let center = [7.8731, 80.7718]; // Sri Lanka
            let zoom = 8;

            if (located.length > 0) {
                // Calculate average center
                const avgLat = located.reduce((sum, c) => sum + parseFloat(c.latitude), 0) / located.length;
                const avgLng = located.reduce((sum, c) => sum + parseFloat(c.longitude), 0) / located.length;
                center = [avgLat, avgLng];
                zoom = 10;
            }

            this.customerMap = L.map('customer-leaflet-map').setView(center, zoom);

            // Add tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.customerMap);

            // 3. Add Markers
            const markers = [];
            located.forEach(c => {
                const color = c.status === 'active' ? '#1b5e20' : '#d32f2f'; // Green for active, Red for blocked

                const customIcon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });

                const marker = L.marker([c.latitude, c.longitude], { icon: customIcon })
                    .bindPopup(`
                        <div style="font-family: inherit; padding: 5px;">
                            <strong style="font-size: 1.1rem; color: var(--primary-green-dark);">${c.name}</strong><br>
                            <span style="color: #666; font-size: 0.8rem;">${c.address || 'No address'}</span><br>
                            <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span class="badge badge-${c.status === 'active' ? 'success' : 'danger'}" style="font-size: 0.7rem;">${c.status.toUpperCase()}</span>
                                <span style="font-weight: 700; color: #333;">LKR ${parseFloat(c.account_balance).toLocaleString()}</span>
                            </div>
                            <button class="btn btn-sm btn-primary" style="width: 100%; border-radius: 4px; padding: 4px;" onclick="app.openCustomerModalById(${c.id})">
                                <i class="fas fa-edit"></i> Edit Customer
                            </button>
                        </div>
                    `);

                marker.addTo(this.customerMap);
                markers.push(marker);
            });

            // Adjust view to fit all markers if multiple
            if (markers.length > 1) {
                const group = new L.featureGroup(markers);
                this.customerMap.fitBounds(group.getBounds().pad(0.1));
            }

        } catch (err) {
            console.error(err);
            this.showNotification('Failed to load customer map: ' + err.message, 'error');
        }
    }

    async openCustomerModalById(id) {
        try {
            const res = await this.apiCall(`/api/customers/${id}`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                this.openCustomerModal(data.data);
            }
        } catch (e) {
            this.showNotification('Failed to fetch customer data', 'error');
        }
    }

    captureCustomerLocation() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }

        const btn = document.getElementById('get-location-btn');
        const icon = btn.querySelector('i');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('c-lat').value = position.coords.latitude.toFixed(6);
                document.getElementById('c-lng').value = position.coords.longitude.toFixed(6);

                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check"></i> Success';
                btn.style.backgroundColor = 'var(--success)';
                btn.style.color = 'white';

                this.showNotification('Location captured successfully!', 'success');

                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                }, 3000);
            },
            (error) => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                this.showNotification('Geolocation error: ' + error.message, 'error');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new AgroDistributionApp(); });
