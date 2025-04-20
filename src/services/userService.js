import * as storage from '../storage/memoryStorage.js';

/**
 * Represents an error specific to business logic validation.
 * Allows distinguishing validation errors from other potential errors.
 */
export class BusinessLogicError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Creates a new user after validating the input.
 * @param {string} username - The username for the new user.
 * @returns {Promise<{username: string}>} A promise that resolves with the created user object.
 * @throws {BusinessLogicError} If the username is invalid or already exists.
 */
export async function createUser(username) {
  // Basic validation (can be expanded)
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    throw new BusinessLogicError('Username cannot be empty.');
  }

  const trimmedUsername = username.trim();

  // Check for duplicates using the storage layer
  const existingUser = await storage.findUserByUsername(trimmedUsername);
  if (existingUser) {
    throw new BusinessLogicError(`Username "${trimmedUsername}" is already taken.`);
  }

  // If validation passes, create the user via the storage layer
  return storage.createUser(trimmedUsername);
}

/**
 * Finds a user by username. Primarily used internally or by other services.
 * @param {string} username - The username to find.
 * @returns {Promise<{username: string} | undefined>} A promise resolving to the user or undefined.
 */
export async function findUser(username) {
  return storage.findUserByUsername(username);
}
