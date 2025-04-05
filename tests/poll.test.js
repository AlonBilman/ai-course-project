import { Poll } from '../src/poll.js';

describe('Poll Class Unit Tests', () => {
  describe('Basic Functionality Tests', () => {
    test('should init a poll and check properties', () => {
      // Arrange
      const id = 1;
      const question = 'Test question?';
      const options = ['Option 1', 'Option 2', 'Option 3'];
      // Act
      const poll = new Poll(id, question, options);
      // Assert
      expect(poll.id).toBe(id);
      expect(poll.question).toBe(question.toLowerCase());
      expect(poll.options).toEqual(options.map((opt) => opt.toLowerCase()));
      expect(poll.votes).toEqual({
        'option 1': 0,
        'option 2': 0,
        'option 3': 0,
      });
    });

    test('should record a vote correctly', () => {
      // Arrange
      const poll = new Poll(1, 'Test?', ['A', 'B']);
      // Act
      const votes = poll.vote('A');
      // Assert
      expect(votes).toBe(1);
      expect(poll.votes['a']).toBe(1);
      expect(poll.votes['b']).toBe(0);
    });

    test('should generate correct results format', () => {
      // Arrange
      const poll = new Poll(1, 'Test?', ['A', 'B']);
      poll.vote('A');
      poll.vote('B');
      poll.vote('A');
      // Act
      const results = poll.getResults();
      // Assert
      expect(results).toEqual({
        question: 'test?',
        totalVotes: 3,
        results: [
          { option: 'a', votes: 2 },
          { option: 'b', votes: 1 },
        ],
      });
    });

    test('should handle case insensitive voting and trimming', () => {
      // Arrange
      const poll = new Poll(1, 'Test?', ['Option A', 'Option B']);
      // Act
      poll.vote('OPTION a');
      poll.vote('option a ');
      poll.vote('  Option A');
      // Assert
      expect(poll.votes['option a']).toBe(3);
    });
  });

  describe('Exception Tests - Input Validation', () => {
    test('should throw error for empty question', () => {
      // Act & Assert
      expect(() => new Poll(1, '', ['A', 'B'])).toThrow('Poll question can not be empty');
      expect(() => new Poll(1, '   ', ['A', 'B'])).toThrow('Poll question can not be empty');
    });

    test('should throw error for fewer than 2 options', () => {
      // Act & Assert
      expect(() => new Poll(1, 'Test?', ['A'])).toThrow('Poll must have at least two options');
      expect(() => new Poll(1, 'Test?', [])).toThrow('Poll must have at least two options');
    });

    test('should throw error for non-string options', () => {
      // Act & Assert
      expect(() => new Poll(1, 'Test?', ['A', 123])).toThrow('Poll options must be strings');
    });

    test('should throw error for duplicate options', () => {
      // Act & Assert
      expect(() => new Poll(1, 'Test?', ['A', 'A'])).toThrow('Poll options must be unique');
      expect(() => new Poll(1, 'Test?', ['A', '  A  '])).toThrow(
        'Poll options must be unique (case insensitive)',
      );
      expect(() => new Poll(1, 'Test?', ['A', 'a'])).toThrow(
        'Poll options must be unique (case insensitive)',
      );
    });

    test('should throw error for empty option strings', () => {
      // Act & Assert
      expect(() => new Poll(1, 'Test?', ['A', ''])).toThrow('Poll options can not be empty');
      expect(() => new Poll(1, 'Test?', ['A', '   '])).toThrow('Poll options can not be empty');
    });

    test('should throw error when voting for invalid option', () => {
      // Arrange
      const poll = new Poll(1, 'Test?', ['A', 'B']);
      // Act & Assert
      expect(() => poll.vote('C')).toThrow('Invalid poll option: C');
    });
  });
});
