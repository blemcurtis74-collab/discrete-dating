jest.mock('../backend/models/User');
jest.mock('../backend/models/Match');
jest.mock('../backend/models/Message');
jest.mock('../backend/config/db', () => jest.fn());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const Match = require('../backend/models/Match');
const User = require('../backend/models/User');

const SECRET = 'test-secret';

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const makeToken = (userId) => jwt.sign({ id: userId }, SECRET);

const ALICE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const BOB_ID   = 'bbbbbbbbbbbbbbbbbbbbbbbb';

describe('POST /api/matches/:userId', () => {
  it('creates a pending match when no match exists yet', async () => {
    User.findById.mockResolvedValue({ _id: BOB_ID });
    Match.findOne.mockResolvedValue(null);
    const savedMatch = { _id: 'match-1', status: 'pending', users: [ALICE_ID, BOB_ID] };
    Match.create.mockResolvedValue(savedMatch);

    const res = await request(app)
      .post(`/api/matches/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(201);
    expect(Match.create).toHaveBeenCalledTimes(1);
  });

  it('accepts an existing pending match when the other user responds', async () => {
    User.findById.mockResolvedValue({ _id: ALICE_ID });
    const pendingMatch = {
      _id: 'match-1',
      status: 'pending',
      initiator: ALICE_ID,
      users: [ALICE_ID, BOB_ID],
      save: jest.fn().mockResolvedValue(true),
    };
    Match.findOne.mockResolvedValue(pendingMatch);

    const res = await request(app)
      .post(`/api/matches/${ALICE_ID}`)
      .set('Authorization', `Bearer ${makeToken(BOB_ID)}`);

    expect(res.status).toBe(200);
    expect(pendingMatch.save).toHaveBeenCalledTimes(1);
    expect(pendingMatch.status).toBe('accepted');
  });

  it('returns 409 when match is already accepted', async () => {
    User.findById.mockResolvedValue({ _id: BOB_ID });
    Match.findOne.mockResolvedValue({ status: 'accepted' });

    const res = await request(app)
      .post(`/api/matches/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(409);
  });

  it('returns 400 when matching with yourself', async () => {
    const res = await request(app)
      .post(`/api/matches/${ALICE_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 when target user does not exist', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/matches/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post(`/api/matches/${BOB_ID}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/matches', () => {
  it('returns accepted matches for the current user', async () => {
    const matches = [
      { _id: 'match-1', status: 'accepted', users: [ALICE_ID, BOB_ID] },
    ];
    Match.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(matches),
    });

    const res = await request(app)
      .get('/api/matches')
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/matches');
    expect(res.status).toBe(401);
  });
});
