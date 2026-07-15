class LocationIdGenerator {
    constructor() {
        this.nextId = 1;
        this.usedIds = new Set();
    }

    generateId() {
        while (this.usedIds.has(this.nextId)) {
            this.nextId++;
        }
        
        const newId = this.nextId;
        this.usedIds.add(newId);
        this.nextId++;
        
        return newId;
    }

    registerId(id) {
        if (this.usedIds.has(id)) {
            console.warn(`ID ${id} has already been registered!`);
            return false;
        }
        
        this.usedIds.add(id);
        if (id >= this.nextId) {
            this.nextId = id + 1;
        }
        return true;
    }

    getStats() {
        return {
            nextId: this.nextId,
            totalUsed: this.usedIds.size
        };
    }
}

const idGenerator = new LocationIdGenerator();

export default idGenerator;