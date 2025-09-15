// assets/js/app.js

class App {
    constructor() {
        this.init();
    }

    async init() {
        // Initialize all modules
        Auth.init();
        Navigation.init();

        // Check authentication on load
        await this.checkInitialAuth();
    }

    async checkInitialAuth() {
        const token = localStorage.getItem('token');
        
        if (token) {
            try {
                const isValid = await Auth.validateToken();
                
                if (isValid) {
                    document.getElementById('auth-container').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');
                    document.getElementById('user-name').textContent = 'Loading...';
                    
                    // Load default tab (targets)
                    Navigation.switchTab('targets');
                } else {
                    this.showAuthContainer();
                }
            } catch (error) {
                console.error('Token validation failed:', error);
                this.showAuthContainer();
            }
        } else {
            this.showAuthContainer();
        }
    }

    showAuthContainer() {
        localStorage.removeItem('token');
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});