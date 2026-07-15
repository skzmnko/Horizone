class MapService {
    constructor() {
        this.map = null;
        this.bounds = null;
        this.mapWidth = 10000;
        this.mapHeight = 10000;
        this.scaleControl = null;
    }

    initialize(mapElementId) {
        this.map = L.map(mapElementId, {
            minZoom: 0,
            maxZoom: 5,
            zoomSnap: 0.5,
            attributionControl: false,
            preferCanvas: true,
            crs: L.CRS.Simple,
            zoomControl: false
        });

        const southWest = this.map.unproject([0, this.mapHeight], this.map.getMaxZoom());
        const northEast = this.map.unproject([this.mapWidth, 0], this.map.getMaxZoom());
        this.bounds = new L.LatLngBounds(southWest, northEast);

        this.addTileLayer();
        
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
            this.scaleContainer = L.DomUtil.create('div', 'leaflet-control-scale');
            this.scaleContainer.style.background = 'rgba(255, 255, 255, 0.85)';
            this.scaleContainer.style.color = '#000000';
            this.scaleContainer.style.padding = '4px 8px';
            this.scaleContainer.style.borderRadius = '4px';
            this.scaleContainer.style.fontSize = '12px';
            this.scaleContainer.style.fontWeight = 'bold';
            this.scaleContainer.style.marginBottom = '10px';
            this.scaleContainer.style.border = '1px solid rgba(0, 0, 0, 0.3)';
            this.scaleContainer.style.textShadow = 'none';
            this.scaleContainer.style.backdropFilter = 'blur(2px)';
            
            return this.scaleContainer;
        };
        
        this.scaleControl.addTo(this.map);
    }

    updateScaleControl() {
        if (!this.scaleContainer) return;
        
        const currentZoom = this.map.getZoom();
        
        const scaleConfig = {
            0: { miles: 1600, width: 100 },
            1: { miles: 800, width: 100 },
            2: { miles: 400, width: 100 },
            3: { miles: 200, width: 100 },
            4: { miles: 100, width: 100 },
            5: { miles: 50, width: 100 }
        };
        
        const config = scaleConfig[currentZoom] || scaleConfig[0];
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

    addTileLayer() {
        const tileLayer = L.tileLayer('images/tiles/{z}/{x}/{y}.{ext}', {
            minZoom: 0,
            maxZoom: 5,
            noWrap: true,
            bounds: this.bounds,
            tileSize: 512,
            attribution: '',
            errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            
            ext: (function() {
                const canvas = document.createElement('canvas');
                return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'webp' : 'png';
            })(),
            
            getTileUrl: function(coords) {
                const y = (1 << coords.z) - coords.y - 1;
                return L.Util.template(this._url, L.extend({
                    x: coords.x,
                    y: y,
                    z: coords.z,
                    ext: this.options.ext,
                    s: this._getSubdomain(coords)
                }, this.options));
            }
        }).addTo(this.map);

        tileLayer.on('tileload', function(e) {
            const tile = e.tile;
            const src = tile.src;
            if (src.includes('/tiles/0/0/0.')) {
                tile.setAttribute('fetchpriority', 'high');
                tile.setAttribute('loading', 'eager');
            }
        });

        return tileLayer;
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
