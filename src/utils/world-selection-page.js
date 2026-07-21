import WorldsService from '../services/worlds-service.js';
import WorldCoverService from '../services/world-cover-service.js';
import AuthService from '../services/auth-service.js';
import { t } from '../services/i18n.js';

class WorldSelectionPage {
    constructor() {
        this.container = null;
        this.onWorldSelected = null;
        this.worlds = [];
        this.publicWorlds = [];
        this.selectedWorldIds = new Set();
    }

    async initialize(onWorldSelected) {
        this.onWorldSelected = onWorldSelected;
        await this.loadAndRender();
    }

    async loadAndRender() {
        try {
            this.worlds = await WorldsService.getMyWorlds();
        } catch (e) {
            console.error('❌ Failed to load worlds:', e);
            this.worlds = [];
        }

        try {
            const myIds = new Set(this.worlds.map(w => w.id));
            const publicWorlds = await WorldsService.getPublicWorlds();
            this.publicWorlds = publicWorlds.filter(w => !myIds.has(w.id));
        } catch (e) {
            console.warn('⚠️ Failed to load public worlds:', e);
            this.publicWorlds = [];
        }

        this.selectedWorldIds.clear();
        this.render();
        this.bindEvents();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.className = 'tp-home';

        const gridHtml = this.worlds.length > 0
            ? `<div class="tp-grid">${this.worlds.map(w => this.renderCard(w)).join('')}</div>`
            : `<div class="tp-empty">${t('worldSelection.emptyWorlds')}</div>`;

        const publicSectionHtml = this.publicWorlds.length > 0 ? `
            <div class="tp-section-title">${t('worldSelection.publicWorldsTitle')}</div>
            <div class="tp-grid">${this.publicWorlds.map(w => this.renderPublicCard(w)).join('')}</div>
        ` : '';

        this.container.innerHTML = `
            <div class="tp-header">
                <button class="tp-logout-btn" id="tp-logout-btn">${t('worldSelection.logoutButton')}</button>
                <img src="/logo.svg" alt="Horizone" class="tp-logo-img">
            </div>

            <div class="tp-section-title">${t('worldSelection.worldsTitle')}</div>

            <div class="tp-toolbar">
                <button class="tp-btn tp-btn-primary" id="tp-create-world-btn">${t('worldSelection.createWorldButton')}</button>
                <button class="tp-btn tp-btn-danger" id="tp-delete-world-btn" disabled>${t('worldSelection.deleteWorldButton')}</button>
                <input type="text" class="tp-search-input" placeholder="${t('worldSelection.searchPlaceholder')}" disabled title="${t('worldSelection.comingSoon')}">
                <button class="tp-sort-btn" title="${t('worldSelection.comingSoon')}">${t('worldSelection.sortAZ')}</button>
                <button class="tp-sort-btn" title="${t('worldSelection.comingSoon')}">${t('worldSelection.sortLatest')}</button>
                <button class="tp-join-link" id="tp-join-link">${t('worldSelection.joinByCodeLink')}</button>
            </div>

            ${gridHtml}

            ${publicSectionHtml}

            <div style="text-align:center; margin-top:32px;">
                <button class="tp-danger-link" id="tp-delete-account-btn">${t('worldSelection.deleteAccountButton')}</button>
            </div>

            <div id="tp-error" class="error-message hidden tp-error-box"></div>
        `;

        document.body.appendChild(this.container);
    }

