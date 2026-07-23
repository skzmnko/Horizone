import WorldsService from '../services/worlds-service.js';
import MapImageService from '../services/map-image-service.js';
import { t, getCurrentLanguage } from '../services/i18n.js';

// Страница управления миром — открывается у DM сразу после клика по
// карточке мира на world-selection-page. Сюда стекается вся деятельность
// по управлению миром: карты (в мире их может быть несколько), приглашения,
// а в будущем — управление участниками, настройки мира и т.д.
//
// Структура и поведение сознательно повторяют world-selection-page.js:
// заголовок раздела → тулбар → грид плиток (те же .tp-grid/.tp-card
// классы, чекбоксы для мультивыбора, кнопка загрузки картинки на плитке,
// открытие по клику на саму плитку).
//
// Игроков/наблюдателей эта страница не касается — они, как и раньше,
// попадают сразу в интерактивную карту (см. main.js: enterWorld()).
class WorldControlPage {
    constructor() {
        this.container = null;
        this.worldId = null;
        this.world = null;
        this.maps = [];
        this.selectedMapIds = new Set();
        this.invites = [];
        this.callbacks = {};
    }

    async initialize(worldId, mapId, callbacks = {}) {
        this.worldId = worldId;
        this.callbacks = callbacks;

        this.world = await WorldsService.getWorld(worldId);
        await this.loadMaps();

        this.render();
        this.bindEvents();
        this.loadInvites();
    }

    async loadMaps() {
        try {
            this.maps = await WorldsService.getMapsForWorld(this.worldId);
        } catch (err) {
            console.error('❌ Failed to load maps:', err);
            this.maps = [];
        }
        this.selectedMapIds.clear();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.className = 'tp-home';

        const worldName = this.escapeHtml(this.world.name);

        const gridHtml = this.maps.length > 0
            ? `<div class="tp-grid">${this.maps.map(m => this.renderMapCard(m)).join('')}</div>`
            : `<div class="tp-empty">${t('worldControl.emptyMaps')}</div>`;

        this.container.innerHTML = `
            <div class="tp-header wc-header">
                <button class="tp-logout-btn" id="wc-back-btn">${t('worldControl.backButton')}</button>
                <div class="tp-logo wc-title">${worldName}</div>
                <div class="tp-tagline">${t('worldControl.pageTagline')}</div>
            </div>

            <div class="wc-page">
                <div class="wc-section">
                    <div class="wc-section-title">${t('worldControl.visibilityTitle')}</div>
                    <div class="wc-section-hint">${t('worldControl.visibilityHint')}</div>
                    <label class="dm-invite-option">
                        <input type="checkbox" id="wc-is-public" ${this.world.is_public ? 'checked' : ''}>
                        ${t('worldControl.makePublicLabel')}
                    </label>
                </div>

                <div class="wc-section">
                    <div class="wc-section-title">${t('worldControl.invitesTitle')}</div>
                    <div class="wc-section-hint">${t('worldControl.invitesHint')}</div>
                    <div class="dm-invite-controls">
                        <label class="dm-invite-option">
                            <input type="checkbox" id="wc-invite-single-use">
                            ${t('worldControl.singleUseLabel')}
                        </label>
                        <select id="wc-invite-expiry" class="dm-invite-expiry-select">
                            <option value="">${t('worldControl.expiryNoneOption')}</option>
                            <option value="24">${t('worldControl.expiry24hOption')}</option>
                            <option value="168">${t('worldControl.expiry7dOption')}</option>
                        </select>
                        <button id="wc-create-invite-btn" class="tp-btn tp-btn-primary">${t('worldControl.createInviteButton')}</button>
                    </div>
                    <div class="dm-invite-list" id="wc-invite-list">
                        <div class="dm-empty-list">${t('worldControl.noActiveInvites')}</div>
                    </div>
                </div>
            </div>

            <div class="tp-section-title">${t('worldControl.mapsSectionTitle')}</div>

            <div class="tp-toolbar">
                <button class="tp-btn tp-btn-primary" id="wc-add-map-btn">${t('worldControl.addMapButton')}</button>
                <button class="tp-btn tp-btn-danger" id="wc-delete-map-btn" disabled>${t('worldControl.deleteMapButton')}</button>
            </div>

            ${gridHtml}

            <div id="wc-error" class="error-message hidden tp-error-box"></div>
        `;

        document.body.appendChild(this.container);
    }

