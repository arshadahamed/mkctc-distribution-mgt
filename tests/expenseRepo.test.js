const { expect } = require('chai');
const expenseRepo = require('../repositories/expenseRepo');
const { initTestDb } = require('./test-helper');
const { runQuery } = require('../lib/db');

describe('ExpenseRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();
    });

    after(() => {
        if (db) db.close();
    });

    describe('create', () => {
        it('should record an expense', async () => {
            const data = {
                date: '2026-01-10',
                category: 'Fuel',
                amount: 5000,
                description: 'Diesel for Truck 01',
                reference_no: 'REF-001',
                created_by: 1
            };

            const id = await expenseRepo.create(data);
            expect(id).to.be.a('number');

            const saved = await expenseRepo.getById(id);
            expect(saved.category).to.equal('Fuel');
            expect(saved.amount).to.equal(5000);
        });
    });

    describe('getTodayTotal', () => {
        it('should calculate today total correctly', async () => {
            await expenseRepo.create({ date: '2026-01-10', category: 'C1', amount: 1000, created_by: 1 });
            await expenseRepo.create({ date: '2026-01-10', category: 'C2', amount: 2000, created_by: 1 });
            await expenseRepo.create({ date: '2026-01-11', category: 'C1', amount: 5000, created_by: 1 });

            const total = await expenseRepo.getTodayTotal('2026-01-10');
            expect(total).to.equal(3000);
        });
    });

    describe('getAll', () => {
        it('should filter expenses by category', async () => {
            await expenseRepo.create({ date: '2026-01-10', category: 'Fuel', amount: 1000, created_by: 1 });
            await expenseRepo.create({ date: '2026-01-10', category: 'Salaries', amount: 2000, created_by: 1 });

            const results = await expenseRepo.getAll({ category: 'Fuel' });
            expect(results.length).to.equal(1);
            expect(results[0].category).to.equal('Fuel');
        });
    });
});
