import AuthService from './auth-service.js';
import SearchService from './search-service.js';
import { t } from './i18n.js';

class UIService {
    constructor() {
        this.controlPanel = null;
        this.panelContainer = null;
        this.panelHeader = null;
        this.panelOpenBtn = null;
        this.panelCloseBtn = null;
        this.mobileFilterBtn = null;
        this.mobileSearchBtn = null;
        this.mobileResetBtn = null;
        this.mobileTopPanel = null;
        this.searchResults = null;
        this.searchInput = null;
        this.isPanelOpen = true;
        this.isMobile = false;
        
        this.desktopProfileBtn = null;
        this.mobileProfileBtn = null;
        this.profilePanel = null;
        this.profileUsername = null;
        this.profileRole = null;
        this.profileLogoutBtn = null;
        this.desktopProfileAvatar = null;
        this.profileAvatar = null;
        this.isProfileOpen = false;
    }

    initialize() {
        this.controlPanel = document.getElementById('control-panel');
        this.panelContainer = document.getElementById('control-panel-container');
        this.panelHeader = document.getElementById('panel-header');
        this.panelOpenBtn = document.getElementById('panel-open-btn');
        this.panelCloseBtn = document.getElementById('panel-close-btn');
        this.mobileFilterBtn = document.getElementById('mobile-filter-btn');
        this.mobileSearchBtn = document.getElementById('mobile-search-btn');
        this.mobileResetBtn = document.getElementById('mobile-reset-btn');
        this.mobileTopPanel = document.getElementById('mobile-top-panel');
        this.searchInput = document.getElementById('search');
        this.searchResults = document.getElementById('search-results');

        this.isMobile = window.innerWidth <= 768;
        
        if (this.panelContainer) {
            this.panelContainer.classList.remove('dm-panel', 'player-panel');
            this.panelContainer.classList.add('unified-panel');
            
            if (this.isMobile) {
                this.isPanelOpen = false;
                this.panelContainer.classList.add('hidden');
                this.panelContainer.classList.remove('mobile-open');
                if (this.panelHeader) {
                    this.panelHeader.style.display = 'none';
                }
                console.log('📱 Mobile: Panel is hidden by default (slide up)');
            } else {
                this.isPanelOpen = true;
                this.panelContainer.classList.remove('hidden');
                if (this.panelOpenBtn) {
                    this.panelOpenBtn.classList.add('visible');
                }
                if (this.panelHeader) {
                    this.panelHeader.style.display = 'flex';
                }
            }
        }
        
        console.log('UIService is initialized:', {
            controlPanel: !!this.controlPanel,
            panelContainer: !!this.panelContainer,
            panelHeader: !!this.panelHeader,
            panelOpenBtn: !!this.panelOpenBtn,
            panelCloseBtn: !!this.panelCloseBtn,
            mobileFilterBtn: !!this.mobileFilterBtn,
            mobileSearchBtn: !!this.mobileSearchBtn,
            mobileResetBtn: !!this.mobileResetBtn,
            isMobile: this.isMobile,
            isPanelOpen: this.isPanelOpen
        });
        
        this.setupEventListeners();
        this.bindControlButtons();
        this.setupSearchResultsPosition();
        this.initializeProfileMenu();
        this.refreshProfileRole();
        
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            
            if (wasMobile !== this.isMobile) {
                if (this.isMobile) {
                    this.isPanelOpen = false;
                    this.panelContainer.classList.add('hidden');
                    this.panelContainer.classList.remove('mobile-open');
                    if (this.panelHeader) {
                        this.panelHeader.style.display = 'none';
                    }
                    if (this.mobileFilterBtn) {
                        this.mobileFilterBtn.classList.remove('active');
                    }
                    if (SearchService) {
                        SearchService.closeMobileSearch();
                    }
                    console.log('📱 Switched to mobile: Panel hidden (slide up)');
                } else {
                    this.isPanelOpen = true;
                    this.panelContainer.classList.remove('hidden');
                    this.panelContainer.classList.remove('mobile-open');
                    if (this.panelHeader) {
                        this.panelHeader.style.display = 'flex';
                    }
                    if (this.panelOpenBtn) {
                        this.panelOpenBtn.classList.add('visible');
                    }
                    if (this.mobileFilterBtn) {
                        this.mobileFilterBtn.classList.remove('active');
                    }
                    if (SearchService) {
                        SearchService.closeMobileSearch();
                    }
                    console.log('💻 Switched to desktop: Panel shown');
                }
            }
        });
        
        return this;
    }

    /* Applies translations to any static index.html markup tagged with
       data-i18n (textContent) / data-i18n-title (title attribute) via the
       shared localization service — the same t() used by the login and
       world-selection pages. */
    applyStaticI18n() {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            el.setAttribute('title', t(el.dataset.i18nTitle));
        });
    }

    /* Wires up the header/mobile profile menu: avatar, username, logout,
       and the open/close toggle. Lives outside the map-specific
       initialize() so the menu already works on login/world-selection/
       world-control, not just once a world has actually loaded — it only
       needs an authenticated user, not a loaded map. Safe to call more
       than once (e.g. from both app boot and, defensively, from
       initialize()); real setup runs only the first time. */
    initializeProfileMenu() {
        if (this._profileMenuInitialized) return;
        this._profileMenuInitialized = true;

        this.desktopProfileBtn = document.getElementById('desktop-profile-btn');
        this.mobileProfileBtn = document.getElementById('mobile-profile-btn');
        this.profilePanel = document.getElementById('profile-panel');
        this.profileUsername = document.getElementById('profile-username');
        this.profileRole = document.getElementById('profile-role');
        this.profileLogoutBtn = document.getElementById('profile-logout-btn');
        this.profileLogoutBtnLabel = document.getElementById('profile-logout-btn-label');
        this.desktopProfileAvatar = document.getElementById('desktop-profile-avatar');
        this.profileAvatar = document.getElementById('profile-avatar');

        this.applyStaticI18n();
        this.refreshProfileUser();
        this.refreshProfileRole();

        if (this.profileLogoutBtn) {
            this.profileLogoutBtn.addEventListener('click', async () => {
                this.profileLogoutBtn.disabled = true;
                if (this.profileLogoutBtnLabel) {
                    this.profileLogoutBtnLabel.textContent = t('header.loggingOut');
                }
                try {
                    await AuthService.logout();
                } catch (e) {
                    console.warn('⚠️ Logout error (proceeding anyway):', e);
                } finally {
                    location.reload();
                }
            });
        }

        if (this.desktopProfileBtn) {
            this.desktopProfileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfilePanel();
            });
        }

        if (this.mobileProfileBtn) {
            this.mobileProfileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfilePanel();
            });
        }

        document.addEventListener('click', (e) => {
            if (this.isProfileOpen && this.profilePanel) {
                const isClickOnPanel = this.profilePanel.contains(e.target);
                const isClickOnBtn = this.desktopProfileBtn?.contains(e.target) || this.mobileProfileBtn?.contains(e.target);
                if (!isClickOnPanel && !isClickOnBtn) {
                    this.closeProfilePanel();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isProfileOpen) {
                this.closeProfilePanel();
            }
        });
    }

    /* Populates username/avatar once AuthService actually has a user —
       call after auth resolves (initializeProfileMenu() may run before
       that, at boot, when there's nothing to show yet). */
    refreshProfileUser() {
        const user = AuthService.getCurrentUser();
        if (!user) return;
        if (this.profileUsername) {
            this.profileUsername.textContent = user.displayName || user.username;
        }
        const name = user.displayName || user.username || '?';
        const initial = name.trim().charAt(0).toUpperCase() || '?';
        if (this.desktopProfileAvatar) {
            this.desktopProfileAvatar.textContent = initial;
        }
        if (this.profileAvatar) {
            this.profileAvatar.textContent = initial;
        }
    }

    /* Role ("Master"/"Player") only makes sense once a specific world is
       active — hidden until then. Call again after entering a world to
       reveal it. */
    refreshProfileRole() {
        if (!this.profileRole) return;
        const role = AuthService.getCurrentWorldRole();
        if (!role) {
            this.profileRole.style.display = 'none';
            return;
        }
        this.profileRole.style.display = '';
        this.profileRole.textContent = AuthService.isDM() ? t('header.roleDm') : t('header.rolePlayer');
    }

    toggleProfilePanel() {
        if (this.isProfileOpen) {
            this.closeProfilePanel();
        } else {
            this.openProfilePanel();
        }
    }

    openProfilePanel() {
        if (this.profilePanel) {
            this.profilePanel.classList.add('open');
            this.isProfileOpen = true;
            if (this.desktopProfileBtn) {
                this.desktopProfileBtn.classList.add('active');
                this.desktopProfileBtn.setAttribute('aria-expanded', 'true');
            }
            if (this.mobileProfileBtn) {
                this.mobileProfileBtn.classList.add('active');
            }
            console.log('👤 Profile panel opened');
        }
    }

    closeProfilePanel() {
        if (this.profilePanel) {
            this.profilePanel.classList.remove('open');
            this.isProfileOpen = false;
            if (this.desktopProfileBtn) {
                this.desktopProfileBtn.classList.remove('active');
                this.desktopProfileBtn.setAttribute('aria-expanded', 'false');
            }
            if (this.mobileProfileBtn) {
                this.mobileProfileBtn.classList.remove('active');
            }
            console.log('👤 Profile panel closed');
        }
    }

    setupSearchResultsPosition() {
        if (this.searchResults) {
            this.searchResults.classList.add('unified-search-results');
        }
    }

    setupEventListeners() {
        if (this.panelCloseBtn) {
            this.panelCloseBtn.addEventListener('click', () => {
                console.log('Panel close button clicked');
                this.hideControlPanel();
            });
        }
        
        if (this.panelOpenBtn) {
            this.panelOpenBtn.addEventListener('click', () => {
                console.log('Panel open button clicked');
                this.showControlPanel();
            });
        }
        
        if (this.mobileFilterBtn) {
            this.mobileFilterBtn.addEventListener('click', () => {
                console.log('Mobile filter button clicked');
                if (SearchService) {
                    SearchService.closeMobileSearch();
                }
                this.toggleMobilePanel();
            });
        }
        
        if (this.mobileSearchBtn) {
            this.mobileSearchBtn.addEventListener('click', () => {
                console.log('Mobile search button clicked');
                this.toggleMobileSearch();
            });
        }

        if (this.mobileResetBtn) {
            this.mobileResetBtn.addEventListener('click', () => {
                console.log('Mobile reset view button clicked');
                if (window.mapService) {
                    window.mapService.resetView();
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            if (this.searchResults && this.searchInput) {
                if (!this.searchResults.contains(e.target) && !this.searchInput.contains(e.target)) {
                    this.searchResults.classList.remove('has-results');
                }
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isMobile) {
                    if (SearchService) {
                        SearchService.closeMobileSearch();
                    }
                    if (this.isPanelOpen) {
                        this.toggleMobilePanel();
                    }
                } else if (!this.isMobile && this.isPanelOpen) {
                    this.hideControlPanel();
                }
            }
        });
    }

    toggleMobileSearch() {
        if (SearchService) {
            SearchService.toggleMobileSearch();
        }
        
        if (this.isPanelOpen) {
            this.toggleMobilePanel();
        }
    }

    toggleMobilePanel() {
        if (this.isPanelOpen) {
            this.panelContainer.classList.add('hidden');
            this.panelContainer.classList.remove('mobile-open');
            this.isPanelOpen = false;
            if (this.mobileFilterBtn) {
                this.mobileFilterBtn.classList.remove('active');
            }
            console.log('📱 Mobile panel closed (slide up)');
        } else {
            this.panelContainer.classList.remove('hidden');
            this.panelContainer.classList.add('mobile-open');
            this.isPanelOpen = true;
            if (this.mobileFilterBtn) {
                this.mobileFilterBtn.classList.add('active');
            }
            
            console.log('📱 Mobile panel opened (slide down)');
        }
    }

    bindControlButtons() {
        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                if (window.mapService) {
                    window.mapService.resetView();
                }
            });
        }

        const showAllBtn = document.getElementById('show-all-layers');
        const hideAllBtn = document.getElementById('hide-all-layers');
        
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                if (window.layerService) {
                    window.layerService.showAllLayers();
                    this.checkAllCheckboxes(true);
                }
            });
        }
        
        if (hideAllBtn) {
            hideAllBtn.addEventListener('click', () => {
                if (window.layerService) {
                    window.layerService.hideAllLayers();
                    this.checkAllCheckboxes(false);
                }
            });
        }
    }

    checkAllCheckboxes(checked) {
        const checkboxes = document.querySelectorAll('.layers-section input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            checkbox.dispatchEvent(new Event('change'));
        });
    }

    hideControlPanel() {
        if (this.panelContainer) {
            if (this.isMobile) {
                this.panelContainer.classList.add('hidden');
                this.panelContainer.classList.remove('mobile-open');
                if (this.mobileFilterBtn) {
                    this.mobileFilterBtn.classList.remove('active');
                }
            } else {
                this.panelContainer.classList.add('hidden');
            }
            this.isPanelOpen = false;
        }
        if (this.panelOpenBtn && !this.isMobile) {
            this.panelOpenBtn.classList.add('visible');
        }
        console.log('Panel is hidden');
    }

    showControlPanel() {
        if (this.panelContainer) {
            if (this.isMobile) {
                this.panelContainer.classList.remove('hidden');
                this.panelContainer.classList.add('mobile-open');
                if (this.mobileFilterBtn) {
                    this.mobileFilterBtn.classList.add('active');
                }
            } else {
                this.panelContainer.classList.remove('hidden');
            }
            this.isPanelOpen = true;
        }
        if (this.panelOpenBtn && !this.isMobile) {
            this.panelOpenBtn.classList.remove('visible');
        }
        
        console.log('Panel is shown');
    }

    toggleControlPanel() {
        if (this.isMobile) {
            this.toggleMobilePanel();
        } else {
            if (this.isPanelOpen) {
                this.hideControlPanel();
            } else {
                this.showControlPanel();
            }
        }
    }

    showLoading() {
        console.log('🔄 Uploading data...');
    }

    hideLoading() {
        console.log('✅ The data is uploaded');
    }
}

export default UIService;
