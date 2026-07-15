import { supabase } from '../supabase-client.js';

class DataService {
    constructor() {
        this.allLocations = [];
        this.loaded = false;
        this.locationCounts = {};
        this.currentMapId = null;
    }

    // Загружает локации конкретной карты. mapId теперь приходит явно —
    // из экрана выбора мира (WorldSelectionPage), а не подбирается сам.
    // RLS-политики всё равно перепроверяют доступ на уровне БД, так что
    // даже если mapId подставить чужой, чужие данные не вернутся.
    async loadAllLocations(mapId) {
        if (!mapId) {
            throw new Error('mapId is required to load locations');
        }

        if (this.loaded && this.currentMapId === mapId) {
            return this.allLocations;
        }

        try {
            this.currentMapId = mapId;

            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('map_id', mapId);

            if (error) {
                throw error;
            }

            this.allLocations = data.map(row => this.normalizeLocation(row));
            this.recalculateCounts();
            this.loaded = true;

            console.log(`🎯 A total of ${this.allLocations.length} locations have been uploaded`);
            console.log('📊 Distribution by types:', this.locationCounts);
            return this.allLocations;

        } catch (error) {
            console.error('❌ Data uploading error:', error);
            throw error;
        }
    }

    // Приводим строку из БД (coord_x/coord_y, image_url) к формату,
    // который ожидает существующий фронтенд-код (coords: [x, y], image)
    normalizeLocation(row) {
        return {
            id: row.id,
            name: row.name,
            alias: row.alias,
            type: row.type,
            coords: [Number(row.coord_x), Number(row.coord_y)],
            region: row.region,
            description: row.description,
            image: row.image_url,
            known: row.known,
            ruler: row.ruler,
            owner: row.owner,
            family: row.family,
            createdAt: row.created_at
        };
    }

    recalculateCounts() {
        this.locationCounts = {};
        this.allLocations.forEach(location => {
            this.locationCounts[location.type] = (this.locationCounts[location.type] || 0) + 1;
        });
    }

    getLocationsByType(type) {
        return this.allLocations.filter(location => location.type === type);
    }

    searchLocations(query) {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) return [];

        const results = [];

        this.allLocations.forEach(location => {
            const nameLower = location.name.toLowerCase();
            const aliasLower = (location.alias || '').toLowerCase();

            const nameIndex = nameLower.indexOf(lowerQuery);
            const aliasIndex = aliasLower.indexOf(lowerQuery);

            let matchType = null;
            let matchPosition = Infinity;

            if (nameIndex !== -1) {
                matchType = 'name';
                matchPosition = nameIndex;
            } else if (aliasIndex !== -1) {
                matchType = 'alias';
                matchPosition = aliasIndex;
            }

            if (matchType) {
                results.push({
                    location,
                    matchType,
                    matchPosition,
                    sortKey: `${matchType === 'name' ? '0' : '1'}_${String(matchPosition).padStart(10, '0')}`
                });
            }
        });

        results.sort((a, b) => {
            if (a.matchType !== b.matchType) {
                return a.matchType === 'name' ? -1 : 1;
            }
            return a.matchPosition - b.matchPosition;
        });

        return results.map(item => item.location);
    }

    getLocationById(id) {
        return this.allLocations.find(loc => loc.id === id);
    }

    getLocationCount(type) {
        return this.locationCounts[type] || 0;
    }

    getAllLocationCounts() {
        return { ...this.locationCounts };
    }
}

export default new DataService();
