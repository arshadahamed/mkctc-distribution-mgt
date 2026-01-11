const { expect } = require('chai');
const distributionRepo = require('../repositories/distributionRepo');
const { initTestDb } = require('./test-helper');
const { runQuery } = require('../lib/db');

describe('DistributionRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();

        // Setup initial data
        await runQuery("INSERT INTO trucks (registration_number, driver_name) VALUES ('TRUCK-01', 'John')");
        await runQuery("INSERT INTO products (name, cost, msrp, barcode) VALUES ('Product 1', 100, 150, 'B001')");
    });

    after(() => {
        if (db) db.close();
    });

    describe('createLoad', () => {
        it('should create a truck load with items', async () => {
            const loadData = {
                load_date: '2026-01-10',
                truck_id: 1,
                loaded_by: 1,
                items: [
                    { product_id: 1, quantity_loaded: 100 }
                ]
            };

            const loadId = await distributionRepo.createLoad(loadData);
            expect(loadId).to.be.a('number');

            const load = await distributionRepo.getLoadById(loadId);
            expect(load.registration_number).to.equal('TRUCK-01');
            expect(load.items.length).to.equal(1);
            expect(load.items[0].quantity_loaded).to.equal(100);
        });
    });

    describe('getActiveLoads', () => {
        it('should return only active loads', async () => {
            await distributionRepo.createLoad({ load_date: '2026-01-10', truck_id: 1, loaded_by: 1, items: [] });

            const active = await distributionRepo.getActiveLoads();
            expect(active.length).to.be.greaterThan(0);
            expect(active[0].status).to.equal('loaded');
        });
    });

    describe('createUnload', () => {
        it('should process unloading and calculate variance', async () => {
            // 1. Create Load
            const loadId = await distributionRepo.createLoad({
                load_date: '2026-01-10',
                truck_id: 1,
                loaded_by: 1,
                items: [{ product_id: 1, quantity_loaded: 100 }]
            });

            // 2. Mock a sale (Sold 20)
            await runQuery("INSERT INTO invoices (invoice_number, invoice_date, customer_id, net_total, load_id, created_by) VALUES ('INV-SALE', '2026-01-10', 1, 3000, 1, 1)");
            await runQuery("INSERT INTO invoice_items (invoice_id, product_id, product_name, msrp, quantity, line_total) VALUES (1, 1, 'P1', 150, 20, 3000)");

            // 3. Unload (Returned 75) -> Variance should be (100 - 20 - 75) = 5
            const unloadData = {
                unload_date: '2026-01-10',
                load_id: loadId,
                truck_id: 1,
                items: [
                    { product_id: 1, quantity_remaining: 75, variance_reason: 'Broken bottle' }
                ]
            };

            const unloadId = await distributionRepo.createUnload(unloadData);
            expect(unloadId).to.be.a('number');

            const report = await distributionRepo.getVarianceReport(loadId);
            const item = report.find(r => r.product_name === 'Product 1');
            expect(item.sold).to.equal(20);
            expect(item.returned).to.equal(75);
            expect(item.variance).to.equal(5);
        });
    });
});
