import AuthService from '../services/auth-service.js';

class LoginPage {
    constructor() {
        this.container = null;
        this.onLoginSuccess = null;
        this.mode = 'login'; // 'login' | 'register' | 'reset'
    }

    initialize(onLoginSuccess) {
        this.onLoginSuccess = onLoginSuccess;
        this.render();
        this.bindEvents();
    }

    setMode(mode) {
        this.mode = mode;
        this.render();
        this.bindEvents();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.id = 'login-page';
        this.container.className = 'login-page';

        this.container.innerHTML = `
            <div class="login-container">
                <div class="login-header">
                    <img src="/logo.png" alt="Trace & Place" class="login-logo">
                    <h1>Trace & Place</h1>
                    <p>Interactive Maps</p>
                </div>

                ${this.renderForm()}

                <div id="login-error" class="error-message hidden"></div>
                <div id="login-info" class="error-message hidden"></div>

                <div class="login-footer">
                    ${this.renderFooterLinks()}
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        setTimeout(() => {
            const firstInput = this.container.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    renderForm() {
        if (this.mode === 'register') {
            return `
                <form id="login-form" class="login-form">
                    <div class="form-group">
                        <label for="display-name">Отображаемое имя</label>
                        <input type="text" id="display-name" name="display-name" required placeholder="Как тебя называть">
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required autocomplete="username" placeholder="you@example.com">
                    </div>
                    <div class="form-group">
                        <label for="password">Пароль</label>
                        <input type="password" id="password" name="password" required autocomplete="new-password" placeholder="Минимум 6 символов">
                    </div>
                    <div class="form-group">
                        <label for="password-confirm">Повтори пароль</label>
                        <input type="password" id="password-confirm" name="password-confirm" required autocomplete="new-password" placeholder="Ещё раз">
                    </div>
                    <button type="submit" class="login-btn" id="login-submit">
                        <span class="btn-text">Зарегистрироваться</span>
                    </button>
                </form>
            `;
        }

        if (this.mode === 'reset') {
            return `
                <form id="login-form" class="login-form">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required autocomplete="username" placeholder="you@example.com">
                    </div>
                    <button type="submit" class="login-btn" id="login-submit">
                        <span class="btn-text">Отправить письмо</span>
                    </button>
                </form>
            `;
        }

        // login
        return `
            <form id="login-form" class="login-form">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autocomplete="username" placeholder="you@example.com">
                </div>
                <div class="form-group">
                    <label for="password">Пароль</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="Пароль">
                </div>
                <button type="submit" class="login-btn" id="login-submit">
                    <span class="btn-text">Войдите в мир</span>
                </button>
            </form>
        `;
    }

    renderFooterLinks() {
        if (this.mode === 'register') {
            return `<button type="button" class="login-back-link" id="switch-to-login">Уже есть аккаунт? Войти</button>`;
        }
        if (this.mode === 'reset') {
            return `<button type="button" class="login-back-link" id="switch-to-login">Вспомнили пароль? Войти</button>`;
        }
        return `
            <button type="button" class="login-back-link" id="switch-to-register">Нет аккаунта? Зарегистрироваться</button>
            <br>
            <button type="button" class="login-back-link" id="switch-to-reset">Забыли пароль?</button>
        `;
    }

    bindEvents() {
        const loginForm = document.getElementById('login-form');

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.hideError();
                this.hideInfo();
            });
        });

        const switchToRegister = document.getElementById('switch-to-register');
        if (switchToRegister) switchToRegister.addEventListener('click', () => this.setMode('register'));

        const switchToReset = document.getElementById('switch-to-reset');
        if (switchToReset) switchToReset.addEventListener('click', () => this.setMode('reset'));

        const switchToLogin = document.getElementById('switch-to-login');
        if (switchToLogin) switchToLogin.addEventListener('click', () => this.setMode('login'));
    }

    async handleSubmit() {
        if (this.mode === 'register') return this.handleRegister();
        if (this.mode === 'reset') return this.handleReset();
        return this.handleLogin();
    }

    async handleLogin() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        this.hideError();
        this.setLoading(true, 'Вход...');

        const result = await AuthService.login(email, password);

        this.setLoading(false, 'Войдите в мир');

        if (result.success) {
            console.log(`🎉 Welcome, ${result.user.displayName}!`);
            this.showSuccessAnimation();
            setTimeout(() => {
                this.hide();
                if (this.onLoginSuccess) this.onLoginSuccess();
            }, 600);
        } else {
            this.showError(result.error);
            this.shakeForm();
        }
    }

    async handleRegister() {
        const displayName = document.getElementById('display-name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;

        this.hideError();

        if (!displayName) {
            this.showError('Введи отображаемое имя');
            return;
        }

        if (password !== passwordConfirm) {
            this.showError('Пароли не совпадают');
            this.shakeForm();
            return;
        }

        if (password.length < 6) {
            this.showError('Пароль должен быть не короче 6 символов');
            return;
        }

        this.setLoading(true, 'Проверка...');

        const nameAvailable = await AuthService.checkDisplayNameAvailable(displayName);
        if (!nameAvailable) {
            this.setLoading(false, 'Зарегистрироваться');
            this.showError('Это имя уже занято — выбери другое');
            return;
        }

        this.setLoading(true, 'Регистрация...');

        const result = await AuthService.signUp(email, password, displayName);

        this.setLoading(false, 'Зарегистрироваться');

        if (!result.success) {
            this.showError(result.error);
            this.shakeForm();
            return;
        }

        if (result.needsEmailConfirmation) {
            this.setMode('login');
            this.showInfo('Почти готово! Мы отправили письмо на ' + email + ' — перейди по ссылке из письма, чтобы подтвердить регистрацию, и затем войди.');
            return;
        }

        console.log(`🎉 Welcome, ${displayName}!`);
        this.showSuccessAnimation();
        setTimeout(() => {
            this.hide();
            if (this.onLoginSuccess) this.onLoginSuccess();
        }, 600);
    }

    async handleReset() {
        const email = document.getElementById('email').value.trim();

        this.hideError();
        this.setLoading(true, 'Отправка...');

        const result = await AuthService.resetPassword(email);

        this.setLoading(false, 'Отправить письмо');

        if (result.success) {
            this.showInfo('Если аккаунт с таким email существует, письмо со ссылкой для сброса пароля уже отправлено.');
        } else {
            this.showError(result.error);
        }
    }

    setLoading(isLoading, text) {
        const loginBtn = document.getElementById('login-submit');
        const btnText = loginBtn.querySelector('.btn-text');
        loginBtn.disabled = isLoading;
        loginBtn.classList.toggle('loading', isLoading);
        btnText.textContent = text;
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

    showInfo(message) {
        const el = document.getElementById('login-info');
        el.className = 'error-message login-info'; // добавляем класс login-info
        el.textContent = message;
        el.classList.remove('hidden');
    }

    hideInfo() {
        const el = document.getElementById('login-info');
        el.textContent = '';
        el.classList.add('hidden');
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