    renderMapCard(map) {
        const hasImage = !!map.image_path;
        const isSelected = this.selectedMapIds.has(map.id);
        const name = this.escapeHtml(map.name || t('worldControl.defaultMapName'));

        const imageHtml = hasImage
            ? `<img src="${MapImageService.getPublicUrl(map.image_path)}" class="tp-card-image" alt="${name}">`
            : `<div class="tp-card-placeholder" style="background:${this.placeholderGradient(map.name || map.id)};">
                   <span class="tp-card-placeholder-text">${name}</span>
               </div>`;

        return `
            <div class="tp-card ${isSelected ? 'selected' : ''}" data-map-id="${map.id}">
                <div class="tp-card-image-wrap">
                    ${imageHtml}
                    <label class="tp-card-checkbox-wrap">
                        <input type="checkbox" class="tp-card-checkbox" data-map-id="${map.id}" ${isSelected ? 'checked' : ''}>
                    </label>
                    <button class="tp-card-cover-btn" data-map-id="${map.id}" title="${hasImage ? t('worldControl.replaceMapImageTitle') : t('worldControl.uploadMapImageTitle')}">🖼</button>
                    <input type="file" accept="image/*" class="tp-cover-input" data-map-id="${map.id}">
                </div>
                <div class="tp-card-name">
                    ${name}
                    <span class="tp-card-role">${hasImage ? t('worldControl.mapReadyBadge') : t('worldControl.mapNoImageBadge')}</span>
                </div>
            </div>
        `;
    }

    placeholderGradient(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `linear-gradient(135deg, hsl(${hue}, 40%, 26%), hsl(${(hue + 40) % 360}, 35%, 14%))`;
    }

