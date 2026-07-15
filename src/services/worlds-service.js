import { supabase } from '../supabase-client.js';

class WorldsService {
    // Список миров, в которых состоит текущий пользователь, с его ролью в каждом
    async getMyWorlds() {
        const { data, error } = await supabase
            .from('world_members')
            .select('role, joined_at, worlds(id, name, created_at)')
            .order('joined_at', { ascending: false });

        if (error) {
            console.error('❌ Error loading worlds:', error);
            throw error;
        }

        return data.map(row => ({
            id: row.worlds.id,
            name: row.worlds.name,
            role: row.role,
            createdAt: row.worlds.created_at
        }));
    }

    // Создать новый мир (вызывающий пользователь автоматически становится DM)
    async createWorld(name) {
        const { data, error } = await supabase.rpc('create_world', { _name: name });

        if (error) {
            console.error('❌ Error creating world:', error);
            throw error;
        }

        console.log(`✅ World created: ${name} (${data})`);
        return data; // id нового мира
    }

    // Присоединиться к существующему миру по коду приглашения
    async joinWorldByInviteCode(code) {
        const { data, error } = await supabase.rpc('redeem_invite', {
            _code: code.trim().toUpperCase()
        });

        if (error) {
            console.error('❌ Error redeeming invite:', error);
            throw error;
        }

        console.log(`✅ Joined world: ${data}`);
        return data; // id мира, к которому присоединились
    }

    // Создать код приглашения для мира (доступно только DM — проверяется RLS-политикой)
    async createInvite(worldId, expiresInHours = null) {
        const code = this.generateCode();
        const expires_at = expiresInHours
            ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
            : null;

        const { data, error } = await supabase
            .from('world_invites')
            .insert({ world_id: worldId, code, expires_at })
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating invite:', error);
            throw error;
        }

        return data;
    }

    generateCode(length = 8) {
        // Без похожих символов (0/O, 1/I) — легче продиктовать игрокам вслух
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async getMapsForWorld(worldId) {
        const { data, error } = await supabase
            .from('maps')
            .select('*')
            .eq('world_id', worldId);

        if (error) {
            console.error('❌ Error loading maps:', error);
            throw error;
        }

        return data;
    }

    async getMap(mapId) {
        const { data, error } = await supabase
            .from('maps')
            .select('*')
            .eq('id', mapId)
            .single();

        if (error) {
            console.error('❌ Error loading map:', error);
            throw error;
        }

        return data;
    }
}

export default new WorldsService();
