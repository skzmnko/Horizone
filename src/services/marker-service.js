import { iconUrls, typeTranslations } from '../core/constants.js';
import MapService from './map-service.js';
import DetailPanelService from './detail-panel-service.js';
import AuthService from './auth-service.js';

class MarkerService {
    constructor() {
        this.currentIcons = {};
        this.zoomTimeout = null;
        this.isDM = false;
    }

    initializeIcons() {
        this.isDM = AuthService.isDM();
        
        Object.keys(iconUrls).forEach(type => {
            this.currentIcons[type] = this.createCustomIcon(type);
        });
        
        DetailPanelService.initialize();
        
        console.log(`✅ Маркеры инициализированы для роли: ${this.isDM ? 'DM' : 'Player'}`);
    }

    createCustomIcon(type) {
        const currentZoom = MapService.getCurrentZoom();
        let baseSize;
        
        if (currentZoom <= 0) baseSize = 16;
        else if (currentZoom === 1) baseSize = 20;
        else if (currentZoom === 2) baseSize = 24;
        else if (currentZoom === 3) baseSize = 28;
        else baseSize = 32;

        const typeDisplayName = this.getTypeDisplayName(type);
        
        return L.divIcon({
            className: `custom-icon custom-icon-${type}`,
            html: `<img src="${iconUrls[type]}" alt="${typeDisplayName}" 
                   style="width:${baseSize}px; height:${baseSize}px;">`,
            // object-fit и filter вынесены в CSS (.custom-icon img)
            iconSize: [baseSize, baseSize],
            iconAnchor: [baseSize/2, baseSize/2],
            popupAnchor: [0, -baseSize/2]
        });
    }

    getTypeDisplayName(type) {
        const typeNames = {
            cities: 'Город',
            feyspires: 'Фейский Шпиль',
            settlements: 'Поселение',
            farms: 'Ферма',
            ruins: 'Руины',
            dungeons: 'Подземелье',
            caves: 'Пещера',
            secrets: 'Секрет',
            forts: 'Форт',
            shrines: 'Храм',
            poi: 'Точка интереса',
            enclaves: 'Анклав'
        };
        return typeNames[type] || type;
    }

    addMarker(location, targetLayer) {
        try {
            const latLng = MapService.percentToLatLng(location.coords);
            
            const marker = L.marker(latLng, {
                icon: this.currentIcons[location.type]
            }).addTo(targetLayer);
            
            location.marker = marker;
            location.latLng = latLng;

            marker.on('click', (e) => {
                if (marker.getPopup()) {
                    marker.closePopup();
                }
                DetailPanelService.showLocation(location);
            });

            return marker;
        } catch (error) {
            console.error(`Error when adding a marker ${location.name}:`, error);
            return null;
        }
    }

    updateMarkersSize(locations) {
        const currentZoom = MapService.getCurrentZoom();
        
        Object.keys(iconUrls).forEach(type => {
            const newIcon = this.createCustomIcon(type);
            
            if (!this.currentIcons[type] || 
                this.currentIcons[type].options.iconSize[0] !== newIcon.options.iconSize[0]) {
                
                this.currentIcons[type] = newIcon;
                
                locations.forEach(location => {
                    if (location.marker && location.type === type) {
                        location.marker.setIcon(newIcon);
                    }
                });
            }
        });
    }

    setupZoomListener(locations) {
        MapService.onZoomEnd(() => {
            clearTimeout(this.zoomTimeout);
            this.zoomTimeout = setTimeout(() => {
                this.updateMarkersSize(locations);
            }, 50);
        });
    }
}

export default new MarkerService();