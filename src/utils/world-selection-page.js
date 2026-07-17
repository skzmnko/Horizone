import WorldsService from '../services/worlds-service.js';
import WorldCoverService from '../services/world-cover-service.js';
import AuthService from '../services/auth-service.js';

class WorldSelectionPage {
    constructor() {
        this.container = null;
        this.onWorldSelected = null;
        this.worlds = [];
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
            : `<div class="tp-empty">У тебя пока нет ни одного мира — создай первый выше</div>`;

        this.container.innerHTML = `
            <div class="tp-header">
                <button class="tp-logout-btn" id="tp-logout-btn">Выйти</button>
                <img src="/logo.png" alt="Trace & Place" class="tp-logo-img">
                <div class="tp-logo">Trace &amp; Place <span class="tp-short">(T&amp;P)</span></div>
                <div class="tp-tagline">Interactive Maps</div>
            </div>

            <div class="tp-section-title">Worlds</div>

            <div class="tp-toolbar">
                <button class="tp-btn tp-btn-primary" id="tp-create-world-btn">+ Создать мир</button>
                <button class="tp-btn tp-btn-danger" id="tp-delete-world-btn" disabled>Удалить мир</button>
                <input type="text" class="tp-search-input" placeholder="Search..." disabled title="Скоро">
                <button class="tp-sort-btn" title="Скоро">A-Z</button>
                <button class="tp-sort-btn" title="Скоро">Latest</button>
                <button class="tp-join-link" id="tp-join-link">Есть код приглашения?</button>
            </div>

            ${gridHtml}

            <div style="text-align:center; margin-top:32px;">
                <button class="tp-danger-link" id="tp-delete-account-btn">Удалить мой аккаунт безвозвратно</button>
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
                        <button class="tp-card-cover-btn" data-world-id="${world.id}" title="Изменить обложку">🖼</button>
                        <input type="file" accept="image/*" class="tp-cover-input" data-world-id="${world.id}">
                    ` : ''}
                </div>
                <div class="tp-card-name">
                    ${this.escapeHtml(world.name)}
                    <span class="tp-card-role">${isDM ? '🎲 Мастер' : '🗺️ Игрок'}</span>
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

    // Стилизованная замена window.prompt() — возвращает Promise<string|null>
    showPromptModal({ title, placeholder = '', confirmLabel = 'ОК' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">${this.escapeHtml(title)}</div>
                    <input type="text" class="tp-modal-input" id="tp-modal-input" placeholder="${this.escapeHtml(placeholder)}">
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="tp-modal-cancel">Отмена</button>
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

    // Стилизованная замена window.confirm() — возвращает Promise<boolean>
    showConfirmModal({ title, message, confirmLabel = 'Удалить', danger = true }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">${this.escapeHtml(title)}</div>
                    <div class="tp-modal-message">${message}</div>
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="tp-modal-cancel">Отмена</button>
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

    // Отдельная модалка для входа по коду — код + необязательное имя персонажа
    showJoinWorldModal() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tp-modal-overlay';
            overlay.innerHTML = `
                <div class="tp-modal">
                    <div class="tp-modal-title">Код приглашения</div>
                    <input type="text" class="tp-modal-input" id="tp-join-code" placeholder="Например, AB3D9F2K">
                    <input type="text" class="tp-modal-input" id="tp-join-name" placeholder="Имя персонажа (необязательно)">
                    <div class="tp-modal-actions">
                        <button class="tp-btn" id="tp-modal-cancel">Отмена</button>
                        <button class="tp-btn tp-btn-primary" id="tp-modal-confirm">Войти</button>
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
            btn.textContent = 'Выход...';
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
                title: 'Удалить аккаунт?',
                message: 'Это удалит твой аккаунт, все твои миры (со всеми картами и локациями) и выход из всех чужих миров. Это <strong>необратимо</strong>.',
                confirmLabel: 'Удалить навсегда'
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
                this.showError('Не удалось удалить аккаунт: ' + err.message);
            }
        });

        document.getElementById('tp-create-world-btn').addEventListener('click', async () => {
            const name = await this.showPromptModal({
                title: 'Название нового мира',
                placeholder: 'Например, Ораска',
                confirmLabel: 'Создать'
            });
            if (!name) return;

            try {
                await WorldsService.createWorld(name);
                await this.loadAndRender();
            } catch (err) {
                this.showError('Не удалось создать мир: ' + err.message);
            }
        });

        document.getElementById('tp-join-link').addEventListener('click', async () => {
            const result = await this.showJoinWorldModal();
            if (!result) return;

            try {
                await WorldsService.joinWorldByInviteCode(result.code, result.characterName);
                await this.loadAndRender();
            } catch (err) {
                this.showError('Неверный или истёкший код приглашения');
            }
        });

        document.getElementById('tp-delete-world-btn').addEventListener('click', async () => {
            if (this.selectedWorldIds.size === 0) return;

            const names = this.worlds
                .filter(w => this.selectedWorldIds.has(w.id))
                .map(w => this.escapeHtml(w.name))
                .join(', ');

            const confirmed = await this.showConfirmModal({
                title: 'Удалить миры?',
                message: `Удалить выбранные миры (<strong>${names}</strong>) со всеми картами и локациями? Это необратимо.`,
                confirmLabel: 'Удалить'
            });
            if (!confirmed) return;

            try {
                for (const worldId of this.selectedWorldIds) {
                    await WorldsService.deleteWorld(worldId);
                }
                await this.loadAndRender();
            } catch (err) {
                this.showError('Не удалось удалить: ' + err.message);
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
                    this.showError('Не удалось загрузить обложку: ' + err.message);
                }
            });
        });

        this.container.querySelectorAll('.tp-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openWorld(card.dataset.worldId);
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
            this.showError('Не удалось открыть мир: ' + err.message);
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
        if (this.container) {
            this.container.classList.add('hidden');
            this.container.style.display = 'none';
        }
    }
}

export default WorldSelectionPage;