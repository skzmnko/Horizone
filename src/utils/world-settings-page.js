import WorldsService from '../services/worlds-service.js';
import { t } from '../services/i18n.js';

// World settings — reachable from the new #world-settings-btn in the
// persistent app header (see ui-service.js), shown only to the DM
// while a world is open. Design is intentionally identical to
// AccountSettingsPage (same .tp-home.as-page shell, same .as-section
// building blocks) — this page is the future home for per-world
// settings (visibility, etc.); for now it's a placeholder shell so
// the navigation/entry point exists ahead of that content.
class WorldSettingsPage {
    constructor() {
        this.container = null;
        this.worldId = null;
        this.world = null;
        this.onClose = null;
    }

    async initialize(worldId, onClose) {
        this.worldId = worldId;
        this.onClose = onClose || null;

        try {
            this.world = await WorldsService.getWorld(worldId);
        } catch (err) {
            console.error('❌ Failed to load world:', err);
            this.world = null;
        }

        this.render();
        this.bindEvents();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.className = 'tp-home as-page';

        const worldName = this.escapeHtml(this.world?.name || '');

        this.container.innerHTML = `
            <div class="tp-header wc-header">
                <button class="tp-logout-btn" id="ws-back-btn">${t('worldSettings.backButton')}</button>
                <div class="tp-logo wc-title">${t('worldSettings.pageTitle')}</div>
                <div class="tp-tagline">${worldName}</div>
            </div>

            <div class="as-section">
                <div class="as-section-header">
                    <div class="as-section-title">${t('worldSettings.comingSoonTitle')}</div>
                    <div class="as-section-hint">${t('worldSettings.comingSoonHint')}</div>
                </div>
            </div>

            <div id="ws-error" class="error-message hidden tp-error-box"></div>
        `;

        document.body.appendChild(this.container);
    }

    bindEvents() {
        document.getElementById('ws-back-btn').addEventListener('click', () => this.close());
    }

    showError(message) {
        const el = document.getElementById('ws-error');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    close() {
        this.hide();
        if (this.onClose) this.onClose({ closed: true });
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default WorldSettingsPage;