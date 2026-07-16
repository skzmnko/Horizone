import AuthService from '../services/auth-service.js';

class LoginPage {
    constructor() {
        this.container = null;
        this.onLoginSuccess = null;
    }

    initialize(onLoginSuccess) {
        this.onLoginSuccess = onLoginSuccess;
        this.render();
        this.bindEvents();
    }

    render() {
        this.container = document.createElement('div');
        this.container.id = 'login-page';
        this.container.className = 'login-page';

        this.container.innerHTML = `
            <div class="login-container">
                <div class="login-header">
                    <img src="/logo.png" alt="Trace & Place" style="width:120px; height:120px; object-fit:contain; display:block; margin:0 auto 12px;">
                    <h1>Trace & Place</h1>
                    <p>Interactive Maps</p>
                </div>

                <form id="login-form" class="login-form">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            autocomplete="username"
                            placeholder="you@example.com"
                        >
                    </div>

                    <div class="form-group">
                        <label for="password">Пароль</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            autocomplete="current-password"
                            placeholder="Пароль"
                        >
                    </div>

                    <button type="submit" class="login-btn" id="login-submit">
                        <span class="btn-text">Войдите в мир</span>
                    </button>
                </form>

                <div id="login-error" class="error-message hidden"></div>

                <div class="login-footer">
                    <p>Выберите свой путь</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        setTimeout(() => {
            const emailInput = document.getElementById('email');
            if (emailInput) emailInput.focus();
        }, 100);
    }

    bindEvents() {
        const loginForm = document.getElementById('login-form');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.hideError();
            });
        });
    }

    async handleLogin() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('login-submit');
        const btnText = loginBtn.querySelector('.btn-text');

        this.hideError();

        loginBtn.classList.add('loading');
        btnText.textContent = 'Вход...';
        loginBtn.disabled = true;

        // AuthService.login теперь асинхронный — ждём ответа от Supabase
        const result = await AuthService.login(email, password);

        loginBtn.classList.remove('loading');
        btnText.textContent = 'Войдите в мир';
        loginBtn.disabled = false;

        if (result.success) {
            console.log(`🎉 Welcome, ${result.user.displayName}!`);
            this.showSuccessAnimation();

            setTimeout(() => {
                this.hide();
                if (this.onLoginSuccess) {
                    this.onLoginSuccess();
                }
            }, 600);
        } else {
            this.showError(result.error);
            this.shakeForm();
        }
    }

    showError(message) {
        const errorElement = document.getElementById('login-error');
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }

    hideError() {
        const errorElement = document.getElementById('login-error');
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
    }

    showSuccessAnimation() {
        const loginContainer = document.querySelector('.login-container');
        loginContainer.style.animation = 'none';
        setTimeout(() => {
            loginContainer.style.animation = 'slideUp 0.6s ease-out, successGlow 1s ease-in-out';
        }, 10);
    }

    shakeForm() {
        const loginForm = document.getElementById('login-form');
        loginForm.style.animation = 'none';
        setTimeout(() => {
            loginForm.style.animation = 'shake 0.5s ease-in-out';
        }, 10);
    }

    show() {
        if (this.container) {
            this.container.classList.remove('hidden');
        }
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default LoginPage;