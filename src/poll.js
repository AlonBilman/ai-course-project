export class Poll {
  #id;
  #question;
  #options;
  #votes;

  /**
   * Initializes a new poll.
   * @param {string|number} id - Poll ID.
   * @param {string} question - Poll question.
   * @param {string[]} options - List of options.
   * @throws {Error} If inputs are invalid.
   */
  constructor(id, question, options) {
    this.#validateInputs(question, options);

    this.#id = id;
    this.#question = question.trim();
    this.#options = options.map((opt) => opt.trim());
    this.#votes = {};
    this.#options.forEach((option) => {
      this.#votes[option] = 0;
    });
  }

  // Validates question and options
  #validateInputs(question, options) {
    if (!question?.trim()) {
      throw new Error('Poll question cannot be empty');
    }

    if (!Array.isArray(options) || options.length < 2) {
      throw new Error('Poll must have at least two options');
    }

    if (!options.every((opt) => typeof opt === 'string')) {
      throw new Error('Poll options must be strings');
    }

    const trimmed = options.map((opt) => opt.trim());
    if (new Set(trimmed).size !== trimmed.length) {
      throw new Error('Poll options must be unique');
    }

    if (trimmed.some((opt) => !opt)) {
      throw new Error('Poll options cannot be empty');
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
   * Casts a vote for an option.
   * @param {string} option - Option to vote for.
   * @returns {number} Updated vote count.
   * @throws {Error} If option is invalid.
   */
  vote(option) {
    if (!this.#options.includes(option)) {
      throw new Error(`Invalid poll option: ${option}`);
    }
    return ++this.#votes[option];
  }

  /**
   * Returns poll results.
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
