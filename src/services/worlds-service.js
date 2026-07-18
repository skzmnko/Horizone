import { supabase } from '../supabase-client.js';

class WorldsService {
    // Список миров, в которых состоит текущий пользователь, с его ролью в каждом
    async getMyWorlds() {
        const { data, error } = await supabase
            .from('world_members')
            .select('role, joined_at, worlds(id, name, created_at, cover_image_path)')
            .order('joined_at', { ascending: false });

        if (error) {
            console.error('❌ Error loading worlds:', error);
            throw error;
        }

        return data.map(row => ({
            id: row.worlds.id,
            name: row.worlds.name,
            role: row.role,
            createdAt: row.worlds.created_at,
            coverImagePath: row.worlds.cover_image_path
        }));
    }

    // Роль текущего пользователя в конкретном мире — используется, чтобы
    // корректно проставить AuthService.setCurrentWorldRole() при открытии карты
    async getMyRoleInWorld(worldId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('world_members')
            .select('role')
            .eq('world_id', worldId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('❌ Error loading role in world:', error);
            throw error;
        }

        return data ? data.role : null;
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

    // Присоединиться к существующему миру по коду приглашения.
    // characterName — необязательное отображаемое имя (имя персонажа)
    // именно в этом мире; можно поменять позже через setMyWorldDisplayName.
    async joinWorldByInviteCode(code, characterName = null) {
        const { data, error } = await supabase.rpc('redeem_invite', {
            _code: code.trim().toUpperCase(),
            _display_name: characterName || null
        });

        if (error) {
            console.error('❌ Error redeeming invite:', error);
            throw error;
        }

        console.log(`✅ Joined world: ${data}`);
        return data; // id мира, к которому присоединились
    }

    // Сменить своё отображаемое имя (имя персонажа) в конкретном мире
    async setMyWorldDisplayName(worldId, name) {
        const { error } = await supabase.rpc('set_my_world_display_name', {
            _world_id: worldId,
            _display_name: name
        });

        if (error) {
            console.error('❌ Error updating display name:', error);
            throw error;
        }
    }

    // Создать код приглашения для мира (доступно только DM — проверяется RLS-политикой).
    // maxUses: null — без ограничения по числу использований, 1 — одноразовая ссылка (для одного игрока).
    async createInvite(worldId, { expiresInHours = null, maxUses = null } = {}) {
        const code = this.generateCode();
        const expires_at = expiresInHours
            ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
            : null;

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('world_invites')
            .insert({ world_id: worldId, code, expires_at, max_uses: maxUses, created_by: user?.id || null })
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating invite:', error);
            throw error;
        }

        return data;
    }

    // Список активных приглашений мира — для панели DM
    async getWorldInvites(worldId) {
        const { data, error } = await supabase.rpc('get_world_invites', { _world_id: worldId });

        if (error) {
            console.error('❌ Error loading invites:', error);
            throw error;
        }

        return data;
    }

    // Отозвать (удалить) код приглашения — доступно только DM (RLS)
    async revokeInvite(inviteId) {
        const { error } = await supabase
            .from('world_invites')
            .delete()
            .eq('id', inviteId);

        if (error) {
            console.error('❌ Error revoking invite:', error);
            throw error;
        }
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

    // Детали одного мира (имя, обложка) — нужно для world-control-page
    async getWorld(worldId) {
        const { data, error } = await supabase
            .from('worlds')
            .select('*')
            .eq('id', worldId)
            .single();

        if (error) {
            console.error('❌ Error loading world:', error);
            throw error;
        }

        return data;
    }

    // Создать новую карту в уже существующем мире (например, когда
    // единственную карту мира удалили, или DM хочет несколько карт)
    async createMap(worldId, name) {
        const { data, error } = await supabase
            .from('maps')
            .insert({ world_id: worldId, name })
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating map:', error);
            throw error;
        }

        console.log(`✅ Map created: ${name} (${data.id})`);
        return data;
    }

    // Удалить мир целиком: сначала подчищаем файлы карт в Storage
    // (участники/карты/локации в БД удалятся сами — на них стоит
    // "on delete cascade"), затем удаляем саму строку мира.
    async deleteWorld(worldId) {
        const { data: files, error: listError } = await supabase.storage
            .from('map-images')
            .list(worldId);

        if (listError) {
            console.warn('⚠️ Could not list world files before delete:', listError);
        } else if (files && files.length > 0) {
            const paths = files.map(f => `${worldId}/${f.name}`);
            await supabase.storage.from('map-images').remove(paths);
        }

        const { data: coverFiles, error: coverListError } = await supabase.storage
            .from('world-covers')
            .list(worldId);

        if (coverListError) {
            console.warn('⚠️ Could not list world cover files before delete:', coverListError);
        } else if (coverFiles && coverFiles.length > 0) {
            const coverPaths = coverFiles.map(f => `${worldId}/${f.name}`);
            await supabase.storage.from('world-covers').remove(coverPaths);
        }

        const { error } = await supabase
            .from('worlds')
            .delete()
            .eq('id', worldId);

        if (error) {
            console.error('❌ Error deleting world:', error);
            throw error;
        }

        console.log(`🗑️ World deleted: ${worldId}`);
    }

    // Удалить одну карту (локации этой карты удалятся каскадно)
    async deleteMap(mapId) {
        const map = await this.getMap(mapId);

        if (map.image_path) {
            await supabase.storage.from('map-images').remove([map.image_path]);
        }

        const { error } = await supabase
            .from('maps')
            .delete()
            .eq('id', mapId);

        if (error) {
            console.error('❌ Error deleting map:', error);
            throw error;
        }

        console.log(`🗑️ Map deleted: ${mapId}`);
    }
}

export default new WorldsService();