import fs from 'fs/promises';
import path from 'path';
import {
  createUser,
  findUserByUsername,
  createPoll,
  findPollById,
  updatePoll,
  deletePoll,
  getAllPolls,
  clearStorage,
} from '../src/storage/memoryStorage.js'; // Note: Still using memoryStorage name

const storageFilePath = path.resolve(process.cwd(), 'storage.json');

beforeEach(async () => {
  await clearStorage(); // Ensure storage is cleared before each test
});

// Helper to read the raw file content for verification
async function readRawStorageFile() {
  try {
    const data = await fs.readFile(storageFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

describe('File Storage (memoryStorage.js)', () => {
  // Ensure a clean state before each test
  beforeEach(async () => {
    await clearStorage(); // This should create an empty storage file
  });

  // Optional: Clean up the file after all tests in this suite
  afterAll(async () => {
    try {
      await fs.unlink(storageFilePath); // Delete the storage file
      console.log('Cleaned up storage.json');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Ignore if file already gone
        console.error('Error cleaning up storage.json:', error);
      }
    }
  });

  test('should create storage.json if it does not exist on first write', async () => {
    // Clear first ensures it's gone or empty
    await clearStorage();
    // Delete it to test creation
    try {
      await fs.unlink(storageFilePath);
    } catch (e) {
      /* ignore */
    }

    await createUser('testUserInit');
    const fileContent = await readRawStorageFile();
    expect(fileContent).not.toBeNull();
    expect(fileContent).toHaveProperty('users');
    expect(fileContent).toHaveProperty('polls');
    expect(fileContent.users).toHaveProperty('testUserInit');
  });

  test('should write and read a user', async () => {
    const username = 'fileUser';
    await createUser(username);

    // Verify using the module's read function
    const foundUser = await findUserByUsername(username);
    expect(foundUser).toBeDefined();
    expect(foundUser.username).toBe(username);

    // Verify raw file content
    const fileContent = await readRawStorageFile();
    expect(fileContent.users[username]).toEqual({ username });
  });

  test('should write and read a poll, serializing votes Map', async () => {
    const pollData = {
      id: 'poll-file-test-1',
      question: 'File Storage Test?',
      options: ['Yes', 'No'],
      creator: 'admin',
    };
    // Create user first if needed by constraints (though storage doesn't enforce)
    await createUser('admin');
    const createdPoll = await createPoll(pollData);

    expect(createdPoll.votes).toBeInstanceOf(Map); // Should return with Map

    // Verify using the module's read function
    const foundPoll = await findPollById(pollData.id);
    expect(foundPoll).toBeDefined();
    expect(foundPoll.question).toBe(pollData.question);
    expect(foundPoll.votes).toBeInstanceOf(Map); // Should be deserialized to Map
    expect(foundPoll.votes.size).toBe(0);

    // Verify raw file content (votes should be an empty object)
    const fileContent = await readRawStorageFile();
    expect(fileContent.polls[pollData.id]).toBeDefined();
    expect(fileContent.polls[pollData.id].votes).toEqual({}); // Serialized as object
  });

  test('should update a poll and handle votes serialization/deserialization', async () => {
    const pollData = {
      id: 'poll-file-update-1',
      question: 'Update Test?',
      options: ['A', 'B'],
      creator: 'updater',
    };
    await createUser('updater');
    await createUser('voter1');
    const initialPoll = await createPoll(pollData);

    // Simulate a vote (update the poll with a new votes Map)
    const updatedVotes = new Map();
    updatedVotes.set('voter1', 0); // voter1 votes for option 0 ('A')
    await updatePoll(initialPoll.id, { votes: updatedVotes });

    // Verify using the module's read function
    const foundPoll = await findPollById(initialPoll.id);
    expect(foundPoll).toBeDefined();
    expect(foundPoll.votes).toBeInstanceOf(Map);
    expect(foundPoll.votes.size).toBe(1);
    expect(foundPoll.votes.get('voter1')).toBe(0);

    // Verify raw file content (votes should be serialized object)
    const fileContent = await readRawStorageFile();
    expect(fileContent.polls[initialPoll.id]).toBeDefined();
    expect(fileContent.polls[initialPoll.id].votes).toEqual({ voter1: 0 }); // Serialized
  });

  test('should delete a poll from the file', async () => {
    const pollData = {
      id: 'poll-file-delete-1',
      question: 'Delete Test?',
      options: ['Keep', 'Remove'],
      creator: 'deleter',
    };
    await createUser('deleter');
    await createPoll(pollData);

    // Verify it exists first
    let fileContent = await readRawStorageFile();
    expect(fileContent.polls[pollData.id]).toBeDefined();

    // Delete the poll
    const deleted = await deletePoll(pollData.id);
    expect(deleted).toBe(true);

    // Verify it's gone using module's read function
    const foundPoll = await findPollById(pollData.id);
    expect(foundPoll).toBeUndefined();

    // Verify it's gone from raw file content
    fileContent = await readRawStorageFile();
    expect(fileContent.polls[pollData.id]).toBeUndefined();
  });

  test('should retrieve all polls correctly', async () => {
    await createUser('creatorA');
    await createUser('creatorB');
    await createPoll({ id: 'p1', question: 'Q1', options: ['1', '2'], creator: 'creatorA' });
    await createPoll({ id: 'p2', question: 'Q2', options: ['3', '4'], creator: 'creatorB' });

    const allPolls = await getAllPolls();
    expect(allPolls).toHaveLength(2);
    expect(allPolls.some((p) => p.id === 'p1')).toBe(true);
    expect(allPolls.some((p) => p.id === 'p2')).toBe(true);
    expect(allPolls[0].votes).toBeInstanceOf(Map); // Check deserialization
    expect(allPolls[1].votes).toBeInstanceOf(Map);
  });

  test('clearStorage should empty the file', async () => {
    await createUser('tempUser');
    await createPoll({ id: 'tempPoll', question: 'Q', options: ['o1', 'o2'], creator: 'tempUser' });

    // Verify file has content
    let fileContent = await readRawStorageFile();
    expect(Object.keys(fileContent.users).length).toBeGreaterThan(0);
    expect(Object.keys(fileContent.polls).length).toBeGreaterThan(0);

    await clearStorage();

    // Verify file is empty/reset
    fileContent = await readRawStorageFile();
    expect(fileContent).toEqual({ users: {}, polls: {} });

    // Verify through read functions
    const users = await findUserByUsername('tempUser');
    expect(users).toBeUndefined();
    const polls = await getAllPolls();
    expect(polls).toEqual([]);
  });
});