    // Styled replacement for window.prompt() — same pattern as
    // world-selection-page.js's showPromptModal
    showPromptModal({ title, placeholder = '', confirmLabel }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">${this.escapeHtml(title)}</div>
                    <input type="text" class="tp-modal-input" id="tp-modal-input" placeholder="${this.escapeHtml(placeholder)}">
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="tp-modal-cancel">${t('worldSelection.modalCancel')}</button>
                        <button class="tp-btn tp-btn-primary" id="tp-modal-confirm">${this.escapeHtml(confirmLabel)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = overlay.querySelector('#tp-modal-input');
            setTimeout(() => input.focus(), 0);

            const close = (value) => {
                overlay.remove();
                resolve(value);
            };

            overlay.querySelector('#tp-modal-cancel').addEventListener('click', () => close(null));
            overlay.querySelector('#tp-modal-confirm').addEventListener('click', () => close(input.value.trim() || null));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') close(input.value.trim() || null);
                if (e.key === 'Escape') close(null);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });
        });
    }

    // Styled replacement for window.confirm() — same pattern as
    // world-selection-page.js's showConfirmModal
    showConfirmModal({ title, message, confirmLabel, danger = true }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">${this.escapeHtml(title)}</div>
                    <div class="tp-modal-message">${message}</div>
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="tp-modal-cancel">${t('worldSelection.modalCancel')}</button>
                        <button class="tp-btn ${danger ? 'tp-btn-danger' : 'tp-btn-primary'}" id="tp-modal-confirm">${this.escapeHtml(confirmLabel)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = (value) => {
                overlay.remove();
                resolve(value);
            };

            overlay.querySelector('#tp-modal-cancel').addEventListener('click', () => close(false));
            overlay.querySelector('#tp-modal-confirm').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    }

    bindEvents() {
        document.getElementById('wc-back-btn').addEventListener('click', () => {
            this.hide();
            if (this.callbacks.onBackToWorlds) this.callbacks.onBackToWorlds();
        });

        document.getElementById('wc-add-map-btn').addEventListener('click', async () => {
            const name = await this.showPromptModal({
                title: t('worldControl.newMapTitle'),
                placeholder: t('worldControl.newMapPlaceholder'),
                confirmLabel: t('worldControl.addMapConfirm')
            });
            if (!name) return;

            try {
                await WorldsService.createMap(this.worldId, name);
                await this.reloadMaps();
            } catch (err) {
                this.showError(t('worldControl.errorCreateMap', { message: err.message }));
            }
        });

        document.getElementById('wc-delete-map-btn').addEventListener('click', async () => {
            if (this.selectedMapIds.size === 0) return;

            const names = this.maps
                .filter(m => this.selectedMapIds.has(m.id))
                .map(m => this.escapeHtml(m.name || t('worldControl.defaultMapName')))
                .join(', ');

            const confirmed = await this.showConfirmModal({
                title: t('worldControl.deleteMapsTitle'),
                message: t('worldControl.deleteMapsMessage', { names }),
                confirmLabel: t('worldControl.deleteMapsConfirm')
            });
            if (!confirmed) return;

            try {
                for (const mapId of this.selectedMapIds) {
                    await WorldsService.deleteMap(mapId);
                }
                await this.reloadMaps();
            } catch (err) {
                this.showError(t('worldControl.errorDeleteMaps', { message: err.message }));
            }
        });

        document.getElementById('wc-create-invite-btn').addEventListener('click', () => this.handleCreateInvite());

        const publicToggle = document.getElementById('wc-is-public');
        publicToggle.addEventListener('change', async () => {
            const isPublic = publicToggle.checked;
            publicToggle.disabled = true;

            try {
                await WorldsService.setWorldVisibility(this.worldId, isPublic);
                this.world.is_public = isPublic;
            } catch (err) {
                publicToggle.checked = !isPublic;
                this.showError(t('worldControl.errorUpdateVisibility', { message: err.message }));
            } finally {
                publicToggle.disabled = false;
            }
        });

        this.inviteListContainer = document.getElementById('wc-invite-list');
        this.inviteListContainer.addEventListener('click', (e) => {
            const revokeBtn = e.target.closest('.dm-invite-revoke-btn');
            if (revokeBtn) this.handleRevokeInvite(revokeBtn.dataset.inviteId);

            const copyBtn = e.target.closest('.dm-invite-copy-btn');
            if (copyBtn) this.copyToClipboard(copyBtn.dataset.code, copyBtn);
        });

        this.container.querySelectorAll('.tp-card-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            checkbox.addEventListener('change', () => {
                const mapId = checkbox.dataset.mapId;
                if (checkbox.checked) {
                    this.selectedMapIds.add(mapId);
                } else {
                    this.selectedMapIds.delete(mapId);
                }

                const card = checkbox.closest('.tp-card');
                card.classList.toggle('selected', checkbox.checked);

                const deleteBtn = document.getElementById('wc-delete-map-btn');
                deleteBtn.disabled = this.selectedMapIds.size === 0;
            });
        });

        this.container.querySelectorAll('.tp-card-cover-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mapId = btn.dataset.mapId;
                const input = this.container.querySelector(`.tp-cover-input[data-map-id="${mapId}"]`);
                input.click();
            });
        });

        this.container.querySelectorAll('.tp-cover-input').forEach(input => {
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('change', async () => {
                const file = input.files[0];
                if (!file) return;
                const mapId = input.dataset.mapId;

                try {
                    await MapImageService.uploadMapImage(file, this.worldId, mapId);
                    await this.reloadMaps();
                } catch (err) {
                    this.showError(t('worldControl.errorUploadImage', { message: err.message }));
                }
            });
        });

        this.container.querySelectorAll('.tp-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openMap(card.dataset.mapId);
            });
        });
    }

    openMap(mapId) {
        const map = this.maps.find(m => m.id === mapId);
        if (!map) return;

        if (!map.image_path) {
            this.showError(t('worldControl.errorNoImageClickToUpload'));
            return;
        }

        this.hide();
        if (this.callbacks.onEnterMap) this.callbacks.onEnterMap({ mapId: map.id });
    }

    // Перезагружает список карт и перерисовывает страницу целиком —
    // тот же паттерн, что loadAndRender() в world-selection-page.js
    async reloadMaps() {
        await this.loadMaps();
        this.render();
        this.bindEvents();
        this.loadInvites();
    }

    async handleCreateInvite() {
        const singleUse = document.getElementById('wc-invite-single-use')?.checked;
        const expiryValue = document.getElementById('wc-invite-expiry')?.value;

        try {
            await WorldsService.createInvite(this.worldId, {
                maxUses: singleUse ? 1 : null,
                expiresInHours: expiryValue ? parseInt(expiryValue, 10) : null
            });
            await this.loadInvites();
        } catch (err) {
            this.showError(t('worldControl.errorCreateInvite', { message: err.message }));
        }
    }

    async handleRevokeInvite(inviteId) {
        if (!inviteId) return;
        if (!confirm(t('worldControl.revokeConfirm'))) return;

        try {
            await WorldsService.revokeInvite(inviteId);
            await this.loadInvites();
        } catch (err) {
            this.showError(t('worldControl.errorRevokeInvite', { message: err.message }));
        }
    }

    async loadInvites() {
        if (!this.inviteListContainer) return;

        try {
            this.invites = await WorldsService.getWorldInvites(this.worldId);
            this.renderInviteList();
        } catch (err) {
            console.warn('⚠️ Could not load invites:', err.message);
        }
    }

    renderInviteList() {
        if (!this.inviteListContainer) return;

        if (!this.invites || this.invites.length === 0) {
            this.inviteListContainer.innerHTML = `<div class="dm-empty-list">${t('worldControl.noActiveInvites')}</div>`;
            return;
        }

        const dateLocale = getCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-US';

        this.inviteListContainer.innerHTML = this.invites.map(inv => {
            const usage = inv.max_uses ? `${inv.uses_count}/${inv.max_uses}` : `${inv.uses_count}/∞`;
            const expiry = inv.expires_at
                ? new Date(inv.expires_at).toLocaleString(dateLocale)
                : t('worldControl.inviteNoExpiry');

            return `
                <div class="dm-invite-item">
                    <div class="dm-invite-code">${this.escapeHtml(inv.code)}</div>
                    <div class="dm-invite-meta">${t('worldControl.inviteUsageMeta', { usage, expiry })}</div>
                    <div class="dm-invite-actions">
                        <button class="dm-invite-copy-btn" data-code="${this.escapeHtml(inv.code)}" title="${t('worldControl.copyCodeTitle')}">${t('worldControl.copyCodeButton')}</button>
                        <button class="dm-invite-revoke-btn" data-invite-id="${inv.id}" title="${t('worldControl.revokeTitle')}">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            if (!btn) return;
            const original = btn.textContent;
            btn.textContent = t('worldControl.copiedLabel');
            setTimeout(() => { btn.textContent = original; }, 1500);
        }).catch(() => {
            window.prompt(t('worldControl.clipboardFallbackPrompt'), text);
        });
    }

    showError(message) {
        const el = document.getElementById('wc-error');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default WorldControlPage;