import { supabase } from '../supabase-client.js';

class DataService {
    constructor() {
        this.allLocations = [];
        this.loaded = false;
        this.locationCounts = {};
        this.currentMapId = null;
    }

    // Загружает локации текущей активной карты.
    //
    // ВРЕМЕННОЕ УПРОЩЕНИЕ: пока не готов WorldsService с осознанным выбором
    // мира/карты, берём первую карту, доступную текущему пользователю —
    // RLS-политики сами вернут только те миры, где он состоит участником,
    // так что подмену чужих данных это не допускает. Когда появится
    // WorldsService, здесь появится параметр mapId вместо автоопределения.
    async loadAllLocations() {
        if (this.loaded) return this.allLocations;

        try {
            const map = await this.resolveCurrentMap();

            if (!map) {
                console.warn('⚠️ No accessible map found for current user. Смотри инструкцию по созданию тестовых данных.');
                this.allLocations = [];
                this.loaded = true;
                return this.allLocations;
            }

            this.currentMapId = map.id;

            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('map_id', map.id);

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

    async resolveCurrentMap() {
        const { data, error } = await supabase
            .from('maps')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('❌ Error resolving current map:', error);
            return null;
        }

        return data;
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