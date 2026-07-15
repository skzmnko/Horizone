import DataService from './data-service.js';
import MapService from './map-service.js';
import LayerService from './layer-service.js';
import AuthService from './auth-service.js';
import { typeTranslations } from '../core/constants.js';

class SearchService {
    constructor() {
        this.searchInput = null;
        this.searchResults = null;
        this.mobileSearchInput = null;
        this.mobileSearchResults = null;
        this.mobileSearchPanel = null;
        this.mobileSearchBtn = null;
        this.initialize();
    }

    initialize() {
        this.searchInput = document.getElementById('search');
        this.searchResults = document.getElementById('search-results');
        this.mobileSearchInput = document.getElementById('mobile-search');
        this.mobileSearchResults = document.getElementById('mobile-search-results');
        this.mobileSearchPanel = document.getElementById('mobile-search-panel');
        this.mobileSearchBtn = document.getElementById('mobile-search-btn');
        
        if (this.searchInput && this.searchResults) {
            this.setupDesktopSearch();
        }
        
        if (this.mobileSearchInput && this.mobileSearchResults) {
            this.setupMobileSearch();
        }
    }

    setupDesktopSearch() {
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value, this.searchResults, this.searchInput);
        });

        this.searchInput.addEventListener('focus', () => {
            if (this.searchResults.children.length > 0) {
                this.searchResults.classList.add('has-results');
            }
        });

        document.addEventListener('click', (e) => {
            if (this.searchInput && this.searchResults && 
                !this.searchInput.contains(e.target) && !this.searchResults.contains(e.target)) {
                this.clearResults(this.searchResults);
            }
        });
    }

    setupMobileSearch() {
        this.mobileSearchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value, this.mobileSearchResults, this.mobileSearchInput);
        });

        this.mobileSearchInput.addEventListener('focus', () => {
            if (this.mobileSearchResults.children.length > 0) {
                this.mobileSearchResults.classList.add('has-results');
            }
        });

        document.addEventListener('click', (e) => {
            if (this.mobileSearchInput && this.mobileSearchResults && 
                !this.mobileSearchInput.contains(e.target) && !this.mobileSearchResults.contains(e.target)) {
                this.clearResults(this.mobileSearchResults);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileSearch();
            }
        });
    }

    handleSearch(query, resultsContainer, inputElement) {
        const trimmedQuery = query.toLowerCase().trim();
        this.clearResults(resultsContainer);
        if (trimmedQuery.length < 2) return;
        
        let results = DataService.searchLocations(trimmedQuery);
        results = this.filterResultsByRole(results);

        if (results.length === 0) {
            this.showNoResults(resultsContainer);
            return;
        }

        this.displayResults(results, resultsContainer);
        resultsContainer.classList.add('has-results');
    }

    filterResultsByRole(results) {
        if (AuthService.isDM()) {
            return results;
        } else {
            return results.filter(location => location.known === true);
        }
    }

    displayResults(results, resultsContainer) {
        results.forEach(location => {
            const resultElement = this.createResultElement(location);
            resultsContainer.appendChild(resultElement);
        });
    }

    createResultElement(location) {
        const resultElement = document.createElement('div');
        resultElement.className = 'search-result-item';

        const isLayerVisible = this.isLocationLayerVisible(location);
        if (!isLayerVisible) {
            resultElement.classList.add('search-result-hidden');
        }

        if (location.alias) {
            resultElement.innerHTML = `
                <strong>${location.name}</strong>
                <div class="search-result-alias">${location.alias}</div>
            `;
        } else {
            resultElement.innerHTML = `
                <strong>${location.name}</strong>
            `;
        }
        
        resultElement.addEventListener('click', () => {
            this.selectLocation(location);
        });
        
        return resultElement;
    }

    isLocationLayerVisible(location) {
        const layerControls = LayerService.layerControls;
        
        for (const [checkboxId, layerConfig] of Object.entries(layerControls)) {
            const types = Array.isArray(layerConfig) ? layerConfig : [layerConfig];
            
            if (types.includes(location.type)) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    return checkbox.checked;
                }
            }
        }
        
        return true;
    }

    selectLocation(location) {
        const isLayerVisible = this.isLocationLayerVisible(location);

        if (!isLayerVisible) {
            this.showLayerHiddenMessage(location);
            return;
        }

        if (location.marker && location.latLng) {
            MapService.flyTo(location.latLng, 5);
            location.marker.openPopup();
            this.clearSearch();
            this.clearResults(this.searchResults);
            this.clearResults(this.mobileSearchResults);
            this.closeMobileSearch();
        }
    }

    showLayerHiddenMessage(location) {
        const message = document.createElement('div');
        message.className = 'search-hidden-message';
        message.innerHTML = `
            <div class="search-hidden-content">
                <div class="search-hidden-icon">🔒</div>
                <div class="search-hidden-text">
                    <strong>Локация "${location.name}" скрыта фильтром</strong>
                    <p>Включите соответствующий фильтр в панели управления</p>
                </div>
            </div>
        `;

        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
        
        message.addEventListener('click', () => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        });
        
        console.log(`⚠️ Location "${location.name}" is hidden by layer's filter`);
    }

    showNoResults(resultsContainer) {
        const noResults = document.createElement('div');
        noResults.className = 'search-result-item';
        noResults.textContent = 'Ничего не найдено';
        noResults.style.color = '#a3a3a3';
        noResults.style.cursor = 'default';
        resultsContainer.appendChild(noResults);
        resultsContainer.classList.add('has-results');
    }

    clearResults(resultsContainer) {
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('has-results');
        }
    }

    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.mobileSearchInput) {
            this.mobileSearchInput.value = '';
        }
        this.clearResults(this.searchResults);
        this.clearResults(this.mobileSearchResults);
    }

    openMobileSearch() {
        if (this.mobileSearchPanel) {
            this.mobileSearchPanel.classList.add('visible', 'open');
            if (this.mobileSearchBtn) {
                this.mobileSearchBtn.classList.add('active');
            }
            setTimeout(() => {
                if (this.mobileSearchInput) {
                    this.mobileSearchInput.focus();
                }
            }, 300);
        }
    }

    closeMobileSearch() {
        if (this.mobileSearchPanel) {
            this.mobileSearchPanel.classList.remove('open');
            if (this.mobileSearchBtn) {
                this.mobileSearchBtn.classList.remove('active');
            }
            setTimeout(() => {
                this.mobileSearchPanel.classList.remove('visible');
                this.clearResults(this.mobileSearchResults);
                if (this.mobileSearchInput) {
                    this.mobileSearchInput.value = '';
                }
            }, 300);
        }
    }

    toggleMobileSearch() {
        if (this.mobileSearchPanel && this.mobileSearchPanel.classList.contains('open')) {
            this.closeMobileSearch();
        } else {
            this.openMobileSearch();
        }
    }
}

export default new SearchService();
