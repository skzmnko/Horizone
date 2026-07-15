import idGenerator from '../core/id-generator.js';

class DMLocationFactory {
    constructor() {
        this.availableTypes = [
            { value: 'cities', label: 'Cities' },
            { value: 'feyspires', label: 'Feyspires' },
            { value: 'settlements', label: 'Settlements' },
            { value: 'forts', label: 'Forts' },
            { value: 'ruins', label: 'Ruins' },
            { value: 'dungeons', label: 'Dungeons' },
            { value: 'caves', label: 'Caves' },
            { value: 'shrines', label: 'Shrines' },
            { value: 'poi', label: 'Points of Interest' },
            { value: 'secrets', label: 'Secrets' },
            { value: 'inns', label: 'Inns' }
        ];

        this.availableRegions = [
            { value: 'ambria', label: 'Ambria' },
            { value: 'arnuir', label: 'Arnuir' },
            { value: 'aros', label: 'Aros' },
            { value: 'austrea', label: 'Austrea' },
            { value: 'bescay', label: 'Bescay' },
            { value: 'dalianleague', label: 'Dalian League' },
            { value: 'eldinholds', label: 'Eldin Holds' },
            { value: 'elreddh', label: 'Elreddh' },
            { value: 'ellyria', label: 'Ellyria' },
            { value: 'gaincarn', label: 'Gaincarn' },
            { value: 'ironkingdom', label: 'Iron Kingdom' },
            { value: 'islands', label: 'Islands' },
            { value: 'legacy', label: 'Legacy' },
            { value: 'legions', label: 'Legions' },
            { value: 'morvein', label: 'Morvein' },
            { value: 'olessia', label: 'Olessia' },
            { value: 'picarno', label: 'Picarno' },
            { value: 'shadowmarches', label: 'Shadow Marches' },
            { value: 'stornveil', label: 'Stornveil' },
            { value: 'talgar', label: 'Talgar' }
        ];
    }

    createLocationFromObject(data) {
        const {
            name,
            alias = '',
            type,
            region = '',
            description = '',
            image = '',
            known = false,
            coords
        } = data;

        console.log('📝 Creating location from object:', data);

        if (!name || name.trim() === '') {
            throw new Error('Location name is required');
        }

        if (!type) {
            throw new Error('Location type is required');
        }

        if (!coords || !Array.isArray(coords) || coords.length !== 2) {
            throw new Error('Coordinates not selected. Use the eyedropper to pick a point on the map');
        }

        if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
            throw new Error('Coordinates must be numbers');
        }

        const locationId = idGenerator.generateId();
        const roundedCoords = coords.map(c => Number(c.toFixed(2)));
        const imagePath = image.trim() || 'images/locations/example.jpg';

        return {
            id: locationId,
            name: name.trim(),
            alias: alias.trim(),
            type: type,
            coords: roundedCoords,
            region: region.trim(),
            description: description.trim(),
            image: imagePath,
            known: known,
            createdAt: new Date().toISOString()
        };
    }

    createLocationFromForm(formData) {
        const name = formData.get('dm-location-name')?.trim();
        const alias = formData.get('dm-location-alias')?.trim() || '';
        const type = formData.get('dm-location-type');
        const region = formData.get('dm-location-region')?.trim() || '';
        const description = formData.get('dm-location-description')?.trim() || '';
        const image = formData.get('dm-location-image')?.trim() || '';
        const known = formData.get('dm-location-known') === 'on';
        const coordsStr = formData.get('dm-location-coords')?.trim() || '';

        let coords = null;
        if (coordsStr) {
            try {
                const parsed = JSON.parse(coordsStr);
                if (Array.isArray(parsed) && parsed.length === 2 &&
                    typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
                    coords = parsed;
                }
            } catch (e) {
                throw new Error('Invalid coordinate format. Use [x, y]');
            }
        }

        return this.createLocationFromObject({
            name,
            alias,
            type,
            region,
            description,
            image,
            known,
            coords
        });
    }

    getTypes() {
        return this.availableTypes;
    }

    getRegions() {
        return this.availableRegions;
    }

    validateLocation(location) {
        const errors = [];
        if (!location.name) errors.push('Name is required');
        if (!location.type) errors.push('Type is required');
        if (!location.coords || !Array.isArray(location.coords) || location.coords.length !== 2) {
            errors.push('Coordinates must be an array [x, y]');
        }
        if (location.coords && (isNaN(location.coords[0]) || isNaN(location.coords[1]))) {
            errors.push('Coordinates must be numbers');
        }
        return errors;
    }
}

export default new DMLocationFactory();
