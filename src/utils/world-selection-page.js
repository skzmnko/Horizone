import WorldsService from '../services/worlds-service.js';
import AuthService from '../services/auth-service.js';

class WorldSelectionPage {
    constructor() {
        this.container = null;
        this.onWorldSelected = null;
        this.worlds = [];
    }

    async initialize(onWorldSelected) {
        this.onWorldSelected = onWorldSelected;
        await this.loadAndRender();
    }

    async loadAndRender() {
        try {
            this.worlds = await WorldsService.getMyWorlds();

            // Подтягиваем карты для каждого мира сразу, чтобы список
            // можно было показать полностью раскрытым без доп. кликов
            for (const world of this.worlds) {
                world.maps = await WorldsService.getMapsForWorld(world.id);
            }
        } catch (e) {
            console.error('❌ Failed to load worlds:', e);
            this.worlds = [];
        }

        this.render();
        this.bindEvents();
    }

    render() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = document.createElement('div');
        this.container.id = 'world-selection-page';
        this.container.className = 'login-page';

        const worldsListHtml = this.worlds.length > 0
            ? this.worlds.map(w => this.renderWorldBlock(w)).join('')
            : `<div class="world-empty">У тебя пока нет ни одного мира</div>`;

        this.container.innerHTML = `
            <div class="login-container" style="max-width:480px;">
                <div class="login-header">
                    <h1>Твои миры</h1>
                    <p>${AuthService.getCurrentUser()?.displayName || ''}</p>
                </div>

                <div class="world-list">
                    ${worldsListHtml}
                </div>

                <div id="world-error" class="error-message hidden"></div>

                <div class="login-footer" style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                    <form id="create-world-form" style="display:flex; gap:8px;">
                        <input type="text" id="new-world-name" placeholder="Название нового мира" required style="flex:1;">
                        <button type="submit" class="login-btn" style="width:auto; padding:0 16px;">Создать</button>
                    </form>

                    <form id="join-world-form" style="display:flex; gap:8px;">
                        <input type="text" id="invite-code" placeholder="Код приглашения" required style="flex:1; text-transform:uppercase;">
                        <button type="submit" class="login-btn" style="width:auto; padding:0 16px;">Войти по коду</button>
                    </form>

                    <button id="logout-btn" style="background:none; border:none; color:#a3a3a3; cursor:pointer; margin-top:8px;">
                        Выйти из аккаунта
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
    }

    renderWorldBlock(world) {
        const isDM = world.role === 'dm';
        const mapsHtml = (world.maps || []).map(map => `
            <div class="world-map-item" style="display:flex; align-items:center; justify-content:space-between; padding:6px 12px;">
                <button class="enter-map-btn" data-world-id="${world.id}" data-map-id="${map.id}"
                    style="background:none; border:none; color:#e5e5e5; cursor:pointer; text-align:left; flex:1;">
                    🗺️ ${this.escapeHtml(map.name)}${!map.image_path ? ' <span style="color:#a3a3a3;">(нет картинки)</span>' : ''}
                </button>
                ${isDM ? `
                    <button class="delete-map-btn" data-map-id="${map.id}"
                        title="Удалить карту" style="background:none; border:none; color:#c26b6b; cursor:pointer;">✕</button>
                ` : ''}
            </div>
        `).join('') || `<div style="padding:6px 12px; color:#a3a3a3;">Нет карт</div>`;

        return `
            <div class="world-block" style="border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:10px; overflow:hidden;">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.03);">
                    <div>
                        <span class="world-item-name" style="font-weight:600;">${this.escapeHtml(world.name)}</span>
                        <span class="world-item-role" style="margin-left:8px; color:#a3a3a3; font-size:12px;">
                            ${isDM ? '🎲 Мастер' : '🗺️ Игрок'}
                        </span>
                    </div>
                    ${isDM ? `
                        <button class="delete-world-btn" data-world-id="${world.id}"
                            title="Удалить мир" style="background:none; border:none; color:#c26b6b; cursor:pointer;">🗑</button>
                    ` : ''}
                </div>
                <div class="world-maps">
                    ${mapsHtml}
                </div>
                ${isDM ? `
                    <div style="padding:6px 12px 10px;">
                        <button class="add-map-btn" data-world-id="${world.id}"
                            style="background:none; border:1px dashed rgba(255,255,255,0.3); color:#a3a3a3; cursor:pointer; padding:4px 10px; border-radius:6px; font-size:13px;">
                            + Добавить карту
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('.enter-map-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const worldId = btn.dataset.worldId;
                const mapId = btn.dataset.mapId;
                this.hide();
                if (this.onWorldSelected) {
                    this.onWorldSelected({ worldId, mapId });
                }
            });
        });

        this.container.querySelectorAll('.delete-world-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const worldId = btn.dataset.worldId;
                const world = this.worlds.find(w => w.id === worldId);
                const confirmed = window.confirm(
                    `Удалить мир "${world?.name}" со всеми картами и локациями? Это необратимо.`
                );
                if (!confirmed) return;

                try {
                    await WorldsService.deleteWorld(worldId);
                    await this.loadAndRender();
                } catch (err) {
                    this.showError('Не удалось удалить мир: ' + err.message);
                }
            });
        });

        this.container.querySelectorAll('.delete-map-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const mapId = btn.dataset.mapId;
                const confirmed = window.confirm('Удалить эту карту со всеми локациями на ней? Это необратимо.');
                if (!confirmed) return;

                try {
                    await WorldsService.deleteMap(mapId);
                    await this.loadAndRender();
                } catch (err) {
                    this.showError('Не удалось удалить карту: ' + err.message);
                }
            });
        });

        this.container.querySelectorAll('.add-map-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const worldId = btn.dataset.worldId;
                const name = window.prompt('Название новой карты:', 'Новая карта');
                if (!name || !name.trim()) return;

                try {
                    await WorldsService.createMap(worldId, name.trim());
                    await this.loadAndRender();
                } catch (err) {
                    this.showError('Не удалось создать карту: ' + err.message);
                }
            });
        });

        const createForm = document.getElementById('create-world-form');
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-world-name').value.trim();
            if (!name) return;

            this.hideError();
            try {
                await WorldsService.createWorld(name);
                await this.loadAndRender();
            } catch (err) {
                this.showError('Не удалось создать мир: ' + err.message);
            }
        });

        const joinForm = document.getElementById('join-world-form');
        joinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('invite-code').value.trim();
            if (!code) return;

            this.hideError();
            try {
                await WorldsService.joinWorldByInviteCode(code);
                await this.loadAndRender();
            } catch (err) {
                this.showError('Неверный или истёкший код приглашения');
            }
        });

        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', async () => {
            await AuthService.logout();
            window.location.reload();
        });
    }

    showError(message) {
        const errorElement = document.getElementById('world-error');
        if (!errorElement) return;
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }

    hideError() {
        const errorElement = document.getElementById('world-error');
        if (!errorElement) return;
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }
}

export default WorldSelectionPage;