import AuthService from './auth-service.js';

class LocationVisibilityService {
    constructor() {
        this.knownLocations = new Set();
    }

    filterLocationsByRole(locations) {
        if (!AuthService.getIsAuthenticated()) {
            return [];
        }

        if (AuthService.isDM()) {
            return locations;
        } else {
            return locations.filter(location => location.known);
        }
    }

    updateMarkersVisibility(locations, layerService) {
        locations.forEach(location => {
            const layer = layerService.getLayer(location.type);
            if (layer && location.marker) {
                if (this.shouldShowLocation(location)) {
                    layer.addLayer(location.marker);
                } else {
                    layer.removeLayer(location.marker);
                }
            }
        });
    }

    shouldShowLocation(location) {
        if (!AuthService.getIsAuthenticated()) return false;
        if (AuthService.isDM()) return true;
        return location.known;
    }

    addKnownLocation(locationId) {
        this.knownLocations.add(locationId);
    }

    removeKnownLocation(locationId) {
        this.knownLocations.delete(locationId);
    }
}

export default new LocationVisibilityService();