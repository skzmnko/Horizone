import AuthService from '../services/auth-service.js';
import { t, setLanguage } from '../services/i18n.js';
import { ERROR_CODES } from '../core/error-codes.js';

class LoginPage {
  constructor() {
    this.container = null;
    this.onLoginSuccess = null;
    this.mode = 'login';
  }

  initialize(onLoginSuccess) {
    this.onLoginSuccess = onLoginSuccess;
    // setLanguage('en'); // можно установить здесь или в main.js
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
          <img src="/logo.svg" alt="${t('common.appName')}" class="login-logo">
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
            <label for="display-name">${t('login.displayNameLabel')}</label>
            <input type="text" id="display-name" name="display-name" required placeholder="${t('login.displayNamePlaceholder')}">
          </div>
          <div class="form-group">
            <label for="email">${t('login.emailLabel')}</label>
            <input type="email" id="email" name="email" required autocomplete="username" placeholder="${t('login.emailPlaceholder')}">
          </div>
          <div class="form-group">
            <label for="password">${t('login.passwordLabel')}</label>
            <input type="password" id="password" name="password" required autocomplete="new-password" placeholder="${t('login.passwordPlaceholder')}">
          </div>
          <div class="form-group">
            <label for="password-confirm">${t('login.passwordConfirmLabel')}</label>
            <input type="password" id="password-confirm" name="password-confirm" required autocomplete="new-password" placeholder="${t('login.passwordConfirmPlaceholder')}">
          </div>
          <button type="submit" class="login-btn" id="login-submit">
            <span class="btn-text">${t('login.registerButton')}</span>
          </button>
        </form>
      `;
    }

    if (this.mode === 'reset') {
      return `
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label for="email">${t('login.emailLabel')}</label>
            <input type="email" id="email" name="email" required autocomplete="username" placeholder="${t('login.emailPlaceholder')}">
          </div>
          <button type="submit" class="login-btn" id="login-submit">
            <span class="btn-text">${t('login.resetButton')}</span>
          </button>
        </form>
      `;
    }

    // login
    return `
      <form id="login-form" class="login-form">
        <div class="form-group">
          <label for="email">${t('login.emailLabel')}</label>
          <input type="email" id="email" name="email" required autocomplete="username" placeholder="${t('login.emailPlaceholder')}">
        </div>
        <div class="form-group">
          <label for="password">${t('login.passwordLabel')}</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="${t('login.passwordPlaceholder')}">
        </div>
        <button type="submit" class="login-btn" id="login-submit">
          <span class="btn-text">${t('login.loginButton')}</span>
        </button>
      </form>
    `;
  }

  renderFooterLinks() {
    if (this.mode === 'register') {
      return `<button type="button" class="login-back-link" id="switch-to-login">${t('login.switchToLogin')}</button>`;
    }
    if (this.mode === 'reset') {
      return `<button type="button" class="login-back-link" id="switch-to-login">${t('login.switchToLoginFromReset')}</button>`;
    }
    return `
      <button type="button" class="login-back-link" id="switch-to-register">${t('login.switchToRegister')}</button>
      <br>
      <button type="button" class="login-back-link" id="switch-to-reset">${t('login.switchToReset')}</button>
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
    this.setLoading(true, t('login.loginButton'));

    const result = await AuthService.login(email, password);

    this.setLoading(false, t('login.loginButton'));

    if (result.success) {
      console.log(`🎉 Welcome, ${result.user.displayName}!`);
      this.showSuccessAnimation();
      setTimeout(() => {
        this.hide();
        if (this.onLoginSuccess) this.onLoginSuccess();
      }, 600);
    } else {
      this.showError(this.getErrorMessage(result.errorCode));
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
      this.showError(t('login.errorDisplayNameRequired'));
      return;
    }

    if (password !== passwordConfirm) {
      this.showError(t('login.errorPasswordsDoNotMatch'));
      this.shakeForm();
      return;
    }

    if (password.length < 6) {
      this.showError(t('login.errorPasswordShort'));
      return;
    }

    this.setLoading(true, t('login.registerButton'));

    const nameAvailable = await AuthService.checkDisplayNameAvailable(displayName);
    if (!nameAvailable) {
      this.setLoading(false, t('login.registerButton'));
      this.showError(t('login.errorDisplayNameTaken'));
      return;
    }

    const result = await AuthService.signUp(email, password, displayName);

    this.setLoading(false, t('login.registerButton'));

    if (!result.success) {
      this.showError(this.getErrorMessage(result.errorCode));
      this.shakeForm();
      return;
    }

    if (result.needsEmailConfirmation) {
      this.setMode('login');
      this.showInfo(t('login.infoRegistrationSuccess', { email }));
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
    this.setLoading(true, t('login.resetButton'));

    const result = await AuthService.resetPassword(email);

    this.setLoading(false, t('login.resetButton'));

    if (result.success) {
      this.showInfo(t('login.infoEmailSent'));
    } else {
      this.showError(this.getErrorMessage(result.errorCode));
    }
  }

  // Исправленный метод: всегда возвращает переведённую строку
  getErrorMessage(errorCode) {
    if (!errorCode) {
      return t('login.errorGeneric');
    }
    // Преобразуем snake_case в PascalCase для ключа
    const key = `login.error${this.toPascalCase(errorCode)}`;
    const translation = t(key);
    // Если перевод не найден (вернулся ключ), используем generic
    if (translation === key) {
      return t('login.errorGeneric');
    }
    return translation;
  }

  toPascalCase(str) {
    return str.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
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
    el.className = 'error-message login-info';
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