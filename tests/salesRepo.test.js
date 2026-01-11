const { expect } = require('chai');
const salesRepo = require('../repositories/salesRepo');
const { initTestDb } = require('./test-helper');
const { runQuery } = require('../lib/db');

describe('SalesRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();

        // Setup initial data
        await runQuery("INSERT INTO customers (name, address, category) VALUES ('Test Customer', 'Addr', 'Cash')");
        await runQuery("INSERT INTO products (name, cost, msrp, barcode) VALUES ('P1', 100, 150, 'B1')");
        await runQuery("INSERT INTO trucks (registration_number) VALUES ('TRUCK-1')");
        await runQuery("INSERT INTO truck_loads (load_date, truck_id, loaded_by) VALUES ('2026-01-10', 1, 1)");
        await runQuery("INSERT INTO load_items (load_id, product_id, quantity_loaded) VALUES (1, 1, 100)");
    });

    after(() => {
        if (db) db.close();
    });

    describe('createInvoice', () => {
        it('should create an invoice and its items correctly', async () => {
            const invoiceData = {
                invoice_number: 'INV-TEST-01',
                invoice_date: '2026-01-10',
                customer_id: 1,
                load_id: 1,
                net_total: 1500,
                payment_method: 'cash',
                created_by: 1,
                items: [
                    {
                        product_id: 1,
                        product_name: 'P1',
                        msrp: 150,
                        quantity: 10,
                        line_total: 1500,
                        discount_percentage: 0,
                        discount_amount: 0,
                        is_free: 0
                    }
                ]
            };

            const invoiceId = await salesRepo.createInvoice(invoiceData);
            expect(invoiceId).to.be.a('number');

            const saved = await salesRepo.getById(invoiceId);
            expect(saved).to.exist;
            expect(saved.invoice_number).to.match(/INV\d{4}\d{4}/); // Generated sequence
            expect(saved.items.length).to.equal(1);
            expect(saved.items[0].product_name).to.equal('P1');
        });
    });

    describe('getSalesSummary', () => {
        it('should return correct summary', async () => {
            await salesRepo.createInvoice({
                invoice_date: '2026-01-10',
                customer_id: 1,
                net_total: 1000,
                payment_method: 'cash',
                created_by: 1,
                items: []
            });

            const summary = await salesRepo.getSalesSummary();
            expect(summary.invoice_count).to.be.at.least(1);
            expect(summary.total_sales).to.equal(1000);
        });
    });
});
