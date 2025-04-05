/**
 * A poll with options and voting.
 *
 */
export class Poll {
  #id;
  #question;
  #options;
  #votes;

  /**
   * Initializes a new poll.
   * @param {number} id - Poll ID.
   * @param {string} question - Poll question.
   * @param {string[]} options - List of options.
   * @throws {Error} If inputs are invalid.
   */
  constructor(id, question, options) {
    this.#validateInputs(question, options);

    this.#id = id;
    this.#question = question.trim().toLowerCase();
    this.#options = options.map((opt) => opt.trim().toLowerCase());
    this.#votes = {};
    this.#options.forEach((option) => {
      this.#votes[option] = 0;
    });
  }

  // Validates the question and options.
  #validateInputs(question, options) {
    if (!question?.trim()) {
      throw new Error('Poll question can not be empty');
    }

    if (!Array.isArray(options) || options.length < 2) {
      throw new Error('Poll must have at least two options');
    }

    if (!options.every((opt) => typeof opt === 'string')) {
      throw new Error('Poll options must be strings');
    }

    const trimmed = options.map((opt) => opt.trim().toLowerCase());
    if (new Set(trimmed).size !== trimmed.length) {
      throw new Error('Poll options must be unique (case insensitive)');
    }

    if (trimmed.some((opt) => !opt)) {
      throw new Error('Poll options can not be empty');
    }
  }

  /**
   * Gets the poll ID.
   * @returns {number}
   */
  get id() {
    return this.#id;
  }

  /**
   * Gets the poll question.
   * @returns {string}
   */
  get question() {
    return this.#question;
  }

  /**
   * Gets the poll options.
   * @returns {string[]}
   */
  get options() {
    return [...this.#options];
  }

  /**
   * Gets current vote counts.
   * @returns {Object} A copy of the votes object.
   */
  get votes() {
    return { ...this.#votes };
  }

  /**
   * Casts a vote for an option.
   * @param {string} option - Option to vote for.
   * @returns {number} Updated vote count.
   * @throws {Error} If the option is invalid.
   */
  vote(option) {
    const trimmedAndLowerCasedOption = option.trim().toLowerCase();
    if (!this.#options.includes(trimmedAndLowerCasedOption)) {
      throw new Error(`Invalid poll option: ${option}`);
    }
    return ++this.#votes[trimmedAndLowerCasedOption];
  }

  /**
   * Gets poll results summary.
   * @returns {{
   *   question: string,
   *   totalVotes: number,
   *   results: { option: string, votes: number }[]
   * }}
   */
  getResults() {
    const totalVotes = Object.values(this.#votes).reduce((sum, count) => sum + count, 0);
    return {
      question: this.#question,
      totalVotes,
      results: this.#options.map((option) => ({
        option,
        votes: this.#votes[option],
      })),
    };
  }
}
