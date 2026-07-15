// Старые сервисы (map-service.js, layer-service.js, marker-service.js,
// dm-coordinate-picker.js) написаны в расчёте на то, что Leaflet доступен
// как глобальная переменная L — раньше это обеспечивал <script> тег с CDN
// в index.html. Теперь Leaflet — обычный npm-пакет, поэтому мы один раз
// создаём тот же глобальный L сами, не трогая остальной код сервисов.
//
// ВАЖНО: этот файл должен быть самым первым импортом в main.js — иначе
// сервисы, использующие L в конструкторе (например LayerService), могут
// выполниться раньше, чем L появится.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

window.L = L;

export default L;