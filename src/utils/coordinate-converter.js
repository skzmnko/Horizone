import MapService from '../services/map-service.js';

export function percentToLatLng(percentCoords) {
    return MapService.percentToLatLng(percentCoords);
}

export function latLngToPercent(latLng) {
    const point = MapService.map.latLngToContainerPoint(latLng);
    const x_percent = (point.x / MapService.mapWidth) * 100;
    const y_percent = (point.y / MapService.mapHeight) * 100;
    return [x_percent, y_percent];
}