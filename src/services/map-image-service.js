import { supabase } from '../supabase-client.js';
import MapTileService from './map-tile-service.js';

const BUCKET = 'map-images';

class MapImageService {
    // Загружает исходную картинку карты как раньше (её путь/размеры
    // остаются источником правды и легаси-фолбэком), а затем режет её на
    // пирамиду тайлов и заливает тайлы — см. MapTileService. Тайлы — это
    // то, что реально показывается на карте у DM и наблюдателей: вместо
    // одной большой картинки грузятся только те маленькие кусочки,
    // которые попадают в текущий вьюпорт и уровень зума.
    //
    // onTileProgress(({ uploaded, total, failed })) — необязательный
    // колбэк для прогресс-бара на экране загрузки; вызывается на каждом
    // залитом тайле.
    async uploadMapImage(file, worldId, mapId, onTileProgress) {
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

        // Фиксируем путь и размеры уже здесь, до нарезки на тайлы: если
        // нарезка ниже упадёт (сеть, память браузера и т.п.), карта не
        // останется полностью "голой" — MapService умеет показать её как
        // раньше, одной картинкой (imageOverlay), пока DM не повторит
        // загрузку. tiles_ready сбрасываем в false на случай, если это
        // повторная заливка поверх уже потайленной карты.
        const { data, error } = await supabase
            .from('maps')
            .update({
                image_path: path,
                width: dimensions.width,
                height: dimensions.height,
                tiles_ready: false
            })
            .eq('id', mapId)
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating map record:', error);
            throw error;
        }

        try {
            await MapTileService.generateAndUploadTiles(file, worldId, mapId, dimensions, onTileProgress);
        } catch (tileError) {
            // Не пробрасываем ошибку дальше — карта остаётся рабочей через
            // legacy-режим (одна картинка), просто без ускорения от
            // тайлов. DM увидит это по бейджу на карточке карты и сможет
            // повторить загрузку.
            console.error('❌ Tile generation/upload failed, map will use the full-image fallback:', tileError);
            return data;
        }

        const { data: tiledMap, error: reloadError } = await supabase
            .from('maps')
            .select('*')
            .eq('id', mapId)
            .single();

        if (reloadError) {
            console.error('❌ Error reloading map after tiling:', reloadError);
            return data;
        }

        return tiledMap;
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