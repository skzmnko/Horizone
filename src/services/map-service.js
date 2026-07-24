// Максимальный зум для старого режима "одна картинка на всю карту" —
// ровно то значение, что раньше было зашито в L.map() напрямую.
// Держим его и для карт без тайлов (легаси-данные или тайлы ещё не
// сгенерированы/не удались), чтобы их поведение не изменилось ни на
// пиксель.
const LEGACY_NATIVE_ZOOM = 5;

class MapService {
    constructor() {
        this.map = null;
        this.bounds = null;
        this.mapWidth = 10000;
        this.mapHeight = 10000;
        this.nativeZoom = LEGACY_NATIVE_ZOOM;
        this.scaleControl = null;
        this.imageLayer = null;
        this.tileLayer = null;
    }

    // mapConfig = { width, height, imageUrl, tileUrlTemplate, tileSize, nativeZoom, tilesReady }
    // width/height — реальный размер загруженной картинки карты (в пикселях)
    // imageUrl — публичная ссылка на исходное изображение в Supabase Storage
    //            (легаси-режим и запасной вариант, пока/если тайлы недоступны)
    // tileUrlTemplate/tileSize/nativeZoom/tilesReady — параметры тайловой
    //            пирамиды (см. MapTileService). Если tilesReady не true,
    //            карта рисуется старым способом — одним изображением.
    initialize(mapElementId, mapConfig = {}) {
        this.mapWidth = mapConfig.width || 10000;
        this.mapHeight = mapConfig.height || 10000;

        this.tilesReady = !!(mapConfig.tilesReady && mapConfig.tileUrlTemplate && mapConfig.nativeZoom != null);

        // Раньше зум был жёстко зашит в 0..5 для всех карт независимо от
        // реального разрешения картинки (сама картинка была одна на все
        // уровни, браузер просто растягивал/сжимал её через CSS). Теперь,
        // когда есть тайлы, "нативный" зум зависит от фактического
        // разрешения загруженной картинки — так на маленькой карте не
        // будет лишних уровней зума без реальной детализации, а на очень
        // крупной будет достаточно уровней, чтобы разглядеть детали, не
        // растягивая пиксели.
        this.nativeZoom = this.tilesReady ? mapConfig.nativeZoom : LEGACY_NATIVE_ZOOM;

        this.map = L.map(mapElementId, {
            minZoom: 0,
            maxZoom: this.nativeZoom,
            zoomSnap: 0.5,
            attributionControl: false,
            preferCanvas: true,
            crs: L.CRS.Simple,
            zoomControl: false
        });

        const southWest = this.map.unproject([0, this.mapHeight], this.map.getMaxZoom());
        const northEast = this.map.unproject([this.mapWidth, 0], this.map.getMaxZoom());
        this.bounds = new L.LatLngBounds(southWest, northEast);

        if (this.tilesReady) {
            this.tileLayer = L.tileLayer(mapConfig.tileUrlTemplate, {
                tileSize: mapConfig.tileSize || 256,
                minZoom: 0,
                maxNativeZoom: this.nativeZoom,
                maxZoom: this.nativeZoom,
                noWrap: true,
                bounds: this.bounds,
                keepBuffer: 2
            }).addTo(this.map);
        } else if (mapConfig.imageUrl) {
            this.imageLayer = L.imageOverlay(mapConfig.imageUrl, this.bounds).addTo(this.map);
        }

        this.createScaleControl();
        this.createCustomZoomControl();

        this.map.setView(this.bounds.getCenter(), 2);

        this.map.on('zoomend', () => {
            this.updateScaleControl();
        });

        this.updateScaleControl();

        return this.map;
    }

    createCustomZoomControl() {
        const zoomControl = L.control.zoom({
            position: 'bottomright'
        });

        zoomControl.addTo(this.map);

        setTimeout(() => {
            const zoomContainer = document.querySelector('.leaflet-control-zoom');
            const scaleContainer = document.querySelector('.leaflet-control-scale');

            if (zoomContainer && scaleContainer) {
                scaleContainer.parentNode.insertBefore(zoomContainer, scaleContainer);
                zoomContainer.style.marginBottom = '5px';
            }
        }, 100);
    }

    createScaleControl() {
        this.scaleControl = L.control({ position: 'bottomright' });

        this.scaleControl.onAdd = () => {
            this.scaleContainer = L.DomUtil.create('div', 'leaflet-control-scale leaflet-control-scale-custom');
            // Класс leaflet-control-scale-custom определён в markers.css
            return this.scaleContainer;
        };

        this.scaleControl.addTo(this.map);
    }

    updateScaleControl() {
        if (!this.scaleContainer) return;

        // Примечание: значения масштаба в милях подобраны под демо-карту
        // из старого проекта и не отражают реальный масштаб произвольной
        // пользовательской карты. Это чисто косметическая метка — если
        // важна точная шкала расстояний, эту часть стоит доработать отдельно
        // (например, дать DM указать масштаб при загрузке карты).
        const currentZoom = this.map.getZoom();

        const scaleConfig = {
            0: { miles: 1600, width: 100 },
            1: { miles: 800, width: 100 },
            2: { miles: 400, width: 100 },
            3: { miles: 200, width: 100 },
            4: { miles: 100, width: 100 },
            5: { miles: 50, width: 100 }
        };

        // Таблица исторически рассчитана на 6 уровней (0..5), а нативный
        // зум теперь может быть больше для очень крупных тайловых карт —
        // прижимаем индекс сверху, чтобы не откатываться на "1600 миль"
        // при максимальном увеличении крупной карты.
        const clampedZoom = Math.min(currentZoom, 5);
        const config = scaleConfig[clampedZoom] || scaleConfig[0];
        const scaleText = `${config.miles} ${config.miles === 1 ? 'миля' : 'миль'}`;

        this.scaleContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="width: ${config.width}px; height: 4px; background: #000000; border: 1px solid #000000;"></div>
                    <div style="color: #000000; font-size: 10px; margin-top: 2px; font-weight: bold;">${scaleText}</div>
                </div>
            </div>
        `;
    }

    percentToLatLng(percentCoords) {
        const x_percent = percentCoords[0];
        const y_percent = percentCoords[1];

        const x_px = (x_percent / 100) * this.mapWidth;
        const y_px = (y_percent / 100) * this.mapHeight;

        return this.map.unproject([x_px, y_px], this.map.getMaxZoom());
    }

    resetView() {
        if (this.map && this.bounds) {
            this.map.setView(this.bounds.getCenter(), 2);
        }
    }

    flyTo(latLng, zoom = 2) {
        if (this.map) {
            this.map.flyTo(latLng, zoom);
        }
    }

    getCurrentZoom() {
        return this.map ? this.map.getZoom() : 0;
    }

    onZoomEnd(callback) {
        if (this.map) {
            this.map.on('zoomend', callback);
        }
    }
}

export default new MapService();