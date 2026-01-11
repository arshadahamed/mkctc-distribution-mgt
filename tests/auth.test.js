const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const { initTestDb } = require('./test-helper');

process.env.JWT_SECRET = 'agro-distribution-jwt-secret-2024-secure';

describe('Auth API Integration Tests', () => {
    let db;

    beforeEach(async () => {
        db = await initTestDb();
    });

    after(() => {
        if (db) db.close();
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'admin',
                    password: 'admin'
                });

            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
            expect(res.body.data.user).to.exist;
            expect(res.body.data.token).to.exist;
            // Cookie should be set
            expect(res.headers['set-cookie']).to.exist;
        });

        it('should return 401 with invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'admin',
                    password: 'wrongpassword'
                });

            expect(res.status).to.equal(401);
            expect(res.body.success).to.be.false;
        });

        it('should handle case-insensitive usernames', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'ADMIN',
                    password: 'admin'
                });

            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user when authenticated via token', async () => {
            // First login to get token
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'admin' });

            const token = loginRes.body.data.token;

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
            expect(res.body.user.username).to.equal('admin');
        });

        it('should return 401 when not authenticated', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.status).to.equal(401);
        });
    });
});
