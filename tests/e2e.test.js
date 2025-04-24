import request from 'supertest';
import { start, stop } from '../src/server.js';
import * as storage from '../src/storage/memoryStorage.js';

// Test server information
let baseURL;
let server;

// Start server before all tests
beforeAll(async () => {
  try {
    // Use port 0 to get a random available port
    const serverInfo = await start(0);
    baseURL = serverInfo.baseURL;
    server = serverInfo.server;
    console.log(`E2E Test server started at ${baseURL}`);
  } catch (error) {
    console.error('Failed to start server for E2E tests:', error);
    process.exit(1);
  }
});

// Stop server after all tests
afterAll(async () => {
  try {
    await stop();
    console.log('E2E Test server stopped');
  } catch (error) {
    console.error('Failed to stop server after E2E tests:', error);
  }
});

// Clear storage before each test
beforeEach(async () => {
  await storage.clearStorage();
});

// Test constants
const testUser1 = { username: 'alice' };
const testUser2 = { username: 'bob' };

describe('E2E API Tests', () => {
  // Test 1: Create Users
  test('should create users successfully', async () => {
    // Create first user
    const res1 = await request(baseURL)
      .post('/users')
      .send(testUser1)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res1.body).toHaveProperty('username', testUser1.username);

    // Create second user
    const res2 = await request(baseURL)
      .post('/users')
      .send(testUser2)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res2.body).toHaveProperty('username', testUser2.username);
  });

  // Test 2: Prevent Duplicate User Creation
  test('should prevent duplicate user creation', async () => {
    // Create a user
    await request(baseURL).post('/users').send(testUser1).expect(201);

    // Try to create the same user again
    const res = await request(baseURL)
      .post('/users')
      .send(testUser1)
      .expect('Content-Type', /json/)
      .expect(400); // Bad request

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('already taken');
  });

  // Test 3: Create Poll
  test('should create a poll successfully', async () => {
    // Create user first
    await request(baseURL).post('/users').send(testUser1);

    const pollData = {
      question: 'What is your favorite color?',
      options: ['Red', 'Blue', 'Green'],
      creator: testUser1.username,
    };

    const res = await request(baseURL)
      .post('/polls')
      .send(pollData)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('question', pollData.question);
    expect(res.body).toHaveProperty('options', pollData.options);
    expect(res.body).toHaveProperty('creator', testUser1.username);
    expect(res.body).toHaveProperty('votes', {}); // No votes initially
  });

  // Test 4: Get Poll
  test('should get poll by ID', async () => {
    // Create user
    await request(baseURL).post('/users').send(testUser1);

    // Create poll
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Test Poll?',
        options: ['Option A', 'Option B'],
        creator: testUser1.username,
      });

    const pollId = pollRes.body.id;

    // Get poll by ID
    const res = await request(baseURL)
      .get(`/polls/${pollId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('id', pollId);
    expect(res.body).toHaveProperty('question', 'Test Poll?');
    expect(res.body.options).toHaveLength(2);
    expect(res.body.options).toContain('Option A');
    expect(res.body.options).toContain('Option B');
  });

  // Test 5: Complete User Flow - Create User, Create Poll, Vote, View Results
  test('should support full user flow: create poll, vote, view results', async () => {
    // Create two users
    await request(baseURL).post('/users').send(testUser1);
    await request(baseURL).post('/users').send(testUser2);

    // Alice creates a poll
    const pollData = {
      question: 'Which framework is better?',
      options: ['React', 'Vue', 'Angular'],
      creator: testUser1.username,
    };

    const pollRes = await request(baseURL).post('/polls').send(pollData).expect(201);

    const pollId = pollRes.body.id;

    // Bob votes on the poll
    const voteData = {
      username: testUser2.username,
      optionIndex: 0, // Vote for "React"
    };

    const voteRes = await request(baseURL).post(`/polls/${pollId}/vote`).send(voteData).expect(200);

    // Verify vote was recorded
    expect(voteRes.body.votes).toHaveProperty(testUser2.username, 0);

    // Get poll by ID to see results
    const pollAfterVote = await request(baseURL).get(`/polls/${pollId}`).expect(200);

    expect(pollAfterVote.body.votes).toHaveProperty(testUser2.username, 0);

    // Get polls that Bob voted in
    const bobVotesRes = await request(baseURL)
      .get(`/users/${testUser2.username}/votes`)
      .expect(200);

    expect(bobVotesRes.body).toHaveLength(1);
    expect(bobVotesRes.body[0].id).toBe(pollId);
  });

  // Test 6: Poll Ownership - Delete Poll
  test('should enforce poll ownership for deletion', async () => {
    // Create two users
    await request(baseURL).post('/users').send(testUser1);
    await request(baseURL).post('/users').send(testUser2);

    // Alice creates a poll
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Poll to delete?',
        options: ['Keep', 'Delete'],
        creator: testUser1.username,
      })
      .expect(201);

    const pollId = pollRes.body.id;

    // Bob tries to delete Alice's poll (should fail)
    await request(baseURL)
      .delete(`/polls/${pollId}`)
      .send({ username: testUser2.username })
      .expect(403); // Forbidden

    // Poll should still exist
    await request(baseURL).get(`/polls/${pollId}`).expect(200);

    // Alice deletes her own poll (should succeed)
    await request(baseURL)
      .delete(`/polls/${pollId}`)
      .send({ username: testUser1.username })
      .expect(200);

    // Poll should now be gone
    await request(baseURL).get(`/polls/${pollId}`).expect(404); // Not found
  });

  // Test 7: Filter Polls by Creator
  test('should filter polls by creator', async () => {
    // Create users
    await request(baseURL).post('/users').send(testUser1);
    await request(baseURL).post('/users').send(testUser2);

    // Create polls by different users
    await request(baseURL)
      .post('/polls')
      .send({
        question: 'Alice Poll 1?',
        options: ['A', 'B'],
        creator: testUser1.username,
      });

    await request(baseURL)
      .post('/polls')
      .send({
        question: 'Alice Poll 2?',
        options: ['C', 'D'],
        creator: testUser1.username,
      });

    await request(baseURL)
      .post('/polls')
      .send({
        question: 'Bob Poll?',
        options: ['E', 'F'],
        creator: testUser2.username,
      });

    // Get all polls (should be 3)
    const allPollsRes = await request(baseURL).get('/polls').expect(200);

    expect(allPollsRes.body).toHaveLength(3);

    // Get only Alice's polls using filter
    const alicePollsRes = await request(baseURL)
      .get(`/polls?createdBy=${testUser1.username}`)
      .expect(200);

    expect(alicePollsRes.body).toHaveLength(2);
    expect(alicePollsRes.body.every((p) => p.creator === testUser1.username)).toBe(true);

    // Get only Bob's polls using filter
    const bobPollsRes = await request(baseURL)
      .get(`/polls?createdBy=${testUser2.username}`)
      .expect(200);

    expect(bobPollsRes.body).toHaveLength(1);
    expect(bobPollsRes.body[0].creator).toBe(testUser2.username);
  });

  // Test 8: Vote Constraints - No Double Voting
  test('should prevent a user from voting twice on the same poll', async () => {
    // Create users
    await request(baseURL).post('/users').send(testUser1);
    await request(baseURL).post('/users').send(testUser2);

    // Create poll
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Double vote test?',
        options: ['Yes', 'No', 'Maybe'],
        creator: testUser1.username,
      });

    const pollId = pollRes.body.id;

    // Bob votes on the poll (first vote)
    await request(baseURL)
      .post(`/polls/${pollId}/vote`)
      .send({
        username: testUser2.username,
        optionIndex: 1,
      })
      .expect(200);

    // Bob tries to vote again (should fail)
    const secondVoteRes = await request(baseURL)
      .post(`/polls/${pollId}/vote`)
      .send({
        username: testUser2.username,
        optionIndex: 2,
      })
      .expect(400); // Bad request

    expect(secondVoteRes.body).toHaveProperty('error');
    expect(secondVoteRes.body.error).toContain('already voted');

    // Check that original vote wasn't changed
    const pollAfterVotes = await request(baseURL).get(`/polls/${pollId}`).expect(200);

    expect(pollAfterVotes.body.votes).toHaveProperty(testUser2.username, 1);
  });
});
