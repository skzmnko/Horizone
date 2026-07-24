import { supabase } from '../supabase-client.js';
import TileGenerator from './tile-generator.js';

const BUCKET = 'map-tiles';
const TILE_SIZE = 256;
const UPLOAD_CONCURRENCY = 4;
const DELETE_CHUNK_SIZE = 500;

class MapTileService {
    // Полный цикл: чистит старую пирамиду тайлов этой карты (если была —
    // важно при замене картинки: новая пирамида может быть меньше по
    // числу уровней/тайлов, и без явной чистки старые "хвосты" останутся
    // висеть в Storage мёртвым грузом), режет новую картинку и заливает
    // её тайл за тайлом с ограниченной параллельностью, затем помечает
    // карту как tiles_ready в БД.
    //
    // onProgress(({ uploaded, total, failed })) вызывается после каждого
    // тайла — можно использовать для прогресс-бара на загрузке.
    async generateAndUploadTiles(file, worldId, mapId, { width, height }, onProgress) {
        await this.deleteTiles(worldId, mapId);

        const nativeZoom = TileGenerator.computeNativeZoom(width, height, TILE_SIZE);
        const totalTiles = TileGenerator.countTiles(width, height, TILE_SIZE, nativeZoom);
        const mime = (await TileGenerator.supportsWebp()) ? 'image/webp' : 'image/jpeg';
        const ext = mime === 'image/webp' ? 'webp' : 'jpg';

        const image = await this.loadImage(file);

        let uploaded = 0;
        let failed = 0;
        const reportProgress = () => {
            if (onProgress) onProgress({ uploaded, total: totalTiles, failed });
        };
        reportProgress();

        const iterator = TileGenerator.generateTiles(image, { width, height, tileSize: TILE_SIZE, nativeZoom });

        // N воркеров тянут тайлы из одного и того же асинхронного
        // итератора — генерация и заливка идут внахлёст вместо строгого
        // "нарезали всё → залили всё", а сеть при этом не забивается
        // безлимитным числом параллельных запросов.
        const worker = async () => {
            for (;;) {
                const { value: tile, done } = await iterator.next();
                if (done) return;

                const path = `${worldId}/${mapId}/${tile.z}/${tile.x}_${tile.y}.${ext}`;

                try {
                    const { error } = await supabase.storage
                        .from(BUCKET)
                        .upload(path, tile.blob, { upsert: true, contentType: tile.mime });
                    if (error) throw error;
                } catch (err) {
                    // Один неудачный тайл не должен рушить всю заливку —
                    // в худшем случае карта получит пару "дырок" на
                    // невидимых глазу уровнях зума. Проваливаем итог
                    // наружу через счётчик failed после того, как все
                    // остальные тайлы всё равно попробовали загрузиться.
                    console.error(`❌ Tile upload failed (${path}):`, err);
                    failed++;
                }

                uploaded++;
                reportProgress();
            }
        };

        await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()));

        if (failed > 0) {
            throw new Error(`${failed} из ${totalTiles} тайлов не удалось загрузить`);
        }

        const { error } = await supabase
            .from('maps')
            .update({
                tile_size: TILE_SIZE,
                native_zoom: nativeZoom,
                tile_ext: ext,
                tiles_ready: true
            })
            .eq('id', mapId);

        if (error) {
            console.error('❌ Error marking tiles ready:', error);
            throw error;
        }
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
            // Blob URL намеренно не освобождаем сразу — картинка нужна ещё
            // некоторое время, пока не нарезан весь пирамида уровней;
            // браузер освободит её сам при закрытии/переходе со страницы.
        });
    }

    // Удаляет все тайлы одной карты. list() в Supabase Storage
    // нерекурсивный, поэтому сначала получаем список папок уровней
    // зума, а затем — список файлов внутри каждой из них.
    async deleteTiles(worldId, mapId) {
        await this.deleteTilesUnderPrefix(`${worldId}/${mapId}`);
    }

    // Удаляет тайлы всех карт мира разом — используется при удалении
    // самого мира.
    async deleteAllTilesForWorld(worldId) {
        const { data: mapFolders, error } = await supabase.storage.from(BUCKET).list(worldId);

        if (error) {
            console.warn('⚠️ Could not list world tile folders before delete:', error);
            return;
        }

        if (!mapFolders || mapFolders.length === 0) return;

        for (const folder of mapFolders) {
            await this.deleteTilesUnderPrefix(`${worldId}/${folder.name}`);
        }
    }

    async deleteTilesUnderPrefix(prefix) {
        const { data: zoomFolders, error: listError } = await supabase.storage.from(BUCKET).list(prefix);

        if (listError) {
            console.warn(`⚠️ Could not list tiles under ${prefix} before delete:`, listError);
            return;
        }

        if (!zoomFolders || zoomFolders.length === 0) return;

        const allPaths = [];
        for (const folder of zoomFolders) {
            const { data: files, error } = await supabase.storage.from(BUCKET).list(`${prefix}/${folder.name}`);
            if (error) {
                console.warn(`⚠️ Could not list tiles in ${prefix}/${folder.name}:`, error);
                continue;
            }
            (files || []).forEach(f => allPaths.push(`${prefix}/${folder.name}/${f.name}`));
        }

        if (allPaths.length === 0) return;

        // На очень крупных картах тайлов могут быть тысячи — бьём удаление
        // на чанки, чтобы не упереться в лимиты одного запроса.
        for (let i = 0; i < allPaths.length; i += DELETE_CHUNK_SIZE) {
            const chunk = allPaths.slice(i, i + DELETE_CHUNK_SIZE);
            const { error } = await supabase.storage.from(BUCKET).remove(chunk);
            if (error) console.warn('⚠️ Could not delete some tiles:', error);
        }
    }

    // Шаблон URL для L.tileLayer — с буквальными {z}/{x}/{y}, которые
    // Leaflet сам подставляет. Важно: подставлять их нужно ПОСЛЕ
    // getPublicUrl(), а не передавать плейсхолдеры в сам путь — Supabase
    // URL-кодирует фигурные скобки, и Leaflet перестаёт их распознавать.
    getTileUrlTemplate(worldId, mapId, ext = 'webp') {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${worldId}/${mapId}`);
        return `${data.publicUrl}/{z}/{x}_{y}.${ext}`;
    }
}

export default new MapTileService();
