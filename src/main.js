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
import ResetPasswordPage from './utils/reset-password-page.js';
import WorldSelectionPage from './utils/world-selection-page.js';
import WorldControlPage from './utils/world-control-page.js';
import MapImageService from './services/map-image-service.js';
import WorldsService from './services/worlds-service.js';
import DetailPanelService from './services/detail-panel-service.js';
import DMToolsPanel from './dm/dm-tools-panel.js';

// ?world=WORLD_ID в адресной строке — используется ТОЛЬКО для DM
// (см. enterWorld()). Игроки/наблюдатели идут прямиком в карту, как и
// раньше, и этот параметр для них никогда не проставляется.
//
// Зачем он вообще нужен: выход из интерактивной карты по-прежнему делает
// полный window.location.reload() (безопасно пересоздавать Leaflet и
// сервисы карты иначе рискованно) — а после reload вся JS-память
// приложения теряется. Параметр в URL — единственный способ после такой
// перезагрузки понять "вернуть DM надо не в общий список миров, а на
// страницу управления вот этим конкретным миром".
function setWorldUrlParam(worldId) {
    const params = new URLSearchParams(window.location.search);
    params.set('world', worldId);
    const newUrl = window.location.pathname + `?${params.toString()}` + window.location.hash;
    window.history.replaceState({}, '', newUrl);
}

function clearWorldUrlParam() {
    const params = new URLSearchParams(window.location.search);
    params.delete('world');
    const query = params.toString();
    const newUrl = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
}

