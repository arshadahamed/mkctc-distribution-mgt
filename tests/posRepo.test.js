const { expect } = require('chai');
const posRepo = require('../repositories/posRepo');
const { initTestDb, TEST_DB_PATH } = require('./test-helper');
const { runQuery } = require('../lib/db');

describe('POSRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();

        // Setup complex data for POS testing
        await runQuery("INSERT INTO trucks (registration_number, driver_name) VALUES ('TEST-01', 'Driver 1')");
        await runQuery("INSERT INTO products (name, cost, msrp, barcode, reference_code) VALUES ('P1', 100, 150, 'B1', 'R1')");
        await runQuery("INSERT INTO truck_loads (load_date, truck_id, loaded_by, status) VALUES ('2026-01-10', 1, 1, 'loaded')");
        await runQuery("INSERT INTO load_items (load_id, product_id, quantity_loaded) VALUES (1, 1, 100)");
    });

    after(() => {
        if (db) db.close();
    });

    describe('getTruckStock', () => {
        it('should return available stock (loaded - sold)', async () => {
            // No sales yet
            let stock = await posRepo.getTruckStock(1);
            expect(stock[0].available_quantity).to.equal(100);

            // Simulate a sale
            await runQuery("INSERT INTO invoices (invoice_number, invoice_date, customer_id, net_total, load_id, status, created_by) VALUES ('INV-01', '2026-01-10', 1, 1500, 1, 'completed', 1)");
            await runQuery("INSERT INTO invoice_items (invoice_id, product_id, product_name, msrp, quantity, line_total) VALUES (1, 1, 'P1', 150, 10, 1500)");

            stock = await posRepo.getTruckStock(1);
            expect(stock[0].available_quantity).to.equal(90);
        });
    });

    describe('getActiveLoads', () => {
        it('should return loads with status loaded', async () => {
            const loads = await posRepo.getActiveLoads();
            expect(loads).to.be.an('array');
            expect(loads.length).to.be.greaterThan(0);
            expect(loads[0].status).to.equal('loaded');
            expect(loads[0].vehicle_number).to.equal('TEST-01');
        });
    });
});
