import { Poll } from './poll.js';

export class PollManager {
  #counter;

  constructor() {
    this.polls = new Map();
    this.#counter = 1;
  }

  // Generates a unique poll ID
  #generateId() {
    return this.#counter++;
  }

  /**
   * Creates a new poll.
   * @param {string} question - The poll question.
   * @param {string[]} options - List of poll options.
   * @returns {number} New poll ID.
   * @throws {Error} If a poll with the same question exists.
   */
  createPoll(question, options) {
    const hasDuplicateQuestion = Array.from(this.polls.values()).some(
      (poll) => poll.question === question.trim().toLowerCase(),
    );
    if (hasDuplicateQuestion) {
      throw new Error('A poll with this question already exists');
    }

    const id = this.#generateId();
    const poll = new Poll(id, question, options);
    this.polls.set(id, poll);
    return id;
  }

  /**
   * Retrieves a poll by ID.
   * @param {number} id - Poll ID.
   * @returns {Poll} The poll.
   * @throws {Error} If not found.
   */
  getPoll(id) {
    const poll = this.polls.get(id);
    if (!poll) {
      throw new Error(`Poll not found with id: ${id}`);
    }
    return poll;
  }

  /**
   * Records a vote.
   * @param {number} pollId - Poll ID.
   * @param {string} option - Selected option.
   * @returns {boolean} True if successful.
   */
  vote(pollId, option) {
    const poll = this.getPoll(pollId);
    poll.vote(option);
    return true;
  }

  /**
   * Gets poll results.
   * @param {number} pollId - Poll ID.
   * @returns {Object} Vote counts.
   */
  getResults(pollId) {
    const poll = this.getPoll(pollId);
    return poll.getResults();
  }

  /**
   * Returns all polls.
   * @returns {Poll[]} List of polls.
   */
  getAllPolls() {
    return Array.from(this.polls.values());
  }
}
