import WorldsService from '../services/worlds-service.js';
import WorldCoverService from '../services/world-cover-service.js';
import AuthService from '../services/auth-service.js';

const STYLE_ID = 'world-selection-styles';

class WorldSelectionPage {
    constructor() {
        this.container = null;
        this.onWorldSelected = null;
        this.worlds = [];
        this.selectedWorldIds = new Set();
    }

    async initialize(onWorldSelected) {
        this.onWorldSelected = onWorldSelected;
        this.injectStyles();
        await this.loadAndRender();
    }

    injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .tp-home {
                position: fixed;
                inset: 0;
                overflow-y: auto;
                background: linear-gradient(180deg, #131a2b 0%, #1b2440 100%);
                color: #e5e7eb;
                z-index: 5000;
                padding: 40px 20px 80px;
            }
            .tp-header {
                text-align: center;
                margin-bottom: 36px;
                position: relative;
            }
            .tp-logo-img {
                width: 160px;
                height: 160px;
                object-fit: contain;
                display: block;
                margin: 0 auto 8px;
            }
            .tp-logo {
                font-size: 32px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #ffffff;
            }
            .tp-logo .tp-short { font-size: 18px; color: #8b93a8; font-weight: 600; margin-left: 8px; }
            .tp-tagline {
                margin-top: 6px;
                font-size: 16px;
                color: #a7adbd;
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            .tp-logout-btn {
                position: absolute;
                top: 0;
                right: 0;
                background: none;
                border: 1px solid rgba(255,255,255,0.15);
                color: #a7adbd;
                border-radius: 6px;
                padding: 6px 12px;
                cursor: pointer;
                font-size: 13px;
            }
            .tp-logout-btn:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

            .tp-section-title {
                max-width: 1100px;
                margin: 0 auto 14px;
                font-size: 22px;
                font-weight: 700;
                color: #ffffff;
            }
            .tp-toolbar {
                max-width: 1100px;
                margin: 0 auto 24px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                padding: 12px;
            }
            .tp-btn {
                background: #2a3557;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 9px 16px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
            }
            .tp-btn:hover { background: #34406b; }
            .tp-btn-primary { background: #ff4d6d; }
            .tp-btn-primary:hover { background: #ff6b85; }
            .tp-btn-danger { background: #a53a4a; }
            .tp-btn-danger:hover { background: #c24558; }
            .tp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .tp-search-input {
                flex: 1;
                min-width: 160px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px;
                padding: 9px 12px;
                color: #fff;
                font-size: 14px;
            }
            .tp-sort-btn {
                background: none;
                border: 1px solid rgba(255,255,255,0.15);
                color: #a7adbd;
                border-radius: 6px;
                padding: 8px 12px;
                cursor: default;
                font-size: 13px;
            }

            .tp-grid {
                max-width: 1100px;
                margin: 0 auto;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 20px;
            }
            .tp-card {
                background: #1e2743;
                border-radius: 10px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid transparent;
                transition: border-color 0.15s ease;
            }
            .tp-card.selected { border-color: #ff4d6d; }
            .tp-card-image-wrap {
                position: relative;
                width: 100%;
                aspect-ratio: 16 / 10;
                overflow: hidden;
                background: linear-gradient(135deg, #2a3557, #1b2440);
            }
            .tp-card-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                transition: opacity 0.15s ease, filter 0.15s ease;
            }
            .tp-card-placeholder {
                width: 100%;
                height: 100%;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .tp-card-placeholder::before {
                content: '';
                position: absolute;
                inset: 0;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
                mix-blend-mode: overlay;
                opacity: 0.55;
            }
            .tp-card-placeholder-text {
                position: relative;
                z-index: 1;
                font-size: 17px;
                font-weight: 700;
                color: #ffffff;
                text-align: center;
                padding: 0 16px;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-shadow: 0 2px 6px rgba(0,0,0,0.6);
            }
            .tp-card-image-wrap:hover .tp-card-image {
                opacity: 0.45;
                filter: brightness(0.7);
            }
            .tp-card-checkbox-wrap {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 22px;
                height: 22px;
                opacity: 0;
                transition: opacity 0.15s ease;
                z-index: 2;
            }
            .tp-card-image-wrap:hover .tp-card-checkbox-wrap,
            .tp-card.selected .tp-card-checkbox-wrap {
                opacity: 1;
            }
            .tp-card-checkbox-wrap input {
                width: 20px;
                height: 20px;
                cursor: pointer;
            }
            .tp-card-cover-btn {
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(0,0,0,0.6);
                border: none;
                color: #fff;
                border-radius: 6px;
                width: 28px;
                height: 28px;
                font-size: 14px;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.15s ease;
                z-index: 2;
            }
            .tp-card-image-wrap:hover .tp-card-cover-btn {
                opacity: 1;
            }
            .tp-card-name {
                padding: 10px 12px;
                font-size: 14px;
                font-weight: 600;
                color: #fff;
                text-align: center;
            }
            .tp-card-role {
                display: block;
                font-size: 11px;
                font-weight: 400;
                color: #8b93a8;
                margin-top: 2px;
            }
            .tp-empty {
                max-width: 1100px;
                margin: 40px auto;
                text-align: center;
                color: #8b93a8;
            }
            .tp-join-link {
                background: none;
                border: none;
                color: #8b93a8;
                text-decoration: underline;
                cursor: pointer;
                font-size: 13px;
            }
        `;
        document.head.appendChild(style);
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

            <div id="tp-error" class="error-message hidden" style="max-width:1100px; margin:16px auto 0;"></div>
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
                        <input type="file" accept="image/*" class="tp-cover-input" data-world-id="${world.id}" style="display:none;">
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

    bindEvents() {
        document.getElementById('tp-logout-btn').addEventListener('click', async () => {
            await AuthService.logout();
            window.location.reload();
        });

        document.getElementById('tp-create-world-btn').addEventListener('click', async () => {
            const name = window.prompt('Название нового мира:');
            if (!name || !name.trim()) return;

            try {
                await WorldsService.createWorld(name.trim());
                await this.loadAndRender();
            } catch (err) {
                this.showError('Не удалось создать мир: ' + err.message);
            }
        });

        document.getElementById('tp-join-link').addEventListener('click', async () => {
            const code = window.prompt('Код приглашения:');
            if (!code || !code.trim()) return;

            try {
                await WorldsService.joinWorldByInviteCode(code.trim());
                await this.loadAndRender();
            } catch (err) {
                this.showError('Неверный или истёкший код приглашения');
            }
        });

        document.getElementById('tp-delete-world-btn').addEventListener('click', async () => {
            if (this.selectedWorldIds.size === 0) return;

            const names = this.worlds
                .filter(w => this.selectedWorldIds.has(w.id))
                .map(w => w.name)
                .join(', ');

            const confirmed = window.confirm(
                `Удалить выбранные миры (${names}) со всеми картами и локациями? Это необратимо.`
            );
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