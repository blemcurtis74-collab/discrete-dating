jest.mock('../models/User');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const makeToken = (id = 'user123') =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });

const baseUser = () => ({
  _id: 'user123',
  email: 'dave@example.com',
  displayName: 'Dave',
  bio: '',
  age: null,
  gender: '',
  interests: [],
  location: { city: '', country: '' },
  profileVisible: true,
  subscriptionStatus: 'inactive',
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Profile – GET /api/profile', () => {
  it('returns the authenticated user profile', async () => {
    User.findById.mockResolvedValue(baseUser());

    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('dave@example.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user does not exist', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('Profile – PUT /api/profile', () => {
  it('updates allowed profile fields', async () => {
    const updated = { ...baseUser(), bio: 'Hello world', age: 25, gender: 'male' };
    User.findByIdAndUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ bio: 'Hello world', age: 25, gender: 'male' });

    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe('Hello world');
    expect(res.body.user.age).toBe(25);
  });

  it('rejects age below 18 with 422', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ age: 15 });
    expect(res.status).toBe(422);
  });

  it('rejects bio exceeding 500 characters with 422', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ bio: 'x'.repeat(501) });
    expect(res.status).toBe(422);
  });

  it('rejects invalid gender value with 422', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ gender: 'unknown_value' });
    expect(res.status).toBe(422);
  });

  it('does not allow updating the password field', async () => {
    User.findByIdAndUpdate.mockResolvedValue(baseUser());

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ password: 'hacked123', bio: 'legit update' });

    expect(res.status).toBe(200);
    // Verify password was NOT passed into the $set update
    const updateArg = User.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(updateArg).not.toHaveProperty('password');
  });
});

describe('Profile – PUT /api/profile/password', () => {
  it('changes the password successfully', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);
    const user = {
      ...baseUser(),
      password: hashedPassword,
      comparePassword: async (p) => bcrypt.compare(p, hashedPassword),
      save: jest.fn().mockResolvedValue(true),
    };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const res = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currentPassword: 'password123', newPassword: 'newSecure456' });

    expect(res.status).toBe(200);
    expect(user.save).toHaveBeenCalled();
  });

  it('rejects incorrect current password with 401', async () => {
    const hashedPassword = await bcrypt.hash('correctPassword', 12);
    const user = {
      ...baseUser(),
      password: hashedPassword,
      comparePassword: async (p) => bcrypt.compare(p, hashedPassword),
      save: jest.fn(),
    };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const res = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currentPassword: 'wrongPassword', newPassword: 'newSecure456' });

    expect(res.status).toBe(401);
  });

  it('rejects new password shorter than 8 characters with 422', async () => {
    const res = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currentPassword: 'password123', newPassword: 'short' });
    expect(res.status).toBe(422);
  });
});

describe('Profile – DELETE /api/profile', () => {
  it('deletes the user account and returns 200', async () => {
    User.findByIdAndDelete.mockResolvedValue(baseUser());

    const res = await request(app)
      .delete('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when user does not exist', async () => {
    User.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/profile')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});
