import request from 'supertest'; // HTTP assertion library
import { start, stop } from '../src/server.js'; // Server control functions
import { clearStorage } from '../src/storage/memoryStorage.js'; // To reset state between tests

let server;
let baseURL;

beforeAll(async () => {
  await clearStorage(); // Clear storage before starting the server
});

// Start the server before all tests in this file
beforeAll(async () => {
  try {
    const { server: runningServer, baseURL: url } = await start(0); // Use port 0 for random available port
    server = runningServer;
    baseURL = url;
  } catch (error) {
    console.error('Failed to start server for E2E tests:', error);
    process.exit(1); // Exit if server fails to start
  }
});

// Stop the server after all tests in this file are done
afterAll(async () => {
  try {
    await stop();
  } catch (error) {
    console.error('Failed to stop server after E2E tests:', error);
  }
});

// Clear storage before each test to ensure isolation
beforeEach(async () => {
  await clearStorage();
});

describe('PollSystem+ E2E Tests', () => {
  const userAlice = { username: 'alice' };
  const userBob = { username: 'bob' };
  let pollByAlice; // To store poll created by Alice

  // Test 1: Create User Alice - Success
  test('should create user "alice" successfully', async () => {
    const res = await request(baseURL)
      .post('/users')
      .send(userAlice)
      .expect('Content-Type', /json/)
      .expect(201); // Expect HTTP status 201 Created

    expect(res.body).toHaveProperty('username', userAlice.username);
  });

  // Test 2: Create User Alice - Duplicate Error
  test('should fail to create duplicate user "alice"', async () => {
    // First, ensure alice exists (could rely on previous test, but safer to create here)
    await request(baseURL).post('/users').send(userAlice);

    const res = await request(baseURL)
      .post('/users')
      .send(userAlice)
      .expect('Content-Type', /json/)
      .expect(400); // Expect HTTP status 400 Bad Request

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain(`Username "${userAlice.username}" is already taken`);
  });

  // Test 3: Create Poll by Alice - Success
  test('should allow alice to create a poll', async () => {
    // Ensure alice exists
    await request(baseURL).post('/users').send(userAlice);

    const pollData = {
      question: "Alice's favorite language?",
      options: ['JavaScript', 'Python', 'Rust'],
      creator: userAlice.username,
    };

    const res = await request(baseURL)
      .post('/polls')
      .send(pollData)
      .expect('Content-Type', /json/)
      .expect(201); // Expect HTTP status 201 Created

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('question', pollData.question);
    expect(res.body).toHaveProperty('options', pollData.options);
    expect(res.body).toHaveProperty('creator', userAlice.username);
    expect(res.body).toHaveProperty('votes', {}); // Votes should be an empty object in JSON response

    pollByAlice = res.body; // Save the created poll for later tests
  });

  // Test 4: Bob votes on Alice's poll - Success
  test("should allow bob to vote on alice's poll", async () => {
    // Ensure alice and her poll exist
    await request(baseURL).post('/users').send(userAlice);
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Poll for Bob to vote on',
        options: ['Yes', 'No'],
        creator: userAlice.username,
      });
    const pollId = pollRes.body.id;

    // Ensure bob exists
    await request(baseURL).post('/users').send(userBob);

    const voteData = {
      username: userBob.username,
      optionIndex: 1, // Bob votes for "No"
    };

    const res = await request(baseURL)
      .post(`/polls/${pollId}/vote`)
      .send(voteData)
      .expect('Content-Type', /json/)
      .expect(200); // Expect HTTP status 200 OK

    expect(res.body).toHaveProperty('id', pollId);
    expect(res.body.votes).toHaveProperty(userBob.username, voteData.optionIndex);
  });

  // Test 5: Alice deletes her poll - Success
  test('should allow alice to delete her poll', async () => {
    // Ensure alice and her poll exist
    await request(baseURL).post('/users').send(userAlice);
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Poll to be deleted',
        options: ['Delete', 'Keep'],
        creator: userAlice.username,
      });
    const pollId = pollRes.body.id;

    // Alice sends delete request with her username in the body
    const deleteData = { username: userAlice.username };

    await request(baseURL)
      .delete(`/polls/${pollId}`)
      .send(deleteData) // Send username in body as required by route
      .expect(200); // Expect HTTP status 200 OK

    // Verify poll is gone
    await request(baseURL).get(`/polls/${pollId}`).expect(404); // Expect HTTP status 404 Not Found
  });

  // Test 6: List all polls
  test('should list all polls', async () => {
    // Create a couple of users and polls
    await request(baseURL).post('/users').send(userAlice);
    await request(baseURL).post('/users').send(userBob);
    const poll1 = await request(baseURL)
      .post('/polls')
      .send({ question: 'Q1', options: ['A', 'B'], creator: userAlice.username });
    const poll2 = await request(baseURL)
      .post('/polls')
      .send({ question: 'Q2', options: ['C', 'D'], creator: userBob.username });

    const res = await request(baseURL).get('/polls').expect('Content-Type', /json/).expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // Could be more if previous tests didn't clean up perfectly, but should contain these two
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: poll1.body.id }),
        expect.objectContaining({ id: poll2.body.id }),
      ]),
    );
  });

  // Test 7: Bob attempts to delete Alice's poll - Failure (403)
  test("should prevent bob from deleting alice's poll", async () => {
    // Ensure users and poll exist
    await request(baseURL).post('/users').send(userAlice);
    await request(baseURL).post('/users').send(userBob);
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Protected Poll',
        options: ['Safe', 'Not Safe'],
        creator: userAlice.username,
      });
    const pollId = pollRes.body.id;

    // Bob sends delete request with his username
    const deleteData = { username: userBob.username };

    const res = await request(baseURL)
      .delete(`/polls/${pollId}`)
      .send(deleteData)
      .expect('Content-Type', /json/)
      .expect(403); // Expect HTTP status 403 Forbidden

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain(`User "${userBob.username}" is not authorized`);

    // Verify poll still exists
    await request(baseURL).get(`/polls/${pollId}`).expect(200);
  });

  // Test 8: Vote with invalid option index - Failure (400)
  test('should fail to vote with an invalid option index', async () => {
    // Setup user and poll
    await request(baseURL).post('/users').send(userAlice);
    const pollRes = await request(baseURL)
      .post('/polls')
      .send({
        question: 'Index Test',
        options: ['Option 0', 'Option 1'],
        creator: userAlice.username,
      });
    const pollId = pollRes.body.id;
    await request(baseURL).post('/users').send(userBob);

    const voteData = {
      username: userBob.username,
      optionIndex: 5, // Invalid index
    };

    const res = await request(baseURL)
      .post(`/polls/${pollId}/vote`)
      .send(voteData)
      .expect('Content-Type', /json/)
      .expect(400); // Expect Bad Request

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Invalid option index');
  });

  // Test 9: Get polls created by a specific user
  test('should get polls created by alice', async () => {
    // Setup users and polls
    await request(baseURL).post('/users').send(userAlice);
    await request(baseURL).post('/users').send(userBob);
    const poll1 = await request(baseURL)
      .post('/polls')
      .send({ question: 'Alice Q1', options: ['A', 'B'], creator: userAlice.username });
    await request(baseURL)
      .post('/polls')
      .send({ question: 'Bob Q1', options: ['C', 'D'], creator: userBob.username }); // Poll by Bob

    // Get polls created by Alice via user route
    let res = await request(baseURL)
      .get(`/users/${userAlice.username}/polls`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(poll1.body.id);
    expect(res.body[0].creator).toBe(userAlice.username);

    // Get polls created by Alice via poll route query param
    res = await request(baseURL)
      .get(`/polls?createdBy=${userAlice.username}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(poll1.body.id);
    expect(res.body[0].creator).toBe(userAlice.username);
  });

  // Test 10: Get polls voted in by a specific user
  test('should get polls bob voted in', async () => {
    // Setup users and polls
    await request(baseURL).post('/users').send(userAlice);
    await request(baseURL).post('/users').send(userBob);
    const poll1Res = await request(baseURL)
      .post('/polls')
      .send({ question: 'Poll 1', options: ['1A', '1B'], creator: userAlice.username });
    const poll2Res = await request(baseURL)
      .post('/polls')
      .send({ question: 'Poll 2', options: ['2A', '2B'], creator: userAlice.username });
    await request(baseURL)
      .post('/polls')
      .send({ question: 'Poll 3', options: ['3A', '3B'], creator: userAlice.username }); // Poll Bob doesn't vote in

    // Bob votes in Poll 1 and Poll 2
    await request(baseURL)
      .post(`/polls/${poll1Res.body.id}/vote`)
      .send({ username: userBob.username, optionIndex: 0 });
    await request(baseURL)
      .post(`/polls/${poll2Res.body.id}/vote`)
      .send({ username: userBob.username, optionIndex: 1 });

    // Get polls Bob voted in
    const res = await request(baseURL)
      .get(`/users/${userBob.username}/votes`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(2);
    // Check if the IDs of the polls Bob voted in are present
    const votedPollIds = res.body.map((p) => p.id);
    expect(votedPollIds).toContain(poll1Res.body.id);
    expect(votedPollIds).toContain(poll2Res.body.id);
  });
});
