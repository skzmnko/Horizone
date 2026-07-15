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
        this.dmToolsPanel = null;
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

            await this.initializeApp();
            
        } catch (error) {
            console.error('❌ Application initialization error:', error);
        }
    }

    async initializeApp() {
        await waitForLeaflet();

        MapService.initialize('map');
        console.log('✅ The map has been initialized');

        this.uiService.showLoading();
        this.locations = await DataService.loadAllLocations();
        this.uiService.hideLoading();
        
        this.filteredLocations = LocationVisibilityService.filterLocationsByRole(this.locations);
        this.uiService.hideLoading();

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

    showLoginPage() {
        this.loginPage = new LoginPage();
        this.loginPage.initialize(() => {
            this.initializeApp();
        });
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
