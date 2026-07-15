import WorldsService from '../services/worlds-service.js';
import AuthService from '../services/auth-service.js';

class WorldSelectionPage {
    constructor() {
        this.container = null;
        this.onWorldSelected = null;
    }

    async initialize(onWorldSelected) {
        this.onWorldSelected = onWorldSelected;
        await this.render();
        this.bindEvents();
    }

    async render() {
        this.container = document.createElement('div');
        this.container.id = 'world-selection-page';
        this.container.className = 'login-page';

        let worlds = [];
        try {
            worlds = await WorldsService.getMyWorlds();
        } catch (e) {
            console.error('❌ Failed to load worlds:', e);
        }

        const worldsListHtml = worlds.length > 0
            ? worlds.map(w => `
                <button class="world-item" data-world-id="${w.id}">
                    <span class="world-item-name">${this.escapeHtml(w.name)}</span>
                    <span class="world-item-role">${w.role === 'dm' ? '🎲 Мастер' : '🗺️ Игрок'}</span>
                </button>
            `).join('')
            : `<div class="world-empty">У тебя пока нет ни одного мира</div>`;

        this.container.innerHTML = `
            <div class="login-container">
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

    bindEvents() {
        this.container.querySelectorAll('.world-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const worldId = btn.dataset.worldId;
                this.selectWorld(worldId);
            });
        });

        const createForm = document.getElementById('create-world-form');
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-world-name').value.trim();
            if (!name) return;

            this.hideError();
            try {
                const worldId = await WorldsService.createWorld(name);
                await this.selectWorld(worldId);
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
                const worldId = await WorldsService.joinWorldByInviteCode(code);
                await this.selectWorld(worldId);
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

    async selectWorld(worldId) {
        try {
            const maps = await WorldsService.getMapsForWorld(worldId);
            if (!maps || maps.length === 0) {
                this.showError('В этом мире пока нет ни одной карты');
                return;
            }

            // Пока берём первую карту мира — выбор карты внутри мира
            // можно будет добавить отдельным экраном позже, если карт станет больше одной
            const mapId = maps[0].id;

            this.hide();
            if (this.onWorldSelected) {
                this.onWorldSelected({ worldId, mapId });
            }
        } catch (err) {
            this.showError('Не удалось открыть мир: ' + err.message);
        }
    }

    showError(message) {
        const errorElement = document.getElementById('world-error');
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }

    hideError() {
        const errorElement = document.getElementById('world-error');
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

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default WorldSelectionPage;
