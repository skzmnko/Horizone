import MapImageService from '../services/map-image-service.js';

class MapUploadPage {
    constructor() {
        this.container = null;
        this.onUploaded = null;
    }

    initialize(worldId, mapId, onUploaded) {
        this.worldId = worldId;
        this.mapId = mapId;
        this.onUploaded = onUploaded;
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
                <input type="file" id="map-image-input" accept="image/*" style="margin:16px 0; color:#fff;">
                <button id="map-upload-btn" class="login-btn">Загрузить</button>
                <div id="map-upload-error" class="error-message hidden"></div>
            </div>
        `;
        document.body.appendChild(this.container);
    }

    bindEvents() {
        const btn = document.getElementById('map-upload-btn');
        btn.addEventListener('click', async () => {
            const input = document.getElementById('map-image-input');
            const file = input.files[0];
            if (!file) return;

            btn.disabled = true;
            btn.textContent = 'Загрузка...';

            try {
                const map = await MapImageService.uploadMapImage(file, this.worldId, this.mapId);
                this.hide();
                if (this.onUploaded) this.onUploaded(map);
            } catch (err) {
                const errorEl = document.getElementById('map-upload-error');
                errorEl.textContent = 'Ошибка загрузки: ' + err.message;
                errorEl.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = 'Загрузить';
            }
        });
    }

    hide() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default MapUploadPage;
