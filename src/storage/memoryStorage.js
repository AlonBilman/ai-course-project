import fs from 'fs/promises';
import path from 'path'; // To construct file path reliably

// Define the path for the storage file
const storageFilePath = path.resolve(process.cwd(), 'storage.json'); // Store in project root

/**
 * Reads data from the JSON storage file.
 * If the file doesn't exist, returns the default structure.
 * @returns {Promise<{users: object, polls: object}>} A promise resolving to the parsed data.
 */
async function readData() {
  try {
    const data = await fs.readFile(storageFilePath, 'utf-8');
    const parsedData = JSON.parse(data);
    // Ensure votes are converted back to Maps after reading
    if (data.trim() === '') {
      return { users: {}, polls: {} };
    }
    if (parsedData.polls) {
      for (const pollId in parsedData.polls) {
        if (parsedData.polls[pollId].votes && !(parsedData.polls[pollId].votes instanceof Map)) {
          parsedData.polls[pollId].votes = new Map(Object.entries(parsedData.polls[pollId].votes));
        }
      }
    }
    return parsedData;
  } catch (error) {
    // If file not found or invalid JSON, return default structure
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      console.warn('Storage file not found or invalid. Initializing new one.');
      return { users: {}, polls: {} }; // Use objects instead of Maps for top level
    }
    // Rethrow other errors
    console.error('Error reading storage file:', error);
    throw error;
  }
}

/**
 * Writes data to the JSON storage file.
 * @param {object} data - The data object to write (containing users and polls objects).
 * @returns {Promise<void>}
 */
async function writeData(data) {
  try {
    // Prepare data for serialization: convert votes Maps to objects
    const dataToWrite = { users: data.users, polls: {} };
    if (data.polls) {
      for (const pollId in data.polls) {
        const poll = data.polls[pollId];
        dataToWrite.polls[pollId] = {
          ...poll,
          // Convert votes Map to plain object for JSON
          votes: poll.votes instanceof Map ? Object.fromEntries(poll.votes) : poll.votes || {},
        };
      }
    }
    await fs.writeFile(storageFilePath, JSON.stringify(dataToWrite, null, 2), 'utf-8'); // Pretty print JSON
  } catch (error) {
    console.error('Error writing storage file:', error);
    throw error; // Rethrow to signal failure
  }
}

/**
 * Finds a user by their username.
 * @param {string} username - The username to search for.
 * @returns {Promise<{username: string} | undefined>} A promise that resolves with the user object or undefined if not found.
 */
export async function findUserByUsername(username) {
  const data = await readData();
  return data.users[username]; // Access user from the users object
}

/**
 * Creates a new user.
 * @param {string} username - The username for the new user.
 * @returns {Promise<{username: string}>} A promise that resolves with the created user object.
 * @throws {Error} If the username already exists.
 */
export async function createUser(username) {
  const data = await readData();
  if (data.users[username]) {
    // This check should ideally be in the business logic layer,
    // but adding it here for robustness ensures storage integrity.
    // The business layer will handle the specific error response (e.g., 400).
    throw new Error(`User with username "${username}" already exists.`);
  }
  const user = { username };
  data.users[username] = user; // Add user to the users object
  await writeData(data);
  return user;
}

/**
 * Finds a poll by its ID.
 * @param {string} pollId - The UUID of the poll to find.
 * @returns {Promise<object | undefined>} A promise that resolves with the poll object (with votes as Map) or undefined if not found.
 */
export async function findPollById(pollId) {
  const data = await readData();
  // Data read includes conversion of votes object back to Map
  return data.polls[pollId];
}

/**
 * Creates a new poll.
 * @param {object} pollData - The data for the new poll (without votes map initially).
 * @param {string} pollData.id - The UUID for the poll.
 * @param {string} pollData.question - The poll question.
 * @param {string[]} pollData.options - The poll options.
 * @param {string} pollData.creator - The username of the poll creator.
 * @returns {Promise<object>} A promise that resolves with the created poll object (with votes as Map).
 */
export async function createPoll(pollData) {
  const data = await readData();
  const poll = {
    ...pollData,
    votes: new Map(), // Initialize votes as an empty Map
  };
  data.polls[poll.id] = poll;
  await writeData(data); // writeData handles converting Map to object for JSON
  // Return the poll with the Map structure
  return poll;
}

/**
 * Updates a poll (primarily for recording votes).
 * Expects updatedPollData.votes to be a Map.
 * @param {string} pollId - The ID of the poll to update.
 * @param {object} updatedPollData - The updated poll data, potentially including a 'votes' Map.
 * @returns {Promise<object>} A promise that resolves with the updated poll object (with votes as Map).
 * @throws {Error} If the poll is not found.
 */
export async function updatePoll(pollId, updatedPollData) {
  const data = await readData();
  const poll = data.polls[pollId];
  if (!poll) {
    throw new Error(`Poll with ID "${pollId}" not found for update.`);
  }

  // Merge updates - ensure votes Map is handled correctly
  const updated = {
    ...poll,
    ...updatedPollData,
    // Ensure the votes property is definitely a Map if provided
    votes: updatedPollData.votes instanceof Map ? updatedPollData.votes : poll.votes,
  };

  data.polls[pollId] = updated;
  await writeData(data); // writeData handles converting Map to object for JSON
  // Return the poll with the Map structure
  return updated;
}

/**
 * Deletes a poll by its ID.
 * @param {string} pollId - The ID of the poll to delete.
 * @returns {Promise<boolean>} A promise that resolves with true if deletion was successful, false otherwise.
 */
export async function deletePoll(pollId) {
  const data = await readData();
  if (data.polls[pollId]) {
    delete data.polls[pollId];
    await writeData(data);
    return true;
  }
  return false;
}

/**
 * Retrieves all polls.
 * @returns {Promise<object[]>} A promise that resolves with an array of all poll objects (with votes as Maps).
 */
export async function getAllPolls() {
  const data = await readData();
  // Data read includes conversion of votes object back to Map
  return Object.values(data.polls);
}

/**
 * Finds all polls created by a specific user.
 * @param {string} username - The username of the creator.
 * @returns {Promise<object[]>} A promise that resolves with an array of polls created by the user (with votes as Maps).
 */
export async function findPollsByCreator(username) {
  const allPolls = await getAllPolls();
  return allPolls.filter((poll) => poll.creator === username);
}

/**
 * Finds all polls a specific user has voted in.
 * @param {string} username - The username of the voter.
 * @returns {Promise<object[]>} A promise that resolves with an array of polls the user has voted in (with votes as Maps).
 */
export async function findPollsVotedInByUser(username) {
  const allPolls = await getAllPolls();
  // Ensure votes is treated as a Map here
  return allPolls.filter((poll) => poll.votes instanceof Map && poll.votes.has(username));
}

/**
 * Clears all users and polls from the storage file.
 * @returns {Promise<void>}
 */
export async function clearStorage() {
  // Write an empty structure to the file
  await writeData({ users: {}, polls: {} });
  console.log('Storage file cleared.');
}