function getWorldUrlParam() {
    return new URLSearchParams(window.location.search).get('world');
}

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

            // Ссылка из письма "Забыли пароль?" приводит сюда с особым
            // событием — вместо обычного флоу показываем форму нового пароля
            let recoveryHandled = false;
            AuthService.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY' && !recoveryHandled) {
                    recoveryHandled = true;
                    this.showResetPasswordPage();
                }
            });

            // Небольшая пауза даёт Supabase время разобрать токен из URL
            // и успеть эмиттировать PASSWORD_RECOVERY до того, как мы
            // продолжим обычную проверку сессии
            await new Promise(resolve => setTimeout(resolve, 150));
            if (recoveryHandled) return;

            const isAuthenticated = await AuthService.checkAuthStatus();

            if (!isAuthenticated) {
                this.showLoginPage();
                return;
            }

            // Бывает после reload из интерактивной карты (см. addBackToWorldsButton)
            // или просто если DM освежил страницу/открыл её по сохранённой ссылке —
            // ?world= проставляется только для DM, поэтому такое восстановление
            // никогда не срабатывает для игроков/наблюдателей.
            const restoredWorldId = getWorldUrlParam();
            if (restoredWorldId) {
                await this.enterWorld(restoredWorldId);
                return;
            }

            this.showWorldSelectionPage();

        } catch (error) {
            console.error('❌ Application initialization error:', error);
        }
    }

    showResetPasswordPage() {
        const resetPage = new ResetPasswordPage();
        resetPage.initialize(() => {
            this.showWorldSelectionPage();
        });
    }

    showLoginPage() {
        this.loginPage = new LoginPage();

        this.loginPage.initialize(() => {
            const restoredWorldId = getWorldUrlParam();
            if (restoredWorldId) {
                this.enterWorld(restoredWorldId);
                return;
            }

            this.showWorldSelectionPage();
        });
    }

    showWorldSelectionPage() {
        clearWorldUrlParam();
        this.worldSelectionPage = new WorldSelectionPage();
        this.worldSelectionPage.initialize(({ worldId }) => {
            this.enterWorld(worldId);
        });
    }

    // Единая точка входа в мир — определяет роль и решает, куда вести
    // человека дальше: DM всегда попадает на страницу управления миром
    // (world-control-page), игрок/наблюдатель — как и раньше, сразу
    // в интерактивную карту (или на заглушку "карта ещё не готова").
    async enterWorld(worldId) {
        // КЛЮЧЕВОЙ МОМЕНТ: роль — не свойство аккаунта, а свойство
        // конкретного мира. Устанавливаем её здесь, до первого же
        // обращения к AuthService.isDM() ниже по цепочке (в том числе
        // внутри initializeApp/setupInteractions и сервисов вроде
        // DetailPanelService, LayerService, MarkerService).
        const role = await WorldsService.getMyRoleInWorld(worldId);
        AuthService.setCurrentWorldRole(role);

        this.currentWorldId = worldId;

        const maps = await WorldsService.getMapsForWorld(worldId);
        const map = maps[0] || null;
        this.currentMapId = map ? map.id : null;

        if (AuthService.isDM()) {
            this.showWorldControlPage(worldId, this.currentMapId);
        } else {
            this.openMapView(worldId, this.currentMapId);
        }
    }

    showWorldControlPage(worldId, mapId) {
        setWorldUrlParam(worldId);

        this.worldControlPage = new WorldControlPage();
        this.worldControlPage.initialize(worldId, mapId, {
            onEnterMap: ({ mapId }) => {
                this.currentMapId = mapId;
                this.openMapView(worldId, mapId);
            },
            onBackToWorlds: () => {
                this.showWorldSelectionPage();
            }
        });
    }

    // Показывает саму интерактивную карту (Leaflet). Для DM сюда попадают
    // только через "🗺️ Войти в мир" на странице управления — сама загрузка
    // карты туда уже не заведёт (это делает клик по блоку карты на той
    // странице). Ветка "нет карты" здесь — просто подстраховка на случай,
    // если DM как-то оказался тут раньше, чем загрузил карту.
    async openMapView(worldId, mapId) {
        if (!mapId) {
            if (AuthService.isDM()) {
                this.showWorldControlPage(worldId, null);
            } else {
                this.showWaitingForMapMessage();
            }
            return;
        }

        const map = await WorldsService.getMap(mapId);

        if (!map.image_path) {
            if (AuthService.isDM()) {
                this.showWorldControlPage(worldId, mapId);
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

        // Только теперь показываем реальную "начинку" карты — до этого
        // момента она была скрыта через body.app-loading (см. base.css)
        document.body.classList.remove('app-loading');

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
        console.log(`🎭 Role in this world: ${AuthService.getCurrentWorldRole()}`);
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

        if (!AuthService.isDM()) {
            this.addChangeDisplayNameButton();
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
        const isDM = AuthService.isDM();

        const btn = document.createElement('button');
        btn.id = 'back-to-worlds-btn';
        btn.className = 'floating-btn';
        btn.textContent = isDM ? '← К управлению миром' : '← Миры';
        btn.title = isDM ? 'Вернуться на страницу управления миром' : 'Вернуться к списку миров';
        btn.addEventListener('click', () => {
            // Полная перезагрузка — самый надёжный способ корректно
            // разобрать карту и все связанные с ней UI-сервисы
            // (DM-панель, поиск, детали локации), не переписывая
            // их под явное уничтожение. Сессия сохранена в Supabase,
            // а для DM в адресной строке остался ?world=<id> — поэтому
            // после перезагрузки он попадёт обратно на страницу
            // управления именно этим миром, а не в общий список.
            window.location.reload();
        });
        this.getFloatingBtnGroup().appendChild(btn);
    }

    addChangeDisplayNameButton() {
        const btn = document.createElement('button');
        btn.id = 'change-display-name-btn';
        btn.className = 'floating-btn';
        btn.textContent = '✎ Моё имя в этом мире';
        btn.title = 'Задать своё отображаемое имя (например, имя персонажа)';
        btn.addEventListener('click', async () => {
            // Простой браузерный prompt — сознательно не стилизуем сейчас,
            // как и другие подобные разовые формы, если понадобится
            // покрасивее — легко заменить на модалку по образцу
            // world-selection-page.js
            const name = window.prompt('Отображаемое имя в этом мире (например, имя персонажа):');
            if (name === null) return;

            try {
                await WorldsService.setMyWorldDisplayName(this.currentWorldId, name.trim());
                console.log('✅ Display name updated for this world');
            } catch (err) {
                alert('Не удалось сохранить имя: ' + err.message);
            }
        });
        this.getFloatingBtnGroup().appendChild(btn);
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