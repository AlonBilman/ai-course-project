import { v4 as uuidv4 } from 'uuid';
import * as storage from '../storage/memoryStorage.js';
import * as userService from './userService.js';
import { BusinessLogicError } from './userService.js'; // Re-use the custom error

/**
 * Validates poll data before creation.
 * @param {string} question - The poll question.
 * @param {string[]} options - The poll options.
 * @param {string} creatorUsername - The username of the creator.
 * @throws {BusinessLogicError} If validation fails.
 */
function validatePollData(question, options, creatorUsername) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new BusinessLogicError('Poll question cannot be empty.');
  }
  if (!Array.isArray(options) || options.length < 2) {
    // Example: require at least 2 options
    throw new BusinessLogicError('Poll must have at least two options.');
  }
  if (options.some((opt) => typeof opt !== 'string' || opt.trim().length === 0)) {
    throw new BusinessLogicError('All poll options must be non-empty strings.');
  }
  // Check for duplicate options
  const uniqueOptions = new Set(options.map((opt) => opt.trim()));
  if (uniqueOptions.size !== options.length) {
    throw new BusinessLogicError('Poll options must be unique.');
  }
  if (
    !creatorUsername ||
    typeof creatorUsername !== 'string' ||
    creatorUsername.trim().length === 0
  ) {
    throw new BusinessLogicError('Creator username must be provided.');
  }
}

/**
 * Creates a new poll.
 * @param {string} question - The poll question.
 * @param {string[]} options - An array of poll options (strings).
 * @param {string} creatorUsername - The username of the user creating the poll.
 * @returns {Promise<object>} A promise that resolves with the created poll object.
 * @throws {BusinessLogicError} If validation fails or the creator doesn't exist.
 */
export async function createPoll(question, options, creatorUsername) {
  validatePollData(question, options, creatorUsername);
  const trimmedUsername = creatorUsername.trim();

  // Check if creator user exists
  const creator = await userService.findUser(trimmedUsername);
  if (!creator) {
    throw new BusinessLogicError(
      `User "${trimmedUsername}" does not exist and cannot create a poll.`,
    );
  }

  const pollId = uuidv4(); // Generate UUID for the poll
  const pollData = {
    id: pollId,
    question: question.trim(),
    options: options.map((opt) => opt.trim()),
    creator: trimmedUsername,
    // votes Map is initialized in storage layer
  };

  return storage.createPoll(pollData);
}

/**
 * Deletes a poll if the requesting user is the creator.
 * @param {string} pollId - The ID of the poll to delete.
 * @param {string} requestingUsername - The username of the user attempting deletion.
 * @returns {Promise<boolean>} A promise that resolves with true if deletion was successful.
 * @throws {BusinessLogicError} If poll not found, user not found, or user is not the creator.
 */
export async function deletePoll(pollId, requestingUsername) {
  if (!pollId || !requestingUsername) {
    throw new BusinessLogicError('Poll ID and requesting username are required for deletion.');
  }

  const poll = await storage.findPollById(pollId);
  if (!poll) {
    // Use a specific error type or message that can be mapped to 404
    throw new BusinessLogicError(`Poll with ID "${pollId}" not found.`);
  }

  // Check ownership
  if (poll.creator !== requestingUsername.trim()) {
    // Use a specific error type or message that can be mapped to 403 Forbidden
    throw new BusinessLogicError(
      `User "${requestingUsername}" is not authorized to delete poll "${pollId}".`,
    );
  }

  return storage.deletePoll(pollId);
}

/**
 * Records a user's vote on a poll.
 * @param {string} pollId - The ID of the poll to vote on.
 * @param {number} optionIndex - The index of the chosen option.
 * @param {string} username - The username of the voter.
 * @returns {Promise<object>} A promise that resolves with the updated poll object.
 * @throws {BusinessLogicError} If validation fails (poll/user not found, invalid option, already voted).
 */
export async function vote(pollId, optionIndex, username) {
  if (!pollId || optionIndex === undefined || !username) {
    throw new BusinessLogicError('Poll ID, option index, and username are required to vote.');
  }
  const trimmedUsername = username.trim();

  const poll = await storage.findPollById(pollId);
  if (!poll) {
    throw new BusinessLogicError(`Poll with ID "${pollId}" not found.`);
  }

  const user = await userService.findUser(trimmedUsername);
  if (!user) {
    throw new BusinessLogicError(`User "${trimmedUsername}" not found.`);
  }

  // Validate option index
  if (
    typeof optionIndex !== 'number' ||
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= poll.options.length
  ) {
    // Added !Number.isInteger check
    throw new BusinessLogicError(`Invalid option index "${optionIndex}" for poll "${pollId}".`);
  }

  // Check if user has already voted
  if (poll.votes.has(trimmedUsername)) {
    throw new BusinessLogicError(
      `User "${trimmedUsername}" has already voted in poll "${pollId}".`,
    );
  }

  // Record the vote (mutating the map retrieved from storage)
  poll.votes.set(trimmedUsername, optionIndex);

  // Persist the change using the storage update function
  return storage.updatePoll(pollId, { votes: poll.votes });
}

/**
 * Retrieves a single poll by its ID.
 * @param {string} pollId - The ID of the poll.
 * @returns {Promise<object | undefined>} The poll object or undefined if not found.
 */
export async function getPollById(pollId) {
  return storage.findPollById(pollId);
  // Note: The route handler will decide if undefined means 404.
}

/**
 * Retrieves all polls.
 * @returns {Promise<object[]>} A promise resolving to an array of all polls.
 */
export async function getAllPolls() {
  return storage.getAllPolls();
}

/**
 * Retrieves all polls created by a specific user.
 * @param {string} username - The creator's username.
 * @returns {Promise<object[]>} A promise resolving to an array of polls created by the user.
 * @throws {BusinessLogicError} If the user does not exist.
 */
export async function getPollsByCreator(username) {
  const trimmedUsername = username.trim();
  // Optional: Check if user exists first, depending on desired behavior
  const user = await userService.findUser(trimmedUsername);
  if (!user) {
    // Or return empty array? Decide based on requirements. Throwing seems reasonable.
    throw new BusinessLogicError(`User "${trimmedUsername}" not found.`);
  }
  return storage.findPollsByCreator(trimmedUsername);
}

/**
 * Retrieves all polls a specific user has voted in.
 * @param {string} username - The voter's username.
 * @returns {Promise<object[]>} A promise resolving to an array of polls the user voted in.
 * @throws {BusinessLogicError} If the user does not exist.
 */
export async function getPollsVotedInByUser(username) {
  const trimmedUsername = username.trim();
  // Optional: Check if user exists first
  const user = await userService.findUser(trimmedUsername);
  if (!user) {
    throw new BusinessLogicError(`User "${trimmedUsername}" not found.`);
  }
  return storage.findPollsVotedInByUser(trimmedUsername);
}
