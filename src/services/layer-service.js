import MapService from './map-service.js';
import DataService from './data-service.js';
import AuthService from './auth-service.js';
import LocationVisibilityService from './location-visibility-service.js';

class LayerService {
    constructor() {
        this.layers = {};
        this.layerControls = {
            'cities-layer': 'cities',
            'feyspires-layer': 'feyspires',
            'settlements-layer': ['settlements', 'farms'],
            'ruins-layer': 'ruins',
            'dungeons-layer': ['dungeons', 'caves'],
            'secrets-layer': 'secrets',
            'forts-layer': 'forts',
            'shrines-layer': 'shrines',
            'poi-layer': 'poi'
        };
        this.initializeLayers();
    }

    initializeLayers() {
        const layerTypes = [
            'cities', 'feyspires', 'settlements', 'farms', 'ruins', 'dungeons', 'tombs', 'caves', 'secrets', 
            'forts', 'shrines', 'poi'
        ];

        layerTypes.forEach(type => {
            this.layers[type] = L.layerGroup();
        });
    }

    addLayersToMap() {
        Object.values(this.layers).forEach(layer => {
            MapService.map.addLayer(layer);
        });
    }

    hideGeographicLayers() {
        console.log('✅ All layers visible by default');
    }

    getLayer(type) {
        return this.layers[type];
    }

    showLayer(type) {
        const layer = this.layers[type];
        if (layer) {
            MapService.map.addLayer(layer);
        }
    }

    hideLayer(type) {
        const layer = this.layers[type];
        if (layer) {
            MapService.map.removeLayer(layer);
        }
    }

    toggleLayer(layerConfig, visible) {
        const types = Array.isArray(layerConfig) ? layerConfig : [layerConfig];
        
        types.forEach(type => {
            if (visible) {
                this.showLayer(type);
            } else {
                this.hideLayer(type);
            }
        });
    }

    showAllLayers() {
        Object.keys(this.layers).forEach(type => {
            this.showLayer(type);
        });
        
        Object.keys(this.layerControls).forEach(checkboxId => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }

    hideAllLayers() {
        Object.keys(this.layers).forEach(type => {
            this.hideLayer(type);
        });
        
        Object.keys(this.layerControls).forEach(checkboxId => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = false;
            }
        });
    }

    bindLayerControls() {
        Object.entries(this.layerControls).forEach(([checkboxId, layerConfig]) => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                const types = Array.isArray(layerConfig) ? layerConfig : [layerConfig];
                const shouldBeVisible = checkbox.checked;

                this.toggleLayer(layerConfig, shouldBeVisible);

                checkbox.addEventListener('change', (e) => {
                    this.toggleLayer(layerConfig, e.target.checked);
                });
            }
        });

        this.updateLocationCounters();
    }

    updateLocationCounters() {
        Object.entries(this.layerControls).forEach(([checkboxId, layerConfig]) => {
            const types = Array.isArray(layerConfig) ? layerConfig : [layerConfig];
        
            let visibleCount;
            let totalCount = this.getAllLocationsCountForTypes(layerConfig);
        
            if (AuthService.isDM()) {
                visibleCount = DataService.allLocations.filter(location => 
                    types.includes(location.type)
                ).length;
            } else {
                visibleCount = DataService.allLocations.filter(location => 
                    types.includes(location.type) && 
                    LocationVisibilityService.shouldShowLocation(location)
                ).length;
            }
        
            this.updateCounterDisplay(checkboxId, visibleCount, totalCount);
        });
    }

    updateCounterDisplay(checkboxId, visibleCount, totalCount) {
        const checkbox = document.getElementById(checkboxId);
        if (!checkbox) return;

        const layerControl = checkbox.closest('.layer-control');
        if (!layerControl) return;

        let counterElement = layerControl.querySelector('.location-counter');
    
        if (!counterElement) {
            counterElement = document.createElement('span');
            counterElement.className = 'location-counter';
            const label = layerControl.querySelector('label');
            if (label) {
                label.appendChild(counterElement);
            }
        }

        if (AuthService.isDM()) {
            counterElement.textContent = `(${totalCount})`;
            counterElement.style.color = 'var(--mg-text-secondary)';
            counterElement.title = `Всего ${totalCount} локаций`;
        } else {
            counterElement.textContent = `(${visibleCount})`;
            counterElement.style.color = 'var(--mg-text-accent)';
            counterElement.title = `Доступно игроку: ${visibleCount} из ${totalCount}`;
        }
    }

    getAllLocationsCountForTypes(layerConfig) {
        const types = Array.isArray(layerConfig) ? layerConfig : [layerConfig];
        return types.reduce((sum, type) => {
            return sum + (DataService.getLocationCount(type) || 0);
        }, 0);
    }

    refreshCounters() {
        this.updateLocationCounters();
    }

    setLayerVisibility(layerConfig, visible) {
        const checkboxId = Object.keys(this.layerControls).find(
            key => this.layerControls[key] === layerConfig
        );
        
        if (checkboxId) {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = visible;
                checkbox.dispatchEvent(new Event('change'));
            }
        }
    }
}

export default new LayerService();
