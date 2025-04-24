import {
  createPoll,
  deletePoll,
  vote,
  getPollById,
  getAllPolls,
  getPollsByCreator,
  getPollsVotedInByUser,
} from '../src/services/pollService.js';
import { createUser, BusinessLogicError } from '../src/services/userService.js';
import * as storage from '../src/storage/memoryStorage.js';
import { validate as validateUUID } from 'uuid'; // Import for UUID validation

// Helper to create users for tests
const setupUser = async (username) => {
  try {
    return await createUser(username);
  } catch (error) {
    // If user exists from previous test, just return the username
    if (error.message && error.message.includes('already taken')) {
      return { username };
    }
    throw error;
  }
};

describe('Poll Service', () => {
  let testUser1;
  let testUser2;

  // Setup users and clean storage before each test
  beforeEach(async () => {
    await storage.clearStorage();
    testUser1 = await setupUser('user1');
    testUser2 = await setupUser('user2');
  });

  describe('createPoll', () => {
    test('should create a poll successfully with a valid UUID', async () => {
      const question = 'Test question?';
      const options = ['Option A', 'Option B'];
      const poll = await createPoll(question, options, testUser1.username);

      expect(poll).toBeDefined();
      expect(poll.question).toBe(question);
      expect(poll.options).toEqual(options);
      expect(poll.creator).toBe(testUser1.username);
      expect(poll.id).toBeDefined();
      expect(validateUUID(poll.id)).toBe(true); // Validate UUID format
      expect(poll.votes).toBeInstanceOf(Map);
      expect(poll.votes.size).toBe(0);

      // Verify poll was stored correctly
      const storedPoll = await storage.findPollById(poll.id);
      expect(storedPoll).toEqual(poll);
    });

    test('should throw error if creator does not exist', async () => {
      await expect(createPoll('Question?', ['A', 'B'], 'nonexistentUser')).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Question?', ['A', 'B'], 'nonexistentUser')).rejects.toThrow(
        'does not exist',
      );
    });

    test('should throw error for invalid poll data (empty question)', async () => {
      await expect(createPoll('', ['A', 'B'], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('', ['A', 'B'], testUser1.username)).rejects.toThrow(
        'question cannot be empty',
      );
    });

    test('should throw error for too few options', async () => {
      await expect(createPoll('Question?', ['A'], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Question?', ['A'], testUser1.username)).rejects.toThrow(
        'at least two options',
      );
    });

    test('should throw error for non-unique options', async () => {
      await expect(createPoll('Question?', ['A', 'A'], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Question?', ['A', 'A'], testUser1.username)).rejects.toThrow(
        'options must be unique',
      );
    });
  });

  describe('deletePoll', () => {
    let pollId;

    beforeEach(async () => {
      // Create a poll to delete
      const poll = await createPoll('Delete me?', ['Yes', 'No'], testUser1.username);
      pollId = poll.id;
    });

    test('should allow creator to delete their poll', async () => {
      const result = await deletePoll(pollId, testUser1.username);
      expect(result).toBe(true);

      // Verify poll is gone
      const poll = await getPollById(pollId);
      expect(poll).toBeUndefined();
    });

    test('should prevent non-creator from deleting poll', async () => {
      await expect(deletePoll(pollId, testUser2.username)).rejects.toThrow(BusinessLogicError);
      await expect(deletePoll(pollId, testUser2.username)).rejects.toThrow('not authorized');

      // Verify poll still exists
      const poll = await getPollById(pollId);
      expect(poll).toBeDefined();
    });

    test('should throw error for non-existent poll', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(deletePoll(fakeId, testUser1.username)).rejects.toThrow(BusinessLogicError);
      await expect(deletePoll(fakeId, testUser1.username)).rejects.toThrow('not found');
    });
  });

  describe('vote', () => {
    let pollId;

    beforeEach(async () => {
      // Create a poll to vote on
      const poll = await createPoll('Vote question?', ['Option 1', 'Option 2'], testUser1.username);
      pollId = poll.id;
    });

    test('should record a vote successfully', async () => {
      const optionIndex = 1;
      const updatedPoll = await vote(pollId, optionIndex, testUser2.username);

      expect(updatedPoll).toBeDefined();
      expect(updatedPoll.votes).toBeInstanceOf(Map);
      expect(updatedPoll.votes.size).toBe(1);
      expect(updatedPoll.votes.get(testUser2.username)).toBe(optionIndex);

      // Verify vote was saved
      const storedPoll = await getPollById(pollId);
      expect(storedPoll.votes.get(testUser2.username)).toBe(optionIndex);
    });

    test('should prevent user from voting twice on same poll', async () => {
      // First vote should succeed
      await vote(pollId, 0, testUser2.username);

      // Second vote should fail
      await expect(vote(pollId, 1, testUser2.username)).rejects.toThrow(BusinessLogicError);
      await expect(vote(pollId, 1, testUser2.username)).rejects.toThrow('already voted');

      // Verify only first vote was recorded
      const poll = await getPollById(pollId);
      expect(poll.votes.get(testUser2.username)).toBe(0);
    });

    test('should throw error for invalid option index', async () => {
      // Negative index
      await expect(vote(pollId, -1, testUser2.username)).rejects.toThrow(BusinessLogicError);

      // Out of bounds index
      await expect(vote(pollId, 99, testUser2.username)).rejects.toThrow(BusinessLogicError);

      // Non-integer index
      await expect(vote(pollId, 0.5, testUser2.username)).rejects.toThrow(BusinessLogicError);
    });

    test('should throw error if poll does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(vote(fakeId, 0, testUser2.username)).rejects.toThrow(BusinessLogicError);
      await expect(vote(fakeId, 0, testUser2.username)).rejects.toThrow('not found');
    });

    test('should throw error if user does not exist', async () => {
      await expect(vote(pollId, 0, 'nonExistentUser')).rejects.toThrow(BusinessLogicError);
      await expect(vote(pollId, 0, 'nonExistentUser')).rejects.toThrow('not found');
    });
  });

  describe('getPollById', () => {
    test('should retrieve a poll by ID', async () => {
      const question = 'Test retrieval?';
      const options = ['Yes', 'No'];
      const createdPoll = await createPoll(question, options, testUser1.username);

      const retrievedPoll = await getPollById(createdPoll.id);
      expect(retrievedPoll).toBeDefined();
      expect(retrievedPoll.id).toBe(createdPoll.id);
      expect(retrievedPoll.question).toBe(question);
      expect(retrievedPoll.options).toEqual(options);
    });

    test('should return undefined for non-existent poll ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const poll = await getPollById(fakeId);
      expect(poll).toBeUndefined();
    });
  });

  describe('getAllPolls', () => {
    test('should return empty array when no polls exist', async () => {
      const polls = await getAllPolls();
      expect(polls).toEqual([]);
    });

    test('should return all created polls', async () => {
      // Create test polls
      const poll1 = await createPoll('Q1?', ['A', 'B'], testUser1.username);
      const poll2 = await createPoll('Q2?', ['C', 'D'], testUser2.username);

      const allPolls = await getAllPolls();
      expect(allPolls).toHaveLength(2);
      expect(allPolls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: poll1.id }),
          expect.objectContaining({ id: poll2.id }),
        ]),
      );
    });
  });

  describe('getPollsByCreator', () => {
    beforeEach(async () => {
      // Create polls by different users
      await createPoll('User1 Poll', ['A', 'B'], testUser1.username);
      await createPoll('User2 Poll', ['C', 'D'], testUser2.username);
      await createPoll('User1 Poll 2', ['E', 'F'], testUser1.username);
    });

    test('should return only polls created by specified user', async () => {
      const user1Polls = await getPollsByCreator(testUser1.username);
      expect(user1Polls).toHaveLength(2);
      expect(user1Polls.every((p) => p.creator === testUser1.username)).toBe(true);

      const user2Polls = await getPollsByCreator(testUser2.username);
      expect(user2Polls).toHaveLength(1);
      expect(user2Polls[0].creator).toBe(testUser2.username);
    });

    test('should return empty array for user with no polls', async () => {
      const user3 = await setupUser('user3');
      const user3Polls = await getPollsByCreator(user3.username);
      expect(user3Polls).toEqual([]);
    });

    test('should throw error for non-existent user', async () => {
      await expect(getPollsByCreator('nonExistentUser')).rejects.toThrow(BusinessLogicError);
      await expect(getPollsByCreator('nonExistentUser')).rejects.toThrow('not found');
    });
  });

  describe('getPollsVotedInByUser', () => {
    beforeEach(async () => {
      // Create polls
      const poll1 = await createPoll('Poll 1', ['A', 'B'], testUser1.username);
      const poll2 = await createPoll('Poll 2', ['C', 'D'], testUser1.username);
      const poll3 = await createPoll('Poll 3', ['E', 'F'], testUser2.username);

      // User2 votes in poll1 and poll3
      await vote(poll1.id, 0, testUser2.username);
      await vote(poll3.id, 1, testUser2.username);

      // User1 votes in poll2
      await vote(poll2.id, 0, testUser1.username);
    });

    test('should return polls voted in by the specified user', async () => {
      const user2VotedPolls = await getPollsVotedInByUser(testUser2.username);
      expect(user2VotedPolls).toHaveLength(2);
      expect(user2VotedPolls.every((p) => p.votes.has(testUser2.username))).toBe(true);

      const user1VotedPolls = await getPollsVotedInByUser(testUser1.username);
      expect(user1VotedPolls).toHaveLength(1);
      expect(user1VotedPolls[0].votes.has(testUser1.username)).toBe(true);
    });

    test('should return empty array for user who has not voted', async () => {
      const user3 = await setupUser('user3');
      const user3VotedPolls = await getPollsVotedInByUser(user3.username);
      expect(user3VotedPolls).toEqual([]);
    });

    test('should throw error for non-existent user', async () => {
      await expect(getPollsVotedInByUser('nonExistentUser')).rejects.toThrow(BusinessLogicError);
      await expect(getPollsVotedInByUser('nonExistentUser')).rejects.toThrow('not found');
    });
  });
});
