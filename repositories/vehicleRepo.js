const { allQuery, getQuery, runQuery } = require('../lib/db');

class VehicleRepository {
    async getAll() {
        return await allQuery('SELECT * FROM trucks ORDER BY id DESC');
    }

    async getById(id) {
        return await getQuery('SELECT * FROM trucks WHERE id = ?', [id]);
    }

    async create(data) {
        const sql = `
            INSERT INTO trucks (
                registration_number, vehicle_type, model, capacity, current_location,
                driver_name, fuel_type, vehicle_image, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.registration_number, data.vehicle_type, data.model, data.capacity,
            data.current_location, data.driver_name, data.fuel_type,
            data.vehicle_image, data.status || 'active'
        ];
        const result = await runQuery(sql, params);
        return result.lastID;
    }

    async update(id, data) {
        const sql = `
            UPDATE trucks SET 
                registration_number = ?, 
                vehicle_type = ?, 
                model = ?,
                capacity = ?, 
                current_location = ?,
                driver_name = ?, 
                fuel_type = ?, 
                vehicle_image = ?, 
                status = ?
            WHERE id = ?
        `;
        const params = [
            data.registration_number, data.vehicle_type, data.model,
            data.capacity, data.current_location, data.driver_name,
            data.fuel_type, data.vehicle_image, data.status, id
        ];
        return await runQuery(sql, params);
    }

    async delete(id) {
        return await runQuery('DELETE FROM trucks WHERE id = ?', [id]);
    }
}

module.exports = new VehicleRepository();
