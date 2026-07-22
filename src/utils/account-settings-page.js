import AuthService from '../services/auth-service.js';
import { t } from '../services/i18n.js';

// Account settings — reachable from the profile menu in the persistent
// app header (see ui-service.js: #profile-account-settings-btn), from
// ANY screen (login excluded — the header only shows once authenticated).
// Rendered the same way as WorldSelectionPage/WorldControlPage: a
// full-screen .tp-home overlay appended straight to <body>, so it
// naturally sits above whatever page was open underneath and "back"
// just removes itself to reveal it again — nothing else to tear down
// or restore.
class AccountSettingsPage {
    constructor() {
        this.container = null;
        this.onClose = null;
    }

    initialize(onClose) {
        this.onClose = onClose || null;
        this.render();
        this.bindEvents();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.className = 'tp-home as-page';

        const user = AuthService.getCurrentUser();

        this.container.innerHTML = `
            <div class="tp-header wc-header">
                <button class="tp-logout-btn" id="as-back-btn">${t('accountSettings.backButton')}</button>
                <div class="tp-logo wc-title">${t('accountSettings.pageTitle')}</div>
                <div class="tp-tagline">${t('accountSettings.pageTagline')}</div>
            </div>

            <div class="as-section">
                <div class="as-section-header">
                    <div class="as-section-title">${t('accountSettings.infoSectionTitle')}</div>
                    <div class="as-section-hint">${t('accountSettings.infoSectionHint')}</div>
                </div>

                <div class="as-row">
                    <label for="as-first-name">${t('accountSettings.firstNameLabel')}</label>
                    <input type="text" id="as-first-name" class="tp-modal-input as-input" value="${this.escapeHtml(user?.firstName || '')}">
                </div>
                <div class="as-row">
                    <label for="as-last-name">${t('accountSettings.lastNameLabel')}</label>
                    <input type="text" id="as-last-name" class="tp-modal-input as-input" value="${this.escapeHtml(user?.lastName || '')}">
                </div>
                <div class="as-row">
                    <label for="as-email">${t('accountSettings.emailLabel')}</label>
                    <input type="email" id="as-email" class="tp-modal-input as-input" value="${this.escapeHtml(user?.email || '')}" disabled>
                </div>
                <div class="as-row as-row-last">
                    <label for="as-account-name">${t('accountSettings.accountNameLabel')}</label>
                    <input type="text" id="as-account-name" class="tp-modal-input as-input" value="${this.escapeHtml(user?.displayName || '')}">
                </div>

                <div id="as-info-error" class="error-message hidden as-inline-msg"></div>
                <div id="as-info-success" class="error-message login-info hidden as-inline-msg"></div>

                <div class="as-section-footer">
                    <button class="tp-btn tp-btn-primary" id="as-save-btn" disabled>${t('accountSettings.saveButton')}</button>
                </div>
            </div>

            <div class="as-section as-section-danger">
                <div class="as-section-header">
                    <div class="as-section-title">${t('accountSettings.dangerSectionTitle')}</div>
                    <div class="as-section-hint">${t('accountSettings.dangerSectionHint')}</div>
                </div>
                <div class="as-section-footer">
                    <button class="tp-btn tp-btn-danger" id="as-delete-request-btn">${t('accountSettings.deleteRequestButton')}</button>
                </div>
            </div>

            <div id="as-error" class="error-message hidden tp-error-box"></div>
        `;

        document.body.appendChild(this.container);
    }

    bindEvents() {
        document.getElementById('as-back-btn').addEventListener('click', () => this.close());

        const firstNameInput = document.getElementById('as-first-name');
        const lastNameInput = document.getElementById('as-last-name');
        const accountNameInput = document.getElementById('as-account-name');
        const saveBtn = document.getElementById('as-save-btn');
        const errorEl = document.getElementById('as-info-error');
        const successEl = document.getElementById('as-info-success');

        const updateSaveState = () => {
            const anyFilled = [firstNameInput, lastNameInput, accountNameInput]
                .some(input => input.value.trim().length > 0);
            saveBtn.disabled = !anyFilled;
        };

        [firstNameInput, lastNameInput, accountNameInput].forEach(input => {
            input.addEventListener('input', () => {
                errorEl.classList.add('hidden');
                successEl.classList.add('hidden');
                updateSaveState();
            });
        });

        // Danger zone — same "Delete account?" confirmation used to live
        // on world-selection-page.js, now reachable from here instead.
        document.getElementById('as-delete-request-btn').addEventListener('click', async () => {
            const confirmed = await this.showConfirmModal({
                title: t('worldSelection.deleteAccountTitle'),
                message: t('worldSelection.deleteAccountMessage'),
                confirmLabel: t('worldSelection.deleteAccountConfirm')
            });
            if (!confirmed) return;

            try {
                const result = await AuthService.deleteMyAccount();
                if (result.success) {
                    window.location.reload();
                } else {
                    this.showError(result.error);
                }
            } catch (err) {
                this.showError(t('worldSelection.errorDeleteAccount', { message: err.message }));
            }
        });

        saveBtn.addEventListener('click', async () => {
            errorEl.classList.add('hidden');
            successEl.classList.add('hidden');
            saveBtn.disabled = true;

            const result = await AuthService.updateProfile({
                firstName: firstNameInput.value,
                lastName: lastNameInput.value,
                displayName: accountNameInput.value
            });

            if (result.success) {
                successEl.textContent = t('accountSettings.saveSuccess');
                successEl.classList.remove('hidden');
                if (this.onClose) this.onClose({ profileUpdated: true });
            } else {
                errorEl.textContent = this.getErrorMessage(result.errorCode);
                errorEl.classList.remove('hidden');
            }

            updateSaveState();
        });
    }

    // Styled replacement for window.confirm() — same pattern as
    // world-selection-page.js's modal, so "Delete account?" looks and
    // behaves identically wherever it's triggered from.
    showConfirmModal({ title, message, confirmLabel, danger = true }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">${this.escapeHtml(title)}</div>
                    <div class="tp-modal-message">${message}</div>
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="as-modal-cancel">${t('worldSelection.modalCancel')}</button>
                        <button class="tp-btn ${danger ? 'tp-btn-danger' : 'tp-btn-primary'}" id="as-modal-confirm">${this.escapeHtml(confirmLabel)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = (value) => {
                overlay.remove();
                resolve(value);
            };

            overlay.querySelector('#as-modal-cancel').addEventListener('click', () => close(false));
            overlay.querySelector('#as-modal-confirm').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    }

    showError(message) {
        const el = document.getElementById('as-error');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    getErrorMessage(errorCode) {
        if (!errorCode) return t('accountSettings.errorGeneric');
        const key = `accountSettings.error${this.toPascalCase(errorCode)}`;
        const translation = t(key);
        if (translation === key) return t('accountSettings.errorGeneric');
        return translation;
    }

    toPascalCase(str) {
        return str.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    close() {
        this.hide();
        if (this.onClose) this.onClose({ profileUpdated: false });
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default AccountSettingsPage;