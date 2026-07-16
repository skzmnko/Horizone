import MapImageService from '../services/map-image-service.js';
import WorldsService from '../services/worlds-service.js';

class MapUploadPage {
    constructor() {
        this.container = null;
        this.onUploaded = null;
        this.onBack = null;
    }

    // mapId может быть null — тогда карта ещё не существует в БД и будет
    // создана прямо в момент нажатия "Загрузить", одновременно с картинкой
    initialize(worldId, mapId, onUploaded, onBack) {
        this.worldId = worldId;
        this.mapId = mapId;
        this.onUploaded = onUploaded;
        this.onBack = onBack;
        this.render();
        this.bindEvents();
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'login-page';
        this.container.innerHTML = `
            <div class="login-container">
                <div class="login-header">
                    <h1>Загрузи карту мира</h1>
                    <p>В этом мире пока нет изображения карты</p>
                </div>
                <input type="file" id="map-image-input" accept="image/*" class="file-input">
                <button id="map-upload-btn" class="login-btn">Загрузить</button>
                <div id="map-upload-error" class="error-message hidden"></div>
                <button id="map-upload-back-btn" class="login-back-link">
                    ← Назад к мирам
                </button>
            </div>
        `;
        document.body.appendChild(this.container);
    }

    bindEvents() {
        const btn = document.getElementById('map-upload-btn');
        btn.addEventListener('click', () => this.handleUpload(btn));

        const backBtn = document.getElementById('map-upload-back-btn');
        backBtn.addEventListener('click', () => {
            this.hide();
            if (this.onBack) this.onBack();
        });
    }

    async handleUpload(btn) {
        const input = document.getElementById('map-image-input');
        const file = input.files[0];
        if (!file) return;

        btn.disabled = true;
        btn.textContent = 'Загрузка...';

        let mapId = this.mapId;
        let mapCreatedNow = false;

        try {
            // Карты в БД ещё нет — создаём её только сейчас, вместе с картинкой,
            // а не заранее в момент простого клика по миру
            if (!mapId) {
                const map = await WorldsService.createMap(this.worldId, 'Карта мира');
                mapId = map.id;
                mapCreatedNow = true;
            }

            const updatedMap = await MapImageService.uploadMapImage(file, this.worldId, mapId);

            this.hide();
            if (this.onUploaded) this.onUploaded(updatedMap);

        } catch (err) {
            // Если картинка не загрузилась, а карту мы только что создали —
            // не оставляем в базе пустую карту без картинки, откатываем создание
            if (mapCreatedNow && mapId) {
                try {
                    await WorldsService.deleteMap(mapId);
                } catch (cleanupErr) {
                    console.warn('⚠️ Failed to clean up empty map after upload error:', cleanupErr);
                }
            }

            const errorEl = document.getElementById('map-upload-error');
            errorEl.textContent = 'Ошибка загрузки: ' + err.message;
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Загрузить';
        }
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default MapUploadPage;