// Режет загруженную картинку карты на пирамиду тайлов прямо в браузере
// (canvas), без бэкенда — то есть без своего сервера тут вообще нет,
// только Supabase, так что либо тайлы режет клиент, либо никто.
//
// Схема стандартная для Leaflet + CRS.Simple: на "нативном" уровне
// зума (nativeZoom) один пиксель тайла — один пиксель исходной
// картинки. Каждый следующий уровень вниз — уменьшенная вдвое копия
// предыдущего (mip-цепочка), а не масштабирование заново из
// оригинала: так быстрее и даёт более чистый даунсемплинг без муара
// на уровнях с мелкими деталями.

const DEFAULT_TILE_SIZE = 256;

class TileGenerator {
    constructor() {
        this._webpSupport = undefined;
    }

    // Наименьший зум, при котором вся картинка ещё умещается в один
    // тайл, — это 0. Нативный (самый детальный) зум — тот, при
    // котором длинная сторона картинки укладывается в tileSize * 2^z.
    computeNativeZoom(width, height, tileSize = DEFAULT_TILE_SIZE) {
        const longestSide = Math.max(width, height);
        return Math.max(0, Math.ceil(Math.log2(longestSide / tileSize)));
    }

    // Точный подсчёт количества тайлов по той же схеме уменьшения
    // вдвое, что использует generateTiles() — нужен только для
    // прогресс-бара на загрузке, поэтому должен совпадать с реальным
    // проходом тайл в тайл.
    countTiles(width, height, tileSize, nativeZoom) {
        let total = 0;
        let w = width;
        let h = height;

        for (let z = nativeZoom; z >= 0; z--) {
            total += Math.ceil(w / tileSize) * Math.ceil(h / tileSize);
            w = Math.max(1, Math.ceil(w / 2));
            h = Math.max(1, Math.ceil(h / 2));
        }

        return total;
    }

    // WebP заметно легче JPEG при сравнимом качестве, но canvas.toBlob
    // с ним поддерживается не везде одинаково давно — проверяем один
    // раз и кэшируем результат, с фолбэком на JPEG.
    async supportsWebp() {
        if (this._webpSupport !== undefined) return this._webpSupport;

        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp'));
        this._webpSupport = !!(blob && blob.type === 'image/webp');
        return this._webpSupport;
    }

    // Асинхронный генератор: лениво отдаёт тайлы {z, x, y, blob, mime}
    // по одному, от нативного разрешения к самому мелкому уровню.
    // Ленивость важна — она позволяет вызывающему коду (MapTileService)
    // сразу же заливать каждый тайл в Storage, не держа в памяти всю
    // пирамиду разом.
    async *generateTiles(sourceImage, { width, height, tileSize = DEFAULT_TILE_SIZE, nativeZoom }) {
        const mime = (await this.supportsWebp()) ? 'image/webp' : 'image/jpeg';
        const quality = 0.85;

        let levelCanvas = document.createElement('canvas');
        levelCanvas.width = width;
        levelCanvas.height = height;
        levelCanvas.getContext('2d').drawImage(sourceImage, 0, 0, width, height);

        for (let z = nativeZoom; z >= 0; z--) {
            const levelWidth = levelCanvas.width;
            const levelHeight = levelCanvas.height;
            const cols = Math.ceil(levelWidth / tileSize);
            const rows = Math.ceil(levelHeight / tileSize);

            let tileIndex = 0;

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const tileCanvas = document.createElement('canvas');
                    tileCanvas.width = tileSize;
                    tileCanvas.height = tileSize;

                    // Источник частично или полностью за краем levelCanvas
                    // (последний столбец/ряд) drawImage просто обрежет —
                    // остаток тайла останется прозрачным, это ок.
                    tileCanvas.getContext('2d').drawImage(
                        levelCanvas,
                        x * tileSize, y * tileSize, tileSize, tileSize,
                        0, 0, tileSize, tileSize
                    );

                    const blob = await new Promise(resolve => tileCanvas.toBlob(resolve, mime, quality));
                    yield { z, x, y, blob, mime };

                    // Отдаём управление event loop-у время от времени, чтобы
                    // на больших картах не подвешивать вкладку на долгий
                    // синхронный проход по тысячам тайлов.
                    tileIndex++;
                    if (tileIndex % 8 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }

            if (z === 0) break;

            const nextWidth = Math.max(1, Math.ceil(levelWidth / 2));
            const nextHeight = Math.max(1, Math.ceil(levelHeight / 2));
            const nextCanvas = document.createElement('canvas');
            nextCanvas.width = nextWidth;
            nextCanvas.height = nextHeight;
            nextCanvas.getContext('2d').drawImage(levelCanvas, 0, 0, nextWidth, nextHeight);
            levelCanvas = nextCanvas;
        }
    }
}

export default new TileGenerator();
