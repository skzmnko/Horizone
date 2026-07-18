import MapService from '../services/map-service.js';

class DMCoordinatePicker {
    constructor() {
        this.isActive = false;
        this.originalCursor = null;
        this.onCoordinatePick = null;
        this.tempMarker = null;
        this.tempCircle = null;
        this.coordsDisplay = null;
        this.displayContainer = null;
    }

    activate(onPickCallback) {
        if (this.isActive) return;
        this.isActive = true;
        this.onCoordinatePick = onPickCallback;

        const mapContainer = document.getElementById('map');
        this.originalCursor = mapContainer.style.cursor;
        mapContainer.style.cursor = 'crosshair';

        this.createCoordsDisplay();

        MapService.map.on('click', this.handleMapClick);
        MapService.map.on('mousemove', this.handleMapMove);

        console.log('🎯 Coordinate picker activated');
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;

        const mapContainer = document.getElementById('map');
        mapContainer.style.cursor = this.originalCursor || '';

        MapService.map.off('click', this.handleMapClick);
        MapService.map.off('mousemove', this.handleMapMove);

        this.removeTempMarker();
        this.removeCoordsDisplay();

        this.onCoordinatePick = null;
        console.log('🎯 Coordinate picker deactivated');
    }

    createCoordsDisplay() {
        this.displayContainer = document.createElement('div');
        this.displayContainer.id = 'dm-coords-display';
        // Заменяем инлайн-стили на класс
        this.displayContainer.className = 'dm-coords-display';
        this.displayContainer.innerHTML = `
            <div class="dm-coords-title">🎯 Click coordinates</div>
            <div class="dm-coords-values">X: <span id="dm-coord-x">--</span>%, Y: <span id="dm-coord-y">--</span>%</div>
            <div class="dm-coords-pixels">(pixels: <span id="dm-coord-px">--</span>, <span id="dm-coord-py">--</span>)</div>
            <div class="dm-coords-hint">Click on the map to select a point</div>
        `;
        document.body.appendChild(this.displayContainer);
    }

    removeCoordsDisplay() {
        if (this.displayContainer && this.displayContainer.parentNode) {
            this.displayContainer.parentNode.removeChild(this.displayContainer);
            this.displayContainer = null;
        }
    }

    updateCoordsDisplay(percentX, percentY, pixelX, pixelY) {
        if (!this.displayContainer) return;
        const xEl = document.getElementById('dm-coord-x');
        const yEl = document.getElementById('dm-coord-y');
        const pxEl = document.getElementById('dm-coord-px');
        const pyEl = document.getElementById('dm-coord-py');
        if (xEl) xEl.textContent = percentX.toFixed(2);
        if (yEl) yEl.textContent = percentY.toFixed(2);
        if (pxEl) pxEl.textContent = Math.round(pixelX);
        if (pyEl) pyEl.textContent = Math.round(pixelY);
    }

    handleMapClick = (e) => {
        if (!this.isActive) return;

        const latlng = e.latlng;
        const pointPixels = MapService.map.project(latlng, MapService.map.getMaxZoom());
        const pixelX = pointPixels.x;
        const pixelY = pointPixels.y;

        // Размер карты теперь берём из MapService — он соответствует
        // реальной загруженной картинке текущего мира, а не зашитым 10000
        const percentX = (pixelX / MapService.mapWidth) * 100;
        const percentY = (pixelY / MapService.mapHeight) * 100;

        this.updateCoordsDisplay(percentX, percentY, pixelX, pixelY);

        this.updateTempMarker(latlng, percentX, percentY);

        if (this.onCoordinatePick) {
            this.onCoordinatePick({
                coords: [percentX, percentY],
                pixelX: Math.round(pixelX),
                pixelY: Math.round(pixelY),
                percentX: percentX,
                percentY: percentY,
                latlng: latlng
            });
        }
    };

    handleMapMove = (e) => {
        if (!this.isActive) return;

        const latlng = e.latlng;
        const pointPixels = MapService.map.project(latlng, MapService.map.getMaxZoom());
        const pixelX = pointPixels.x;
        const pixelY = pointPixels.y;

        const percentX = (pixelX / MapService.mapWidth) * 100;
        const percentY = (pixelY / MapService.mapHeight) * 100;

        this.updateCoordsDisplay(percentX, percentY, pixelX, pixelY);
    };

    updateTempMarker(latlng, percentX, percentY) {
        this.removeTempMarker();

        this.tempCircle = L.circle(latlng, {
            color: '#1a7f7f',
            fillColor: '#1a7f7f',
            fillOpacity: 0.2,
            radius: 40,
            weight: 2,
            className: 'dm-temp-marker'
        }).addTo(MapService.map);

        this.tempMarker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'dm-temp-marker-icon', // используем CSS-класс
                html: `<div></div>`, // пустой div, стили задаются через CSS
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            })
        }).addTo(MapService.map);

        this.tempMarker.bindPopup(`
            <strong>📍 Selected point</strong><br>
            X: ${percentX.toFixed(2)}%<br>
            Y: ${percentY.toFixed(2)}%
        `).openPopup();
    }

    removeTempMarker() {
        if (this.tempMarker) {
            MapService.map.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }
        if (this.tempCircle) {
            MapService.map.removeLayer(this.tempCircle);
            this.tempCircle = null;
        }
    }

    toggle(onPickCallback) {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate(onPickCallback);
        }
    }

    get isActiveState() {
        return this.isActive;
    }
}

export default new DMCoordinatePicker();