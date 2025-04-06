import { Poll } from '../src/poll.js';

describe('Poll Class Unit Tests', () => {
  describe('Basic Functionality Tests', () => {
    test('should init a poll, check properties, and generate correct results format', () => {
      // Arrange
      const id = 1;
      const question = 'Test question?';
      const options = ['Option 1', 'Option 2', 'Option 3'];
      const poll = new Poll(id, question, options);
      // Assert properties
      expect(poll.id).toBe(id);
      expect(poll.question).toBe(question.toLowerCase());
      expect(poll.options).toEqual(options.map((opt) => opt.toLowerCase()));
      expect(poll.votes).toEqual({
        'option 1': 0,
        'option 2': 0,
        'option 3': 0,
      });
      // Act - vote on options
      poll.vote('Option 1');
      poll.vote('Option 2');
      poll.vote('Option 1');
      // Assert results format
      const results = poll.getResults();
      expect(results).toEqual({
        question: 'test question?',
        totalVotes: 3,
        results: [
          { option: 'option 1', votes: 2 },
          { option: 'option 2', votes: 1 },
          { option: 'option 3', votes: 0 },
        ],
      });
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

    test('should validate voting options correctly', () => {
      // Arrange
      const poll = new Poll(1, 'Test?', ['A', 'B']);
      // Act & Assert
      expect(() => poll.vote('C')).toThrow('Invalid poll option: C');
      expect(() => poll.vote(null)).toThrow('Vote option cannot be null or undefined');
      expect(() => poll.vote(undefined)).toThrow('Vote option cannot be null or undefined');
      expect(() => poll.vote(123)).toThrow('Vote option must be a non-empty string');
      expect(() => poll.vote({})).toThrow('Vote option must be a non-empty string');
      expect(() => poll.vote('')).toThrow('Vote option must be a non-empty string');
      expect(poll.vote('  A  ')).toBe(1);
      expect(poll.vote('a')).toBe(2);
    });
  });
});
