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
import { clearStorage, findPollById as findPollInStorage } from '../src/storage/memoryStorage.js';
import { validate as validateUUID } from 'uuid'; // Import UUID validation

// Helper function to create a user for tests
const setupUser = async (username) => {
  try {
    return await createUser(username);
  } catch (error) {
    // Ignore error if user already exists from a previous failed test run (though beforeEach should handle)
    if (!error.message.includes('already taken')) {
      throw error;
    }
    return { username }; // Return existing user info
  }
};

describe('Poll Service', () => {
  let testUser1;
  let testUser2;

  // Setup users and clear storage before each test
  beforeEach(async () => {
    await clearStorage();
    testUser1 = await setupUser('user1');
    testUser2 = await setupUser('user2');
  });

  describe('createPoll', () => {
    test('should create a poll successfully with a valid UUID', async () => {
      const question = 'Favorite color?';
      const options = ['Red', 'Blue'];
      const poll = await createPoll(question, options, testUser1.username);

      expect(poll).toBeDefined();
      expect(poll.question).toBe(question);
      expect(poll.options).toEqual(options);
      expect(poll.creator).toBe(testUser1.username);
      expect(poll.id).toBeDefined();
      expect(validateUUID(poll.id)).toBe(true); // Check if ID is a valid UUID
      expect(poll.votes).toBeInstanceOf(Map);
      expect(poll.votes.size).toBe(0);

      // Verify in storage
      const storedPoll = await findPollInStorage(poll.id);
      expect(storedPoll).toEqual(poll);
    });

    test('should throw error if creator does not exist', async () => {
      await expect(createPoll('Q?', ['A', 'B'], 'nonexistentUser')).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Q?', ['A', 'B'], 'nonexistentUser')).rejects.toThrow(
        'User "nonexistentUser" does not exist',
      );
    });

    test('should throw error for invalid poll data (e.g., < 2 options)', async () => {
      await expect(createPoll('Q?', ['One'], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Q?', ['One'], testUser1.username)).rejects.toThrow(
        'Poll must have at least two options.',
      );
    });

    test('should throw error for non-unique options', async () => {
      await expect(createPoll('Q?', ['A', 'B', 'A'], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Q?', ['A', 'B', 'A'], testUser1.username)).rejects.toThrow(
        'Poll options must be unique.',
      );
    });

    test('should throw error for empty question', async () => {
      await expect(createPoll('', ['A', 'B'], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('  ', ['A', 'B'], testUser1.username)).rejects.toThrow(
        'Poll question cannot be empty.',
      );
    });

    test('should throw error for empty options', async () => {
      await expect(createPoll('Q?', ['A', ''], testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(createPoll('Q?', ['A', '  '], testUser1.username)).rejects.toThrow(
        'All poll options must be non-empty strings.',
      );
    });
  });

  describe('deletePoll', () => {
    let poll;
    beforeEach(async () => {
      poll = await createPoll('Delete?', ['Yes', 'No'], testUser1.username);
    });

    test('should allow the creator to delete their poll', async () => {
      const result = await deletePoll(poll.id, testUser1.username);
      expect(result).toBe(true);
      const storedPoll = await findPollInStorage(poll.id);
      expect(storedPoll).toBeUndefined();
    });

    test('should prevent a non-creator from deleting a poll', async () => {
      await expect(deletePoll(poll.id, testUser2.username)).rejects.toThrow(BusinessLogicError);
      await expect(deletePoll(poll.id, testUser2.username)).rejects.toThrow(
        `User "${testUser2.username}" is not authorized to delete poll "${poll.id}".`,
      );
      // Verify poll still exists
      const storedPoll = await findPollInStorage(poll.id);
      expect(storedPoll).toBeDefined();
    });

    test('should throw error when trying to delete a non-existent poll', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(deletePoll(nonExistentId, testUser1.username)).rejects.toThrow(
        BusinessLogicError,
      );
      await expect(deletePoll(nonExistentId, testUser1.username)).rejects.toThrow(
        `Poll with ID "${nonExistentId}" not found.`,
      );
    });
  });

  describe('vote', () => {
    let poll;
    beforeEach(async () => {
      poll = await createPoll('Vote?', ['Opt1', 'Opt2'], testUser1.username);
    });

    test('should allow a user to vote successfully', async () => {
      const optionIndex = 0;
      const updatedPoll = await vote(poll.id, optionIndex, testUser2.username);

      expect(updatedPoll).toBeDefined();
      expect(updatedPoll.votes).toBeInstanceOf(Map);
      expect(updatedPoll.votes.size).toBe(1);
      expect(updatedPoll.votes.get(testUser2.username)).toBe(optionIndex);

      // Verify in storage
      const storedPoll = await findPollInStorage(poll.id);
      expect(storedPoll.votes.get(testUser2.username)).toBe(optionIndex);
    });

    test('should prevent a user from voting twice', async () => {
      await vote(poll.id, 0, testUser2.username); // First vote

      await expect(vote(poll.id, 1, testUser2.username)) // Second vote attempt
        .rejects.toThrow(BusinessLogicError);
      await expect(vote(poll.id, 1, testUser2.username)).rejects.toThrow(
        `User "${testUser2.username}" has already voted in poll "${poll.id}".`,
      );

      // Verify only the first vote is stored
      const storedPoll = await findPollInStorage(poll.id);
      expect(storedPoll.votes.size).toBe(1);
      expect(storedPoll.votes.get(testUser2.username)).toBe(0);
    });

    test('should throw error for invalid option index', async () => {
      await expect(vote(poll.id, 99, testUser2.username)) // Index out of bounds
        .rejects.toThrow(BusinessLogicError);
      await expect(vote(poll.id, 99, testUser2.username)).rejects.toThrow(
        `Invalid option index "99" for poll "${poll.id}".`,
      );

      await expect(vote(poll.id, -1, testUser2.username)) // Negative index
        .rejects.toThrow(BusinessLogicError);
      await expect(vote(poll.id, -1, testUser2.username)).rejects.toThrow(
        `Invalid option index "-1" for poll "${poll.id}".`,
      );

      await expect(vote(poll.id, 0.5, testUser2.username)) // Non-integer index
        .rejects.toThrow(BusinessLogicError);
      await expect(vote(poll.id, 0.5, testUser2.username)).rejects.toThrow(
        `Invalid option index "0.5" for poll "${poll.id}".`,
      );
    });

    test('should throw error if poll does not exist', async () => {
      const nonExistentId = '11111111-1111-1111-1111-111111111111';
      await expect(vote(nonExistentId, 0, testUser2.username)).rejects.toThrow(BusinessLogicError);
      await expect(vote(nonExistentId, 0, testUser2.username)).rejects.toThrow(
        `Poll with ID "${nonExistentId}" not found.`,
      );
    });

    test('should throw error if voting user does not exist', async () => {
      await expect(vote(poll.id, 0, 'ghostUser')).rejects.toThrow(BusinessLogicError);
      await expect(vote(poll.id, 0, 'ghostUser')).rejects.toThrow('User "ghostUser" not found.');
    });
  });

  describe('getPollById', () => {
    let poll;
    beforeEach(async () => {
      poll = await createPoll('Find Me?', ['X', 'Y'], testUser1.username);
    });

    test('should return the correct poll', async () => {
      const foundPoll = await getPollById(poll.id);
      expect(foundPoll).toEqual(poll);
    });

    test('should return undefined for a non-existent poll ID', async () => {
      const nonExistentId = '22222222-2222-2222-2222-222222222222';
      const foundPoll = await getPollById(nonExistentId);
      expect(foundPoll).toBeUndefined();
    });
  });

  describe('getAllPolls', () => {
    test('should return an empty array when no polls exist', async () => {
      const polls = await getAllPolls();
      expect(polls).toEqual([]);
    });

    test('should return all created polls', async () => {
      const poll1 = await createPoll('Q1', ['A', 'B'], testUser1.username);
      const poll2 = await createPoll('Q2', ['C', 'D'], testUser2.username);
      const polls = await getAllPolls();
      expect(polls).toHaveLength(2);
      // Use expect.arrayContaining to check for presence regardless of order
      expect(polls).toEqual(expect.arrayContaining([poll1, poll2]));
    });
  });

  describe('getPollsByCreator', () => {
    let poll1, poll2;
    beforeEach(async () => {
      poll1 = await createPoll('User1 Poll', ['1a', '1b'], testUser1.username);
      poll2 = await createPoll('User2 Poll', ['2a', '2b'], testUser2.username);
    });

    test('should return only polls created by the specified user', async () => {
      const user1Polls = await getPollsByCreator(testUser1.username);
      expect(user1Polls).toHaveLength(1);
      expect(user1Polls[0]).toEqual(poll1);

      const user2Polls = await getPollsByCreator(testUser2.username);
      expect(user2Polls).toHaveLength(1);
      expect(user2Polls[0]).toEqual(poll2);
    });

    test('should return an empty array if the user exists but has created no polls', async () => {
      const newUser = await setupUser('user3');
      const user3Polls = await getPollsByCreator(newUser.username);
      expect(user3Polls).toEqual([]);
    });

    test('should throw error if the specified creator user does not exist', async () => {
      await expect(getPollsByCreator('nonexistentUser')).rejects.toThrow(BusinessLogicError);
      await expect(getPollsByCreator('nonexistentUser')).rejects.toThrow(
        'User "nonexistentUser" not found.',
      );
    });
  });

  describe('getPollsVotedInByUser', () => {
    let poll1, poll2, poll3;
    beforeEach(async () => {
      poll1 = await createPoll('Poll 1', ['1', '2'], testUser1.username);
      poll2 = await createPoll('Poll 2', ['A', 'B'], testUser1.username);
      poll3 = await createPoll('Poll 3', ['X', 'Y'], testUser2.username); // User2 created this

      // User1 votes in Poll 2 and Poll 3
      await vote(poll2.id, 0, testUser1.username);
      await vote(poll3.id, 1, testUser1.username);

      // User2 votes in Poll 1
      await vote(poll1.id, 0, testUser2.username);
    });

    test('should return only polls the specified user has voted in', async () => {
      const user1Votes = await getPollsVotedInByUser(testUser1.username);
      expect(user1Votes).toHaveLength(2);
      // Need to get updated poll objects as votes change them
      const updatedPoll2 = await getPollById(poll2.id);
      const updatedPoll3 = await getPollById(poll3.id);
      expect(user1Votes).toEqual(expect.arrayContaining([updatedPoll2, updatedPoll3]));

      const user2Votes = await getPollsVotedInByUser(testUser2.username);
      expect(user2Votes).toHaveLength(1);
      const updatedPoll1 = await getPollById(poll1.id);
      expect(user2Votes[0]).toEqual(updatedPoll1);
    });

    test('should return an empty array if the user exists but has not voted', async () => {
      const newUser = await setupUser('user3');
      const user3Votes = await getPollsVotedInByUser(newUser.username);
      expect(user3Votes).toEqual([]);
    });

    test('should throw error if the specified voting user does not exist', async () => {
      await expect(getPollsVotedInByUser('nonexistentVoter')).rejects.toThrow(BusinessLogicError);
      await expect(getPollsVotedInByUser('nonexistentVoter')).rejects.toThrow(
        'User "nonexistentVoter" not found.',
      );
    });
  });
});
