class DMSessionStorage {
    constructor() {
        this.STORAGE_KEY = 'dm_locations_session';
        this.locations = [];
        this.loadFromSession();
    }

    loadFromSession() {
        try {
            const stored = sessionStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.locations = parsed;
                    console.log(`📦 Loaded ${this.locations.length} locations from session`);
                }
            }
        } catch (e) {
            console.warn('⚠️ Error loading locations from session:', e);
            this.locations = [];
        }
    }

    saveToSession() {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.locations));
            console.log(`💾 Saved ${this.locations.length} locations to session`);
        } catch (e) {
            console.warn('⚠️ Error saving locations to session:', e);
        }
    }

    addLocation(location) {
        const exists = this.locations.some(l =>
            l.name === location.name &&
            l.coords[0] === location.coords[0] &&
            l.coords[1] === location.coords[1]
        );

        if (exists) {
            throw new Error(`Location "${location.name}" already exists in session`);
        }

        this.locations.push(location);
        this.saveToSession();
        return location;
    }

    removeLocation(id) {
        const index = this.locations.findIndex(l => l.id === id);
        if (index !== -1) {
            this.locations.splice(index, 1);
            this.saveToSession();
            return true;
        }
        return false;
    }

    getLocations() {
        return [...this.locations];
    }

    getLocation(id) {
        return this.locations.find(l => l.id === id);
    }

    clearAll() {
        this.locations = [];
        this.saveToSession();
        sessionStorage.removeItem(this.STORAGE_KEY);
        console.log('🗑️ All locations deleted from session');
    }

    exportToJSON() {
        if (this.locations.length === 0) {
            throw new Error('No locations to export');
        }

        const exportData = this.locations.map(location => {
            const exported = {
                name: location.name,
                type: location.type,
                coords: location.coords.map(c => Number(c.toFixed(2)))
            };

            if (location.alias && location.alias.trim() !== '') {
                exported.alias = location.alias;
            }

            if (location.region && location.region.trim() !== '') {
                exported.region = location.region;
            }

            if (location.description && location.description.trim() !== '') {
                exported.description = location.description;
            }

            if (location.image && location.image.trim() !== '' && location.image !== 'images/locations/example.jpg') {
                exported.image = location.image;
            }

            if (location.known === true) {
                exported.known = true;
            }

            return exported;
        });

        return JSON.stringify(exportData, null, 2);
    }

    downloadJSON() {
        try {
            const jsonData = this.exportToJSON();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            const filename = `locations_export_${timestamp}.json`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            console.log(`📥 Exported ${this.locations.length} locations to file ${filename}`);
            return true;
        } catch (e) {
            console.error('❌ Export error:', e);
            throw e;
        }
    }

    getCount() {
        return this.locations.length;
    }

    getTotalLocations() {
        return this.getCount();
    }
}

export default new DMSessionStorage();
