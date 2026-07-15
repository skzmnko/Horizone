import { supabase } from '../supabase-client.js';

class RealtimeService {
    constructor() {
        this.channel = null;
        this.mapId = null;
        this.handlers = {
            onInsert: null,
            onUpdate: null,
            onDelete: null,
            onStatusChange: null
        };
    }

    // Подписка на изменения локаций конкретной карты.
    // handlers.onInsert(location)       — новая локация
    // handlers.onUpdate(newLoc, oldLoc) — изменение существующей
    // handlers.onDelete(oldLoc)         — удаление
    subscribeToMap(mapId, handlers = {}) {
        if (this.channel) {
            this.unsubscribe();
        }

        this.mapId = mapId;
        this.handlers = { ...this.handlers, ...handlers };

        this.channel = supabase
            .channel(`locations-map-${mapId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'locations',
                    filter: `map_id=eq.${mapId}`
                },
                (payload) => this.handleChange(payload)
            )
            .subscribe((status) => {
                console.log(`📡 Realtime status for map ${mapId}:`, status);
                if (this.handlers.onStatusChange) {
                    this.handlers.onStatusChange(status);
                }
            });

        return this.channel;
    }

    handleChange(payload) {
        console.log(`📡 Realtime event [${payload.eventType}]:`, payload);

        switch (payload.eventType) {
            case 'INSERT':
                if (this.handlers.onInsert) {
                    this.handlers.onInsert(this.normalizeLocation(payload.new));
                }
                break;
            case 'UPDATE':
                if (this.handlers.onUpdate) {
                    this.handlers.onUpdate(
                        this.normalizeLocation(payload.new),
                        this.normalizeLocation(payload.old)
                    );
                }
                break;
            case 'DELETE':
                if (this.handlers.onDelete) {
                    this.handlers.onDelete(this.normalizeLocation(payload.old));
                }
                break;
        }
    }

    // Приводим строку из БД (coord_x/coord_y) к формату, который ожидает
    // существующий фронтенд-код (coords: [x, y])
    normalizeLocation(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            alias: row.alias,
            type: row.type,
            region: row.region,
            description: row.description,
            image: row.image_url,
            coords: [Number(row.coord_x), Number(row.coord_y)],
            known: row.known,
            ruler: row.ruler,
            owner: row.owner,
            family: row.family,
            createdAt: row.created_at
        };
    }

    unsubscribe() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
            this.mapId = null;
            console.log('📡 Unsubscribed from realtime channel');
        }
    }
}

export default new RealtimeService();