    renderCard(world) {
        const isDM = world.role === 'dm';
        const coverUrl = WorldCoverService.getPublicUrl(world.coverImagePath);
        const isSelected = this.selectedWorldIds.has(world.id);

        const imageHtml = coverUrl
            ? `<img src="${coverUrl}" class="tp-card-image" alt="${this.escapeHtml(world.name)}">`
            : `<div class="tp-card-placeholder" style="background:${this.placeholderGradient(world.name)};">
                   <span class="tp-card-placeholder-text">${this.escapeHtml(world.name)}</span>
               </div>`;

        return `
            <div class="tp-card ${isSelected ? 'selected' : ''}" data-world-id="${world.id}">
                <div class="tp-card-image-wrap">
                    ${imageHtml}
                    <label class="tp-card-checkbox-wrap">
                        <input type="checkbox" class="tp-card-checkbox" data-world-id="${world.id}" ${isSelected ? 'checked' : ''}>
                    </label>
                    ${isDM ? `
                        <button class="tp-card-cover-btn" data-world-id="${world.id}" title="${t('worldSelection.changeCoverTitle')}">🖼</button>
                        <input type="file" accept="image/*" class="tp-cover-input" data-world-id="${world.id}">
                    ` : ''}
                </div>
                <div class="tp-card-name">
                    ${this.escapeHtml(world.name)}
                    <span class="tp-card-role">${isDM ? t('worldSelection.roleDm') : t('worldSelection.roleObserver')}${world.isPublic ? ' · ' + t('worldSelection.publicBadge') : ''}</span>
                </div>
            </div>
        `;
    }

