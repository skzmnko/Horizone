import { supabase } from '../supabase-client.js';

const BUCKET = 'map-images';

class MapImageService {
    async uploadMapImage(file, worldId, mapId) {
        const ext = file.name.split('.').pop();
        const path = `${worldId}/${mapId}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadError) {
            console.error('❌ Upload error:', uploadError);
            throw uploadError;
        }

        const dimensions = await this.getImageDimensions(file);

        const { data, error } = await supabase
            .from('maps')
            .update({
                image_path: path,
                width: dimensions.width,
                height: dimensions.height
            })
            .eq('id', mapId)
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating map record:', error);
            throw error;
        }

        return data;
    }

    getPublicUrl(path) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl;
    }

    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
                URL.revokeObjectURL(url);
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}

export default new MapImageService();