const { expect } = require('chai');
const customerRepo = require('../repositories/customerRepo');
const { initTestDb } = require('./test-helper');
const { runQuery } = require('../lib/db');

describe('CustomerRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();
    });

    after(() => {
        if (db) db.close();
    });

    describe('create', () => {
        it('should create a new customer', async () => {
            const customer = {
                name: 'New Customer',
                address: '123 Test St',
                contact: '0712345678',
                category: 'Retailer',
                credit_limit: 50000
            };

            const id = await customerRepo.create(customer);
            expect(id).to.be.a('number');

            const created = await customerRepo.getById(id);
            expect(created.name).to.equal('New Customer');
            expect(created.credit_limit).to.equal(50000);
            expect(created.is_deleted).to.equal(0);
        });
    });

    describe('getAll', () => {
        it('should return paginated customers', async () => {
            await customerRepo.create({ name: 'Cust A', category: 'Cash' });
            await customerRepo.create({ name: 'Cust B', category: 'Retailer' });

            const result = await customerRepo.getAll({ page: 1, limit: 10 });
            expect(result.data).to.be.an('array');
            expect(result.pagination.totalCount).to.equal(2);
        });

        it('should filter by search term', async () => {
            await customerRepo.create({ name: 'UniqueName', category: 'Cash' });
            await customerRepo.create({ name: 'Other', category: 'Cash' });

            const result = await customerRepo.getAll({ search: 'Unique' });
            expect(result.data.length).to.equal(1);
            expect(result.data[0].name).to.equal('UniqueName');
        });
    });

    describe('updateBalance', () => {
        it('should increment customer balance', async () => {
            const id = await customerRepo.create({ name: 'Balance Test', account_balance: 1000 });
            await customerRepo.updateBalance(id, 500);

            const updated = await customerRepo.getById(id);
            expect(updated.account_balance).to.equal(1500);
        });
    });

    describe('delete', () => {
        it('should soft delete a customer', async () => {
            const id = await customerRepo.create({ name: 'Delete Test' });
            await customerRepo.delete(id);

            const fetched = await customerRepo.getById(id);
            expect(fetched).to.be.undefined; // getById filters by is_deleted = 0

            const result = await customerRepo.getAll({ status: 'deleted' });
            expect(result.data.some(c => c.id === id)).to.be.true;
        });
    });
});
