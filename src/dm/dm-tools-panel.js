import DMCoordinatePicker from './dm-coordinate-picker.js';
import DMLocationFactory from './dm-location-factory.js';
import DMSessionStorage from './dm-session-storage.js';

class DMToolsPanel {
    constructor() {
        this.panel = null;
        this.isOpen = false;
        this.selectedCoords = null;
        this.isDMActive = false;
        this.panelContainer = null;

        this.coordInput = null;
        this.pickBtn = null;
        this.addBtn = null;
        this.exportBtn = null;
        this.clearBtn = null;
        this.listContainer = null;
        this.countDisplay = null;

        this.form = null;
        this.mobileBtn = null;
        this.desktopBtn = null;

        this.handleCoordinatePick = this.handleCoordinatePick.bind(this);
        this.togglePicker = this.togglePicker.bind(this);
        this.handleAddLocation = this.handleAddLocation.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleClear = this.handleClear.bind(this);
        this.renderLocationList = this.renderLocationList.bind(this);
        this.toggle = this.toggle.bind(this);
    }

    initialize() {
        this.createPanel();
        this.setupEventListeners();
        this.renderLocationList();
        this.checkMobileButton();
        console.log('🛠️ DM Tools Panel initialized');
    }

    createPanel() {
        this.desktopBtn = document.createElement('button');
        this.desktopBtn.id = 'dm-tools-open-btn';
        this.desktopBtn.className = 'dm-tools-open-btn';
        this.desktopBtn.setAttribute('title', 'DM Tools');
        this.desktopBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
        `;
        document.body.appendChild(this.desktopBtn);

        this.desktopBtn.addEventListener('click', this.toggle);
        this.panelContainer = document.createElement('div');
        this.panelContainer.id = 'dm-tools-panel';
        this.panelContainer.className = 'dm-tools-panel hidden';
        this.panelContainer.innerHTML = `
            <div class="dm-tools-header">
                <h3>🛠️ DM Tools</h3>
                <button class="dm-tools-close-btn" id="dm-tools-close-btn">✕</button>
            </div>

            <div class="dm-tools-content">
                <!-- Coordinates -->
                <div class="dm-tools-section">
                    <h4>📍 Coordinates</h4>
                    <div class="dm-coord-control">
                        <input type="text" id="dm-coord-input" placeholder="[x, y] or select on map" readonly>
                        <button id="dm-pick-btn" class="dm-pick-btn" title="Select a point on the map">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                                <path d="M13 13l6 6"/>
                            </svg>
                            Eyedropper
                        </button>
                        <button id="dm-clear-coords-btn" class="dm-clear-btn" title="Clear coordinates">✕</button>
                    </div>
                </div>

                <!-- Create location form -->
                <div class="dm-tools-section">
                    <h4>📝 Create location</h4>
                    <form id="dm-location-form">
                        <div class="dm-form-group">
                            <label for="dm-location-name">Name *</label>
                            <input type="text" id="dm-location-name" placeholder="Location name" required>
                        </div>

                        <div class="dm-form-group">
                            <label for="dm-location-alias">Alias (optional)</label>
                            <input type="text" id="dm-location-alias" placeholder="Alias · Additional name">
                        </div>

                        <div class="dm-form-row">
                            <div class="dm-form-group">
                                <label for="dm-location-type">Type *</label>
                                <select id="dm-location-type" required>
                                    <option value="">Select type</option>
                                </select>
                            </div>
                            <div class="dm-form-group">
                                <label for="dm-location-region">Region</label>
                                <select id="dm-location-region">
                                    <option value="">No region</option>
                                </select>
                            </div>
                        </div>

                        <div class="dm-form-group">
                            <label for="dm-location-description">Description</label>
                            <textarea id="dm-location-description" rows="3" placeholder="Location description..."></textarea>
                        </div>

                        <div class="dm-form-group">
                            <label for="dm-location-image">Image path</label>
                            <input type="text" id="dm-location-image" placeholder="images/locations/example.jpg">
                        </div>

                        <div class="dm-form-check">
                            <input type="checkbox" id="dm-location-known">
                            <label for="dm-location-known">👁️ Known to players</label>
                        </div>

                        <button type="submit" class="dm-add-btn">➕ Add location</button>
                    </form>
                </div>

                <!-- Location list -->
                <div class="dm-tools-section dm-list-section">
                    <div class="dm-list-header">
                        <h4>📋 Locations in session</h4>
                        <span class="dm-list-count" id="dm-list-count">0</span>
                    </div>
                    <div class="dm-location-list" id="dm-location-list">
                        <div class="dm-empty-list">No locations. Add the first one!</div>
                    </div>
                    <div class="dm-list-actions">
                        <button id="dm-export-btn" class="dm-export-btn" disabled>📥 Export JSON</button>
                        <button id="dm-clear-btn" class="dm-clear-all-btn" disabled>🗑️ Clear all</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.panelContainer);
    }

    checkMobileButton() {
        this.mobileBtn = document.getElementById('mobile-dm-tools-btn');
        if (this.mobileBtn) {
            console.log('📱 Mobile DM Tools button found (disabled)');
        } else {
            console.warn('⚠️ Mobile DM Tools button not found in DOM');
        }
    }

    setupEventListeners() {
        const closeBtn = document.getElementById('dm-tools-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        this.coordInput = document.getElementById('dm-coord-input');
        this.pickBtn = document.getElementById('dm-pick-btn');

        const clearCoordsBtn = document.getElementById('dm-clear-coords-btn');
        if (clearCoordsBtn) {
            clearCoordsBtn.addEventListener('click', () => {
                this.clearCoords();
            });
        }

        if (this.pickBtn) {
            this.pickBtn.addEventListener('click', this.togglePicker);
        }

        this.form = document.getElementById('dm-location-form');
        if (this.form) {
            this.form.addEventListener('submit', this.handleAddLocation);
        }

        this.populateSelects();
        this.exportBtn = document.getElementById('dm-export-btn');
        this.clearBtn = document.getElementById('dm-clear-btn');

        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', this.handleExport);
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', this.handleClear);
        }

        this.listContainer = document.getElementById('dm-location-list');
        this.countDisplay = document.getElementById('dm-list-count');

        this.renderLocationList();
    }

    populateSelects() {
        const typeSelect = document.getElementById('dm-location-type');
        const regionSelect = document.getElementById('dm-location-region');

        if (typeSelect) {
            const types = DMLocationFactory.getTypes();
            types.forEach(t => {
                const option = document.createElement('option');
                option.value = t.value;
                option.textContent = t.label;
                typeSelect.appendChild(option);
            });
        }

        if (regionSelect) {
            const regions = DMLocationFactory.getRegions();
            regions.forEach(r => {
                const option = document.createElement('option');
                option.value = r.value;
                option.textContent = r.label;
                regionSelect.appendChild(option);
            });
        }
    }

    togglePicker() {
        if (DMCoordinatePicker.isActiveState) {
            DMCoordinatePicker.deactivate();
            this.pickBtn.classList.remove('active');
            this.pickBtn.textContent = '🎯 Eyedropper';
        } else {
            DMCoordinatePicker.activate(this.handleCoordinatePick);
            this.pickBtn.classList.add('active');
            this.pickBtn.textContent = '⏹️ Cancel';
        }
    }

    handleCoordinatePick(data) {
        this.selectedCoords = data.coords;
        if (this.coordInput) {
            this.coordInput.value = `[${data.coords[0].toFixed(2)}, ${data.coords[1].toFixed(2)}]`;
        }

        this.showNotification(`✅ Coordinates selected: [${data.coords[0].toFixed(2)}, ${data.coords[1].toFixed(2)}]`, 'success');

        if (DMCoordinatePicker.isActiveState) {
            DMCoordinatePicker.deactivate();
            if (this.pickBtn) {
                this.pickBtn.classList.remove('active');
                this.pickBtn.textContent = '🎯 Eyedropper';
            }
        }
    }

    clearCoords() {
        this.selectedCoords = null;
        if (this.coordInput) {
            this.coordInput.value = '';
        }
        if (DMCoordinatePicker.isActiveState) {
            DMCoordinatePicker.deactivate();
            if (this.pickBtn) {
                this.pickBtn.classList.remove('active');
                this.pickBtn.textContent = '🎯 Eyedropper';
            }
        }
    }

    handleAddLocation(e) {
        e.preventDefault();

        const nameInput = document.getElementById('dm-location-name');
        const aliasInput = document.getElementById('dm-location-alias');
        const typeSelect = document.getElementById('dm-location-type');
        const regionSelect = document.getElementById('dm-location-region');
        const descriptionTextarea = document.getElementById('dm-location-description');
        const imageInput = document.getElementById('dm-location-image');
        const knownCheckbox = document.getElementById('dm-location-known');

        if (!nameInput || !typeSelect) {
            this.showNotification('❌ Error: form fields not found', 'error');
            return;
        }

        const locationData = {
            name: nameInput.value.trim(),
            alias: aliasInput ? aliasInput.value.trim() : '',
            type: typeSelect.value,
            region: regionSelect ? regionSelect.value.trim() : '',
            description: descriptionTextarea ? descriptionTextarea.value.trim() : '',
            image: imageInput ? imageInput.value.trim() : '',
            known: knownCheckbox ? knownCheckbox.checked : false,
            coords: this.selectedCoords
        };

        console.log('📝 Gathering form data:', locationData);

        if (!locationData.coords) {
            const coordsValue = this.coordInput?.value;
            if (coordsValue && coordsValue.startsWith('[')) {
                try {
                    const parsed = JSON.parse(coordsValue);
                    if (Array.isArray(parsed) && parsed.length === 2 &&
                        typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
                        locationData.coords = parsed;
                    }
                } catch (err) {
                }
            }
        }

        try {
            const location = DMLocationFactory.createLocationFromObject(locationData);
            DMSessionStorage.addLocation(location);

            this.form.reset();
            this.clearCoords();

            this.renderLocationList();
            this.showNotification(`✅ Location "${location.name}" added!`, 'success');
        } catch (error) {
            this.showNotification(`❌ Error: ${error.message}`, 'error');
            console.error('Error creating location:', error);
        }
    }

    handleExport() {
        try {
            DMSessionStorage.downloadJSON();
            this.showNotification(`✅ Exported ${DMSessionStorage.getCount()} locations`, 'success');
        } catch (error) {
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }

    handleClear() {
        if (DMSessionStorage.getCount() === 0) return;

        if (confirm('Are you sure you want to delete all locations from the session?')) {
            DMSessionStorage.clearAll();
            this.renderLocationList();
            this.showNotification('🗑️ All locations deleted', 'info');
        }
    }

    renderLocationList() {
        const locations = DMSessionStorage.getLocations();
        const count = locations.length;

        if (this.countDisplay) {
            this.countDisplay.textContent = count;
        }

        if (this.exportBtn) {
            this.exportBtn.disabled = count === 0;
        }
        if (this.clearBtn) {
            this.clearBtn.disabled = count === 0;
        }

        if (!this.listContainer) return;

        if (count === 0) {
            this.listContainer.innerHTML = `<div class="dm-empty-list">No locations. Add the first one!</div>`;
            return;
        }

        this.listContainer.innerHTML = locations.map(loc => `
            <div class="dm-list-item" data-id="${loc.id}">
                <div class="dm-list-item-info">
                    <div class="dm-list-item-name">${this.escapeHtml(loc.name)}</div>
                    <div class="dm-list-item-meta">
                        <span class="dm-list-item-type">${loc.type}</span>
                        ${loc.region ? `<span class="dm-list-item-region">${loc.region}</span>` : ''}
                        <span class="dm-list-item-coords">[${loc.coords[0].toFixed(2)}, ${loc.coords[1].toFixed(2)}]</span>
                    </div>
                </div>
                <button class="dm-list-item-remove" data-id="${loc.id}" title="Delete">✕</button>
            </div>
        `).join('');

        this.listContainer.querySelectorAll('.dm-list-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (confirm('Delete this location from the session?')) {
                    DMSessionStorage.removeLocation(id);
                    this.renderLocationList();
                    this.showNotification('🗑️ Location deleted', 'info');
                }
            });
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.dm-notification');
        if (existing) {
            existing.remove();
        }

        const notif = document.createElement('div');
        notif.className = `dm-notification dm-notification-${type}`;
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('dm-notification-hide');
            setTimeout(() => {
                if (notif.parentNode) {
                    notif.parentNode.removeChild(notif);
                }
            }, 300);
        }, 3000);
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        if (this.panelContainer) {
            this.panelContainer.classList.remove('hidden');
            this.panelContainer.classList.add('visible');
        }
        this.updateButtonStates(true);
        this.renderLocationList();
        console.log('🛠️ DM Tools panel opened');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;

        if (DMCoordinatePicker.isActiveState) {
            DMCoordinatePicker.deactivate();
            if (this.pickBtn) {
                this.pickBtn.classList.remove('active');
                this.pickBtn.textContent = '🎯 Eyedropper';
            }
        }

        if (this.panelContainer) {
            this.panelContainer.classList.add('hidden');
            this.panelContainer.classList.remove('visible');
        }
        this.updateButtonStates(false);
        console.log('🛠️ DM Tools panel closed');
    }

    updateButtonStates(isOpen) {
        if (this.desktopBtn) {
            if (isOpen) {
                this.desktopBtn.classList.add('active');
            } else {
                this.desktopBtn.classList.remove('active');
            }
        }

    }
}

export default new DMToolsPanel();
