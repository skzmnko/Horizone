import './leaflet-global.js';
import DataService from './services/data-service.js';
import MapService from './services/map-service.js';
import LayerService from './services/layer-service.js';
import MarkerService from './services/marker-service.js';
import SearchService from './services/search-service.js';
import UIService from './services/ui-service.js';
import AuthService from './services/auth-service.js';
import LocationVisibilityService from './services/location-visibility-service.js';
import LoginPage from './utils/login-page.js';
import WorldSelectionPage from './utils/world-selection-page.js';
import MapUploadPage from './utils/map-upload-page.js';
import MapImageService from './services/map-image-service.js';
import WorldsService from './services/worlds-service.js';
import DetailPanelService from './services/detail-panel-service.js';
import DMToolsPanel from './dm/dm-tools-panel.js';

async function waitForLeaflet() {
    const maxWaitTime = 10000;
    const startTime = Date.now();

    while (typeof L === 'undefined') {
        if (Date.now() - startTime > maxWaitTime) {
            throw new Error('Leaflet did not load for 10 seconds');
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log('✅ Leaflet downloaded');
}

class Application {
    constructor() {
        this.locations = [];
        this.filteredLocations = [];
        this.initialized = false;
        this.uiService = null;
        this.loginPage = null;
        this.worldSelectionPage = null;
        this.dmToolsPanel = null;
        this.currentMapId = null;
        this.isMobile = window.innerWidth <= 768;
    }

    async initialize() {
        try {
            console.log('🚀 Application initialization...');

            this.uiService = new UIService();

            const isAuthenticated = await AuthService.checkAuthStatus();

            if (!isAuthenticated) {
                this.showLoginPage();
                return;
            }

            this.showWorldSelectionPage();

        } catch (error) {
            console.error('❌ Application initialization error:', error);
        }
    }

    showLoginPage() {
        this.loginPage = new LoginPage();
        this.loginPage.initialize(() => {
            this.showWorldSelectionPage();
        });
    }

    showWorldSelectionPage() {
        this.worldSelectionPage = new WorldSelectionPage();
        this.worldSelectionPage.initialize(({ worldId, mapId }) => {
            this.currentWorldId = worldId;
            this.currentMapId = mapId;
            this.resolveMapAndProceed(worldId, mapId);
        });
    }

    async resolveMapAndProceed(worldId, mapId) {
        if (!mapId) {
            if (AuthService.isDM()) {
                const mapUploadPage = new MapUploadPage();
                mapUploadPage.initialize(
                    worldId,
                    null,
                    (map) => {
                        this.currentMapId = map.id;
                        this.mapImageUrl = MapImageService.getPublicUrl(map.image_path);
                        this.mapWidth = map.width;
                        this.mapHeight = map.height;
                        this.initializeApp();
                    },
                    () => { this.showWorldSelectionPage(); }
                );
            } else {
                this.showWaitingForMapMessage();
            }
            return;
        }

        const map = await WorldsService.getMap(mapId);

        if (!map.image_path) {
            if (AuthService.isDM()) {
                const mapUploadPage = new MapUploadPage();
                mapUploadPage.initialize(
                    worldId,
                    mapId,
                    () => { this.initializeApp(); },
                    () => { this.showWorldSelectionPage(); }
                );
            } else {
                this.showWaitingForMapMessage();
            }
            return;
        }

        this.mapImageUrl = MapImageService.getPublicUrl(map.image_path);
        this.mapWidth = map.width;
        this.mapHeight = map.height;
        this.initializeApp();
    }

    showWaitingForMapMessage() {
        const container = document.createElement('div');
        container.className = 'login-page';
        container.innerHTML = `
            <div class="login-container">
                <div class="login-header">
                    <h1>Карта ещё не готова</h1>
                    <p>Мастер пока не загрузил изображение карты для этого мира</p>
                </div>
                <button id="back-to-worlds-from-waiting" class="login-btn">
                    ← Назад к мирам
                </button>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('back-to-worlds-from-waiting').addEventListener('click', () => {
            container.parentNode.removeChild(container);
            this.showWorldSelectionPage();
        });
    }

    async initializeApp() {
        await waitForLeaflet();

        MapService.initialize('map', {
            width: this.mapWidth,
            height: this.mapHeight,
            imageUrl: this.mapImageUrl
        });
        console.log('✅ The map has been initialized');

        this.uiService.showLoading();
        this.locations = await DataService.loadAllLocations(this.currentMapId);
        this.uiService.hideLoading();

        this.filteredLocations = LocationVisibilityService.filterLocationsByRole(this.locations);

        LayerService.initializeLayers();
        LayerService.addLayersToMap();
        MarkerService.initializeIcons();

        this.createMarkers();

        this.setupInteractions();

        this.initialized = true;
        console.log('🎉 The application is completely initialized');
        console.log(`👤 Current user: ${AuthService.getCurrentUser().displayName}`);
        console.log(`🎭 Role: ${AuthService.getCurrentUser().role}`);
        console.log(`📍 Locations shown: ${this.filteredLocations.length} из ${this.locations.length}`);
        console.log(`📱 Mobile device: ${this.isMobile ? 'Yes' : 'No'}`);
    }

    createMarkers() {
        this.filteredLocations.forEach(location => {
            const targetLayer = LayerService.getLayer(location.type);
            if (targetLayer) {
                MarkerService.addMarker(location, targetLayer);
            }
        });

        MarkerService.setupZoomListener(this.filteredLocations);
    }

    setupInteractions() {
        this.uiService.initialize();
        LayerService.bindLayerControls();
        SearchService.initialize();

        this.updateMobileDMButtonVisibility();
        this.addBackToWorldsButton();

        if (AuthService.isDM()) {
            this.addReuploadMapButton();
        }

        if (AuthService.isDM() && !this.isMobile) {
            this.dmToolsPanel = DMToolsPanel;
            this.dmToolsPanel.initialize();
            console.log('🛠️ DM Tools initialized (desktop mode)');
        } else if (AuthService.isDM() && this.isMobile) {
            console.log('📱 DM Tools panel disabled on mobile (only mobile button shown)');
        }

        LayerService.hideGeographicLayers();

        setTimeout(() => {
            LayerService.updateLocationCounters();
        }, 100);

        window.mapService = MapService;
        window.layerService = LayerService;
        window.dataService = DataService;
        window.authService = AuthService;
        window.detailPanelService = DetailPanelService;
        window.dmToolsPanel = DMToolsPanel;
    }

    getFloatingBtnGroup() {
        let group = document.getElementById('floating-btn-group');
        if (!group) {
            group = document.createElement('div');
            group.id = 'floating-btn-group';
            group.className = 'floating-btn-group';
            document.body.appendChild(group);
        }
        return group;
    }

    addBackToWorldsButton() {
        const btn = document.createElement('button');
        btn.id = 'back-to-worlds-btn';
        btn.className = 'floating-btn';
        btn.textContent = '← Миры';
        btn.title = 'Вернуться к списку миров';
        btn.addEventListener('click', () => {
            // Полная перезагрузка — самый надёжный способ корректно
            // разобрать карту и все связанные с ней UI-сервисы
            // (DM-панель, поиск, детали локации), не переписывая
            // их под явное уничтожение. Сессия сохранена в Supabase,
            // поэтому после перезагрузки открывается сразу список миров,
            // а не форма логина.
            window.location.reload();
        });
        this.getFloatingBtnGroup().appendChild(btn);
    }

    addReuploadMapButton() {
        const btn = document.createElement('button');
        btn.id = 'reupload-map-btn';
        btn.className = 'floating-btn';
        btn.textContent = '🔄 Обновить карту мира';
        btn.title = 'Загрузить новое изображение карты';
        btn.addEventListener('click', () => {
            this.showReuploadMapOverlay();
        });
        this.getFloatingBtnGroup().appendChild(btn);
    }

    showReuploadMapOverlay() {
        const mapUploadPage = new MapUploadPage();
        mapUploadPage.initialize(
            this.currentWorldId,
            this.currentMapId,
            () => {
                // Проще всего перезагрузить страницу — она сама подхватит
                // новую картинку карты через уже отработанный поток входа
                window.location.reload();
            },
            () => {
                mapUploadPage.hide();
            }
        );
    }

    updateMobileDMButtonVisibility() {
        const mobileDmBtn = document.getElementById('mobile-dm-tools-btn');
        if (!mobileDmBtn) return;

        const isDM = AuthService.isDM();

        if (this.isMobile && isDM) {
            mobileDmBtn.style.display = 'flex';
            console.log('📱 Mobile DM Tools button shown (DM user on mobile)');
        } else {
            mobileDmBtn.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new Application();
    await app.initialize();
});