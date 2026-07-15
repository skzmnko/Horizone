import { supabase } from '../supabase-client.js';

const BUCKET = 'world-covers';

class WorldCoverService {
    async uploadCover(file, worldId) {
        const ext = file.name.split('.').pop();
        const path = `${worldId}/cover.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadError) {
            console.error('❌ Cover upload error:', uploadError);
            throw uploadError;
        }

        const { data, error } = await supabase
            .from('worlds')
            .update({ cover_image_path: path })
            .eq('id', worldId)
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating world cover path:', error);
            throw error;
        }

        return data;
    }

    getPublicUrl(path) {
        if (!path) return null;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl;
    }
}

export default new WorldCoverService();
