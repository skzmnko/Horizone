import AuthService from '../services/auth-service.js';

class ResetPasswordPage {
    constructor() {
        this.container = null;
        this.onDone = null;
    }

    initialize(onDone) {
        this.onDone = onDone;
        this.render();
        this.bindEvents();
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'login-page';
        this.container.innerHTML = `
            <div class="login-container">
                <div class="login-header">
                    <img src="/logo.png" alt="Trace & Place" class="login-logo">
                    <h1>Новый пароль</h1>
                    <p>Придумай новый пароль для входа</p>
                </div>

                <form id="reset-password-form" class="login-form">
                    <div class="form-group">
                        <label for="new-password">Новый пароль</label>
                        <input type="password" id="new-password" name="new-password" required autocomplete="new-password" placeholder="Минимум 6 символов">
                    </div>

                    <div class="form-group">
                        <label for="new-password-confirm">Повтори пароль</label>
                        <input type="password" id="new-password-confirm" name="new-password-confirm" required autocomplete="new-password" placeholder="Ещё раз">
                    </div>

                    <button type="submit" class="login-btn" id="reset-password-submit">
                        <span class="btn-text">Сохранить пароль</span>
                    </button>
                </form>

                <div id="reset-password-error" class="error-message hidden"></div>
            </div>
        `;
        document.body.appendChild(this.container);
    }

    bindEvents() {
        const form = document.getElementById('reset-password-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    async handleSubmit() {
        const password = document.getElementById('new-password').value;
        const confirm = document.getElementById('new-password-confirm').value;
        const btn = document.getElementById('reset-password-submit');
        const btnText = btn.querySelector('.btn-text');

        this.hideError();

        if (password !== confirm) {
            this.showError('Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            this.showError('Пароль должен быть не короче 6 символов');
            return;
        }

        btn.disabled = true;
        btnText.textContent = 'Сохранение...';

        const result = await AuthService.updatePassword(password);

        btn.disabled = false;
        btnText.textContent = 'Сохранить пароль';

        if (result.success) {
            this.hide();
            if (this.onDone) this.onDone();
        } else {
            this.showError(result.error);
        }
    }

    showError(message) {
        const el = document.getElementById('reset-password-error');
        el.textContent = message;
        el.classList.remove('hidden');
    }

    hideError() {
        const el = document.getElementById('reset-password-error');
        el.textContent = '';
        el.classList.add('hidden');
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default ResetPasswordPage;
