const { expect } = require('chai');
const userRepo = require('../repositories/userRepo');
const { initTestDb } = require('./test-helper');

describe('UserRepository Unit Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();
    });

    after(() => {
        if (db) db.close();
    });

    describe('getByUsername', () => {
        it('should return a user when username exists', async () => {
            const user = await userRepo.getByUsername('admin');
            expect(user).to.exist;
            expect(user.username).to.equal('admin');
            expect(user.role).to.equal('admin');
        });

        it('should return undefined when username does not exist', async () => {
            const user = await userRepo.getByUsername('nonexistent');
            expect(user).to.be.undefined;
        });
    });

    describe('create', () => {
        it('should create a new user with hashed password', async () => {
            const newUser = {
                name: 'Test User',
                username: 'testuser',
                password: 'password123',
                role: 'employee'
            };

            const result = await userRepo.create(newUser);
            expect(result.lastID).to.be.a('number');

            const created = await userRepo.getByUsername('testuser');
            expect(created).to.exist;
            expect(created.name).to.equal('Test User');
            // Password should be hashed (not equal to the original)
            expect(created.password).to.not.equal('password123');
        });
    });

    describe('update', () => {
        it('should update user information', async () => {
            // Create a user first
            await userRepo.create({
                name: 'Original Name',
                username: 'update-target',
                password: 'password123',
                role: 'employee'
            });
            const user = await userRepo.getByUsername('update-target');

            const updates = { name: 'Updated Name' };
            await userRepo.update(user.id, updates);

            const updated = await userRepo.getById(user.id);
            expect(updated.name).to.equal('Updated Name');
        });
    });

    describe('invalidateTokens', () => {
        it('should increment token_version', async () => {
            let user = await userRepo.getByUsername('admin');
            const initialVersion = user.token_version || 0;

            await userRepo.invalidateTokens(user.id);

            user = await userRepo.getById(user.id);
            expect(user.token_version).to.equal(initialVersion + 1);
        });
    });
});