    // Public world card for a world the current user is not a member of —
    // no selection checkbox and no cover upload (not their world)
    renderPublicCard(world) {
        const coverUrl = WorldCoverService.getPublicUrl(world.coverImagePath);

        const imageHtml = coverUrl
            ? `<img src="${coverUrl}" class="tp-card-image" alt="${this.escapeHtml(world.name)}">`
            : `<div class="tp-card-placeholder" style="background:${this.placeholderGradient(world.name)};">
                   <span class="tp-card-placeholder-text">${this.escapeHtml(world.name)}</span>
               </div>`;

        return `
            <div class="tp-card tp-card-public" data-public-world-id="${world.id}">
                <div class="tp-card-image-wrap">
                    ${imageHtml}
                </div>
                <div class="tp-card-name">
                    ${this.escapeHtml(world.name)}
                    <span class="tp-card-role">${t('worldSelection.publicBadge')}</span>
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

    // Styled replacement for window.prompt() — returns Promise<string|null>
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

    // Styled replacement for window.confirm() — returns Promise<boolean>
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

    // Separate modal for joining by invite code — code + optional character name
    showJoinWorldModal() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">${t('worldSelection.joinWorldTitle')}</div>
                    <input type="text" class="tp-modal-input" id="tp-join-code" placeholder="${t('worldSelection.joinCodePlaceholder')}">
                    <input type="text" class="tp-modal-input" id="tp-join-name" placeholder="${t('worldSelection.joinNamePlaceholder')}">
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="tp-modal-cancel">${t('worldSelection.modalCancel')}</button>
                        <button class="tp-btn tp-btn-primary" id="tp-modal-confirm">${t('worldSelection.joinConfirm')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const codeInput = overlay.querySelector('#tp-join-code');
            const nameInput = overlay.querySelector('#tp-join-name');
            setTimeout(() => codeInput.focus(), 0);

            const close = (value) => {
                overlay.remove();
                resolve(value);
            };

            const submit = () => {
                const code = codeInput.value.trim();
                if (!code) return;
                close({ code, characterName: nameInput.value.trim() || null });
            };

            overlay.querySelector('#tp-modal-cancel').addEventListener('click', () => close(null));
            overlay.querySelector('#tp-modal-confirm').addEventListener('click', submit);
            [codeInput, nameInput].forEach(input => {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') close(null);
                });
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });
        });
    }

    bindEvents() {
        document.getElementById('tp-logout-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = t('worldSelection.loggingOut');
            try {
                await AuthService.logout();
            } catch (err) {
                console.warn('⚠️ Logout error (proceeding anyway):', err);
            } finally {
                window.location.reload();
            }
        });

        document.getElementById('tp-delete-account-btn').addEventListener('click', async () => {
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

        document.getElementById('tp-create-world-btn').addEventListener('click', async () => {
            const name = await this.showPromptModal({
                title: t('worldSelection.createWorldTitle'),
                placeholder: t('worldSelection.createWorldPlaceholder'),
                confirmLabel: t('worldSelection.createWorldConfirm')
            });
            if (!name) return;

            try {
                await WorldsService.createWorld(name);
                await this.loadAndRender();
            } catch (err) {
                this.showError(t('worldSelection.errorCreateWorld', { message: err.message }));
            }
        });

        document.getElementById('tp-join-link').addEventListener('click', async () => {
            const result = await this.showJoinWorldModal();
            if (!result) return;

            try {
                await WorldsService.joinWorldByInviteCode(result.code, result.characterName);
                await this.loadAndRender();
            } catch (err) {
                this.showError(t('worldSelection.errorJoinInvalidCode'));
            }
        });

        document.getElementById('tp-delete-world-btn').addEventListener('click', async () => {
            if (this.selectedWorldIds.size === 0) return;

            const names = this.worlds
                .filter(w => this.selectedWorldIds.has(w.id))
                .map(w => this.escapeHtml(w.name))
                .join(', ');

            const confirmed = await this.showConfirmModal({
                title: t('worldSelection.deleteWorldsTitle'),
                message: t('worldSelection.deleteWorldsMessage', { names }),
                confirmLabel: t('worldSelection.deleteWorldsConfirm')
            });
            if (!confirmed) return;

            try {
                for (const worldId of this.selectedWorldIds) {
                    await WorldsService.deleteWorld(worldId);
                }
                await this.loadAndRender();
            } catch (err) {
                this.showError(t('worldSelection.errorDeleteWorlds', { message: err.message }));
            }
        });

        this.container.querySelectorAll('.tp-card-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            checkbox.addEventListener('change', (e) => {
                const worldId = checkbox.dataset.worldId;
                if (checkbox.checked) {
                    this.selectedWorldIds.add(worldId);
                } else {
                    this.selectedWorldIds.delete(worldId);
                }

                const card = checkbox.closest('.tp-card');
                card.classList.toggle('selected', checkbox.checked);

                const deleteBtn = document.getElementById('tp-delete-world-btn');
                deleteBtn.disabled = this.selectedWorldIds.size === 0;
            });
        });

        this.container.querySelectorAll('.tp-card-cover-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const worldId = btn.dataset.worldId;
                const input = this.container.querySelector(`.tp-cover-input[data-world-id="${worldId}"]`);
                input.click();
            });
        });

        this.container.querySelectorAll('.tp-cover-input').forEach(input => {
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('change', async () => {
                const file = input.files[0];
                if (!file) return;
                const worldId = input.dataset.worldId;

                try {
                    await WorldCoverService.uploadCover(file, worldId);
                    await this.loadAndRender();
                } catch (err) {
                    this.showError(t('worldSelection.errorUploadCover', { message: err.message }));
                }
            });
        });

        this.container.querySelectorAll('.tp-card:not(.tp-card-public)').forEach(card => {
            card.addEventListener('click', () => {
                this.openWorld(card.dataset.worldId);
            });
        });

        this.container.querySelectorAll('.tp-card-public').forEach(card => {
            card.addEventListener('click', () => {
                this.showError(t('worldSelection.publicWorldClickHint'));
            });
        });
    }

    async openWorld(worldId) {
        try {
            const maps = await WorldsService.getMapsForWorld(worldId);
            const map = maps[0] || null;

            this.hide();
            if (this.onWorldSelected) {
                this.onWorldSelected({ worldId, mapId: map ? map.id : null });
            }
        } catch (err) {
            this.showError(t('worldSelection.errorOpenWorld', { message: err.message }));
        }
    }

    showError(message) {
        const errorElement = document.getElementById('tp-error');
        if (!errorElement) return;
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
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

export default WorldSelectionPage;