import WorldsService from '../services/worlds-service.js';
import MapImageService from '../services/map-image-service.js';
import MapUploadPage from './map-upload-page.js';

// Страница управления миром — открывается у DM сразу после клика по
// карточке мира на world-selection-page. Сюда стекается вся деятельность
// по управлению миром: загрузка/замена карты, приглашения, а в будущем —
// управление участниками, настройки мира и т.д.
//
// Игроков/наблюдателей эта страница не касается — они, как и раньше,
// попадают сразу в интерактивную карту (см. main.js: enterWorld()).
class WorldControlPage {
    constructor() {
        this.container = null;
        this.worldId = null;
        this.world = null;
        this.map = null;
        this.invites = [];
        this.callbacks = {};
    }

    async initialize(worldId, mapId, callbacks = {}) {
        this.worldId = worldId;
        this.callbacks = callbacks;

        this.world = await WorldsService.getWorld(worldId);
        this.map = mapId ? await WorldsService.getMap(mapId) : null;

        this.render();
        this.bindEvents();
        this.loadInvites();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.className = 'tp-home wc-page';

        const hasMap = !!(this.map && this.map.image_path);
        const worldName = this.escapeHtml(this.world.name);

        this.container.innerHTML = `
            <div class="tp-header wc-header">
                <button class="tp-logout-btn" id="wc-back-btn">← Ко всем мирам</button>
                <div class="tp-logo wc-title">${worldName}</div>
                <div class="tp-tagline">Управление миром</div>
            </div>

            <div class="wc-map-section">
                <div class="wc-map-block" id="wc-map-block" title="Загрузить/заменить карту">
                    ${hasMap ? `
                        <img src="${MapImageService.getPublicUrl(this.map.image_path)}" class="wc-map-image" alt="${worldName}">
                    ` : `
                        <div class="wc-map-placeholder" style="background:${this.placeholderGradient(this.world.name)};"></div>
                    `}
                    <div class="wc-map-caption">${worldName} Interactive Map</div>
                    <div class="wc-map-hint">${hasMap ? '🔄 Нажми, чтобы заменить карту' : '⬆️ Нажми, чтобы загрузить карту'}</div>
                </div>

                <button class="tp-btn tp-btn-primary wc-enter-btn" id="wc-enter-map-btn" ${hasMap ? '' : 'disabled'}>
                    🗺️ Войти в мир
                </button>
            </div>

            <div class="wc-section">
                <div class="wc-section-title">✉️ Приглашения</div>
                <div class="wc-section-hint">Сгенерируй код и перешли его игроку сам (например, по почте) — он введёт его в приложении на экране выбора миров и присоединится как наблюдатель.</div>
                <div class="dm-invite-controls">
                    <label class="dm-invite-option">
                        <input type="checkbox" id="wc-invite-single-use">
                        Одноразовая (для одного игрока)
                    </label>
                    <select id="wc-invite-expiry" class="dm-invite-expiry-select">
                        <option value="">Без срока действия</option>
                        <option value="24">На 24 часа</option>
                        <option value="168">На 7 дней</option>
                    </select>
                    <button id="wc-create-invite-btn" class="tp-btn tp-btn-primary">➕ Создать приглашение</button>
                </div>
                <div class="dm-invite-list" id="wc-invite-list">
                    <div class="dm-empty-list">Пока нет активных приглашений</div>
                </div>
            </div>

            <div id="wc-error" class="error-message hidden tp-error-box"></div>
        `;

        document.body.appendChild(this.container);
    }

    placeholderGradient(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `linear-gradient(135deg, hsl(${hue}, 40%, 26%), hsl(${(hue + 40) % 360}, 35%, 14%))`;
    }

    bindEvents() {
        document.getElementById('wc-back-btn').addEventListener('click', () => {
            this.hide();
            if (this.callbacks.onBackToWorlds) this.callbacks.onBackToWorlds();
        });

        document.getElementById('wc-map-block').addEventListener('click', () => {
            this.openMapUpload();
        });

        const enterBtn = document.getElementById('wc-enter-map-btn');
        enterBtn.addEventListener('click', () => {
            if (!this.map || !this.map.image_path) return;
            this.hide();
            if (this.callbacks.onEnterMap) this.callbacks.onEnterMap({ mapId: this.map.id });
        });

        document.getElementById('wc-create-invite-btn').addEventListener('click', () => this.handleCreateInvite());

        this.inviteListContainer = document.getElementById('wc-invite-list');
        this.inviteListContainer.addEventListener('click', (e) => {
            const revokeBtn = e.target.closest('.dm-invite-revoke-btn');
            if (revokeBtn) this.handleRevokeInvite(revokeBtn.dataset.inviteId);

            const copyBtn = e.target.closest('.dm-invite-copy-btn');
            if (copyBtn) this.copyToClipboard(copyBtn.dataset.code, copyBtn);
        });
    }

    openMapUpload() {
        const uploadPage = new MapUploadPage();
        uploadPage.initialize(
            this.worldId,
            this.map ? this.map.id : null,
            (updatedMap) => {
                // Без перезагрузки — просто обновляем состояние и
                // перерисовываем блок карты новой картинкой
                this.map = updatedMap;
                this.render();
                this.bindEvents();
                this.loadInvites();
            },
            () => { uploadPage.hide(); }
        );
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
            this.showError('Не удалось создать приглашение: ' + err.message);
        }
    }

    async handleRevokeInvite(inviteId) {
        if (!inviteId) return;
        if (!confirm('Отозвать это приглашение? Ссылка перестанет работать.')) return;

        try {
            await WorldsService.revokeInvite(inviteId);
            await this.loadInvites();
        } catch (err) {
            this.showError('Не удалось отозвать приглашение: ' + err.message);
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
            this.inviteListContainer.innerHTML = `<div class="dm-empty-list">Пока нет активных приглашений</div>`;
            return;
        }

        this.inviteListContainer.innerHTML = this.invites.map(inv => {
            const usage = inv.max_uses ? `${inv.uses_count}/${inv.max_uses}` : `${inv.uses_count}/∞`;
            const expiry = inv.expires_at
                ? new Date(inv.expires_at).toLocaleString('ru-RU')
                : 'бессрочно';

            return `
                <div class="dm-invite-item">
                    <div class="dm-invite-code">${this.escapeHtml(inv.code)}</div>
                    <div class="dm-invite-meta">Использовано: ${usage} · до ${expiry}</div>
                    <div class="dm-invite-actions">
                        <button class="dm-invite-copy-btn" data-code="${this.escapeHtml(inv.code)}" title="Скопировать код">📋 Копировать код</button>
                        <button class="dm-invite-revoke-btn" data-invite-id="${inv.id}" title="Отозвать">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            if (!btn) return;
            const original = btn.textContent;
            btn.textContent = '✅ Скопировано';
            setTimeout(() => { btn.textContent = original; }, 1500);
        }).catch(() => {
            window.prompt('Скопируй ссылку вручную:', text);
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
