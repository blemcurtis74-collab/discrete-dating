jest.mock('../models/User');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const app = require('../app');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth – POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: 'user123',
      email: 'alice@example.com',
      displayName: 'Alice',
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'password123',
      displayName: 'Alice',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('rejects duplicate emails with 409', async () => {
    User.findOne.mockResolvedValue({ email: 'bob@example.com' });

    const res = await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'password123',
      displayName: 'Bob',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already in use/i);
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
      displayName: 'Test',
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'short',
      displayName: 'Test',
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 when displayName is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(422);
  });
});

describe('Auth – POST /api/auth/login', () => {
  it('returns a token on valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('securePass1', 12);
    const mockUser = {
      _id: 'user456',
      email: 'carol@example.com',
      displayName: 'Carol',
      password: hashedPassword,
      comparePassword: async (plain) => bcrypt.compare(plain, hashedPassword),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'carol@example.com',
      password: 'securePass1',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong password with 401', async () => {
    const hashedPassword = await bcrypt.hash('correctPass', 12);
    const mockUser = {
      _id: 'user456',
      email: 'carol@example.com',
      password: hashedPassword,
      comparePassword: async (plain) => bcrypt.compare(plain, hashedPassword),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'carol@example.com',
      password: 'wrongPassword',
    });

    expect(res.status).toBe(401);
  });

  it('rejects unknown email with 401', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
  });

  it('returns 422 for missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
    });
    expect(res.status).toBe(422);
  });
});
