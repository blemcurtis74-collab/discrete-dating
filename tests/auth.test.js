jest.mock('../backend/models/User');
jest.mock('../backend/models/Match');
jest.mock('../backend/models/Message');
jest.mock('../backend/config/db', () => jest.fn());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const User = require('../backend/models/User');
const Match = require('../backend/models/Match');

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────
// Helper: build a plain user-like object
// ──────────────────────────────────────────────
const buildUser = (overrides = {}) => ({
  _id: 'user-id-alice',
  username: 'alice',
  email: 'alice@example.com',
  password: 'hashedpwd',
  comparePassword: jest.fn(),
  toJSON: function () {
    const { password: _pw, ...rest } = this;
    return rest;
  },
  ...overrides,
});

// ──────────────────────────────────────────────
// Auth routes
// ──────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('creates a user and returns a token', async () => {
    User.findOne.mockResolvedValue(null);
    const mockUser = buildUser();
    User.create.mockResolvedValue(mockUser);

    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(User.create).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when email/username already in use', async () => {
    User.findOne.mockResolvedValue(buildUser());

    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid inputs', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'ab',
      email: 'not-an-email',
      password: '123',
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token with valid credentials', async () => {
    const mockUser = buildUser();
    mockUser.comparePassword.mockResolvedValue(true);
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 with wrong password', async () => {
    const mockUser = buildUser();
    mockUser.comparePassword.mockResolvedValue(false);
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpwd' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});
