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
        this.imageWidth = 10000;
        this.imageHeight = 10000;
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
        this.displayContainer.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(26, 127, 127, 0.5);
            border-radius: 8px;
            padding: 12px 20px;
            color: #ffffff;
            font-family: monospace;
            font-size: 14px;
            z-index: 9999;
            min-width: 250px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
            pointer-events: none;
        `;
        this.displayContainer.innerHTML = `
            <div style="color: #7fbfbf; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                🎯 Click coordinates
            </div>
            <div style="font-size: 16px; color: #ffffff;">
                X: <span id="dm-coord-x">--</span>%, Y: <span id="dm-coord-y">--</span>%
            </div>
            <div style="font-size: 12px; color: #a3a3a3; margin-top: 4px;">
                (pixels: <span id="dm-coord-px">--</span>, <span id="dm-coord-py">--</span>)
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
                Click on the map to select a point
            </div>
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

        const percentX = (pixelX / this.imageWidth) * 100;
        const percentY = (pixelY / this.imageHeight) * 100;

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

        const percentX = (pixelX / this.imageWidth) * 100;
        const percentY = (pixelY / this.imageHeight) * 100;

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
                className: 'dm-temp-marker-icon',
                html: `<div style="
                    width: 14px;
                    height: 14px;
                    background: #1a7f7f;
                    border: 2px solid #ffffff;
                    border-radius: 50%;
                    box-shadow: 0 0 15px rgba(26, 127, 127, 0.5);
                "></div>`,
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