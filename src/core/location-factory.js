import idGenerator from './id-generator.js';

class LocationFactory {
    static createLocation(data) {
        const {
            name,
            type,
            coords,
            region,
            description,
            image,
            alias,
            family,
            ruler,
            owner,
            known = false
        } = data;

        const locationId = idGenerator.generateId();
        
        const imagePath = image || fallbackLocationImage;

        return {
            id: locationId,
            name,
            type,
            coords,
            region,
            description,
            image: imagePath,
            alias: alias || '',
            family: family || '',
            ruler: ruler || '',
            owner: owner || '',
            known: known,
            createdAt: new Date().toISOString()
        };
    }

    static createLocations(locationsData) {
        return locationsData.map(data => this.createLocation(data));
    }
}

export default LocationFactory;