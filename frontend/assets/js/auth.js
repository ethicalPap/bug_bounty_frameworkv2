// assets/js/auth.js

const Auth = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Auth form submission
        document.getElementById('auth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            Utils.setButtonLoading('auth-submit-btn', true);
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                if (AppState.isRegistering) {
                    const fullName = document.getElementById('fullName').value;
                    const organizationName = document.getElementById('organizationName').value;
                    await this.register(email, password, fullName, organizationName);
                } else {
                    await this.login(email, password);
                }
            } finally {
                Utils.setButtonLoading('auth-submit-btn', false);
            }
        });

        // Toggle between login and register
        document.getElementById('toggle-auth').addEventListener('click', () => {
            this.toggleAuthMode();
        });
    },

    toggleAuthMode() {
        const registerFields = document.getElementById('register-fields');
        const submitBtn = document.getElementById('auth-submit-btn');
        const toggleBtn = document.getElementById('toggle-auth');
        
        if (AppState.isRegistering) {
            registerFields.classList.add('hidden');
            submitBtn.textContent = 'Login';
            toggleBtn.textContent = 'Register';
            AppState.isRegistering = false;
        } else {
            registerFields.classList.remove('hidden');
            submitBtn.textContent = 'Register';
            toggleBtn.textContent = 'Login';
            AppState.isRegistering = true;
        }
    },

    async login(email, password) {
        try {
            const response = await API.auth.login(email, password);
            const data = await response.json();
            
            if (response.ok && data.user) {
                localStorage.setItem('token', data.accessToken);
                AppState.currentUser = data.user;
                this.showDashboard();
            } else {
                Utils.showMessage('Login failed: ' + (data.error || data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            Utils.showMessage('Login failed: ' + error.message, 'error');
        }
    },

    async register(email, password, fullName, organizationName) {
        try {
            const response = await API.auth.register(email, password, fullName, organizationName);
            const data = await response.json();
            
            if (response.ok && data.user) {
                localStorage.setItem('token', data.accessToken);
                AppState.currentUser = data.user;
                this.showDashboard();
            } else {
                Utils.showMessage('Registration failed: ' + (data.error || data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Utils.showMessage('Registration failed: ' + error.message, 'error');
        }
    },

    logout() {
        localStorage.removeItem('token');
        AppState.currentUser = null;
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        
        // Clear any running intervals
        if (AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }
    },

    showDashboard() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('user-name').textContent = AppState.currentUser.fullName || AppState.currentUser.email;
        
        // Load initial content (targets is the default tab)
        Navigation.switchTab('targets');
    },

    async validateToken() {
        const token = localStorage.getItem('token');
        if (!token) {
            return false;
        }

        try {
            const response = await API.targets.getAll();
            if (response && response.ok) {
                return true;
            } else {
                localStorage.removeItem('token');
                return false;
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            localStorage.removeItem('token');
            return false;
        }
    }
};

// Global logout function for onclick handlers
window.logout = () => Auth.logout();
window.Auth = Auth;