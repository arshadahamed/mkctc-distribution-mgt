const { expect } = require('chai');
const productRepo = require('../repositories/productRepo');
const { initTestDb } = require('./test-helper');

describe('ProductRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();
        // Seed a default product for tests
        await productRepo.create({
            name: 'Product 1',
            cost: 100,
            msrp: 150,
            barcode: 'P1'
        });
    });

    after(() => {
        if (db) db.close();
    });

    describe('getAll', () => {
        it('should return all products with pagination info', async () => {
            const result = await productRepo.getAll({ page: 1, pageSize: 10 });
            expect(result.data).to.be.an('array');
            expect(result.data.length).to.be.greaterThan(0);
            expect(result.pagination).to.exist;
            expect(result.pagination.totalCount).to.equal(1);
        });
    });

    describe('getById', () => {
        it('should return product by id', async () => {
            const result = await productRepo.getAll({ page: 1, pageSize: 1 });
            const id = result.data[0].id;

            const product = await productRepo.getById(id);
            expect(product).to.exist;
            expect(product.id).to.equal(id);
        });
    });

    describe('update', () => {
        it('should update product details', async () => {
            const products = await productRepo.getAll({ page: 1, pageSize: 1 });
            const product = products.data[0];

            await productRepo.update(product.id, { name: 'Updated Product' });

            const updated = await productRepo.getById(product.id);
            expect(updated.name).to.equal('Updated Product');
        });
    });

    describe('delete', () => {
        it('should delete a product', async () => {
            const products = await productRepo.getAll({ page: 1, pageSize: 10 });
            const count = products.data.length;
            const id = products.data[0].id;

            await productRepo.delete(id);

            const afterDelete = await productRepo.getAll({ page: 1, pageSize: 10 });
            expect(afterDelete.data.length).to.equal(count - 1);
        });
    });
});
