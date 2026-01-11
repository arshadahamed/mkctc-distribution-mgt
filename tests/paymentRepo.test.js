const { expect } = require('chai');
const paymentRepo = require('../repositories/paymentRepo');
const { initTestDb } = require('./test-helper');
const { runQuery } = require('../lib/db');

describe('PaymentRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();

        // Setup initial data
        await runQuery("INSERT INTO customers (name, account_balance) VALUES ('Coll Cust', 10000)");
    });

    after(() => {
        if (db) db.close();
    });

    describe('createReceipt', () => {
        it('should create a receipt and update customer balance', async () => {
            const receiptData = {
                receipt_date: '2026-01-10',
                customer_id: 1,
                amount: 3000,
                payment_type: 'cash',
                receiver_name: 'Staff A',
                collected_by: 1
            };

            const id = await paymentRepo.createReceipt(receiptData);
            expect(id).to.be.a('number');

            const saved = await paymentRepo.getById(id);
            expect(saved.amount).to.equal(3000);

            // Check balance (10000 - 3000 = 7000)
            const { getById } = require('../repositories/customerRepo');
            const customer = await getById(1);
            expect(customer.account_balance).to.equal(7000);
        });

        it('should handle collection vs return categories correctly', async () => {
            await paymentRepo.createReceipt({
                receipt_date: '2026-01-10',
                customer_id: 1,
                amount: 1000,
                payment_type: 'cash',
                receiver_name: 'A',
                collected_by: 1,
                receipt_category: 'return'
            });

            // 7000 + 1000 (after first test's 3000 deduction if they were shared, but beforeEach resets)
            // Fresh start: 10000 + 1000 = 11000
            const { getById } = require('../repositories/customerRepo');
            const customer = await getById(1);
            expect(customer.account_balance).to.equal(11000);
        });
    });

    describe('getOutstandingInvoices', () => {
        it('should return invoices with pending amounts', async () => {
            // Create an account invoice for 5000
            await runQuery("INSERT INTO invoices (invoice_number, invoice_date, customer_id, net_total, payment_method, created_by) VALUES ('INV-01', '2026-01-01', 1, 5000, 'account', 1)");

            // Partially pay 2000
            const receiptId = await paymentRepo.createReceipt({
                receipt_date: '2026-01-02',
                customer_id: 1,
                amount: 2000,
                payment_type: 'cash',
                receiver_name: 'A',
                collected_by: 1,
                allocations: [{ invoice_id: 1, amount: 2000 }]
            });

            const outstanding = await paymentRepo.getOutstandingInvoices(1);
            expect(outstanding.length).to.equal(1);
            expect(outstanding[0].pending_amount).to.equal(3000);
        });
    });
});
