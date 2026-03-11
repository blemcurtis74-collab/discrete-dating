jest.mock('../backend/models/User');
jest.mock('../backend/models/Match');
jest.mock('../backend/models/Message');
jest.mock('../backend/config/db', () => jest.fn());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const Match = require('../backend/models/Match');
const Message = require('../backend/models/Message');

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
const CAROL_ID = 'cccccccccccccccccccccccc';

// ──────────────────────────────────────────────
// Helper to make Match.findOne resolve as matched
// ──────────────────────────────────────────────
const mockMatched = () => Match.findOne.mockResolvedValue({ status: 'accepted' });
const mockNotMatched = () => Match.findOne.mockResolvedValue(null);

// ──────────────────────────────────────────────
// POST /api/messages/:receiverId
// ──────────────────────────────────────────────
describe('POST /api/messages/:receiverId', () => {
  it('sends a message between matched users', async () => {
    mockMatched();
    const savedMsg = {
      _id: 'msg-1',
      content: 'Hello Bob!',
      sender: { _id: ALICE_ID, username: 'alice', profilePicture: '' },
      receiver: BOB_ID,
      populate: jest.fn().mockResolvedValue({
        _id: 'msg-1',
        content: 'Hello Bob!',
        sender: { _id: ALICE_ID, username: 'alice', profilePicture: '' },
      }),
    };
    Message.create.mockResolvedValue(savedMsg);

    const res = await request(app)
      .post(`/api/messages/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`)
      .send({ content: 'Hello Bob!' });

    expect(res.status).toBe(201);
    expect(Message.create).toHaveBeenCalledTimes(1);
    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Hello Bob!' })
    );
  });

  it('returns 403 when users are not matched', async () => {
    mockNotMatched();

    const res = await request(app)
      .post(`/api/messages/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`)
      .send({ content: 'Hello!' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when message content is empty', async () => {
    const res = await request(app)
      .post(`/api/messages/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`)
      .send({ content: '   ' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when message exceeds 2000 characters', async () => {
    const res = await request(app)
      .post(`/api/messages/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`)
      .send({ content: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when messaging yourself', async () => {
    const res = await request(app)
      .post(`/api/messages/${ALICE_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`)
      .send({ content: 'Hello me!' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post(`/api/messages/${BOB_ID}`)
      .send({ content: 'Hello!' });

    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// GET /api/messages/:otherUserId
// ──────────────────────────────────────────────
describe('GET /api/messages/:otherUserId', () => {
  it('retrieves the conversation between matched users', async () => {
    mockMatched();
    const messages = [
      { _id: 'msg-1', content: 'Hey!', sender: BOB_ID, receiver: ALICE_ID, read: false },
    ];
    Message.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(messages),
        }),
      }),
    });
    Message.updateMany.mockResolvedValue({});

    const res = await request(app)
      .get(`/api/messages/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
  });

  it('returns 403 for non-matched users', async () => {
    mockNotMatched();

    const res = await request(app)
      .get(`/api/messages/${BOB_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/messages/${BOB_ID}`);
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// GET /api/messages
// ──────────────────────────────────────────────
describe('GET /api/messages', () => {
  it('lists conversations for the current user', async () => {
    const conversations = [
      { _id: BOB_ID, lastMessage: { content: 'Hi' }, unreadCount: 1, partnerDetails: { username: 'bob' } },
    ];
    Message.aggregate.mockResolvedValue(conversations);

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// DELETE /api/messages/:messageId
// ──────────────────────────────────────────────
describe('DELETE /api/messages/:messageId', () => {
  const MSG_ID = 'dddddddddddddddddddddddd';

  it('soft-deletes a message for the sender', async () => {
    const mockMessage = {
      _id: MSG_ID,
      sender: ALICE_ID,
      receiver: BOB_ID,
      deletedBy: [],
      push: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
    };
    Message.findById.mockResolvedValue(mockMessage);

    const res = await request(app)
      .delete(`/api/messages/${MSG_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(200);
    expect(mockMessage.save).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when a non-participant tries to delete', async () => {
    const mockMessage = {
      _id: MSG_ID,
      sender: ALICE_ID,
      receiver: BOB_ID,
      deletedBy: [],
    };
    Message.findById.mockResolvedValue(mockMessage);

    const res = await request(app)
      .delete(`/api/messages/${MSG_ID}`)
      .set('Authorization', `Bearer ${makeToken(CAROL_ID)}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when the message does not exist', async () => {
    Message.findById.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/messages/${MSG_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when message is already deleted by the user', async () => {
    const mockMessage = {
      _id: MSG_ID,
      sender: ALICE_ID,
      receiver: BOB_ID,
      deletedBy: [ALICE_ID],
    };
    Message.findById.mockResolvedValue(mockMessage);

    const res = await request(app)
      .delete(`/api/messages/${MSG_ID}`)
      .set('Authorization', `Bearer ${makeToken(ALICE_ID)}`);

    expect(res.status).toBe(409);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/api/messages/${MSG_ID}`);
    expect(res.status).toBe(401);
  });
});
