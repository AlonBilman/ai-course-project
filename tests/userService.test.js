import { createUser, findUser, BusinessLogicError } from '../src/services/userService.js';
import * as storage from '../src/storage/memoryStorage.js';

// Clear storage before each test to ensure a clean state
beforeEach(async () => {
  await storage.clearStorage();
});

describe('User Service', () => {
  describe('createUser', () => {
    test('should create a user successfully', async () => {
      const username = 'testUser';
      const user = await createUser(username);

      expect(user).toBeDefined();
      expect(user.username).toBe(username);

      // Verify user was actually stored
      const storedUser = await storage.findUserByUsername(username);
      expect(storedUser).toEqual(user);
    });

    test('should trim whitespace from username', async () => {
      const username = '  spaceUser  ';
      const expectedUsername = 'spaceUser';
      const user = await createUser(username);

      expect(user.username).toBe(expectedUsername);

      // Verify user was stored with trimmed username
      const storedUser = await storage.findUserByUsername(expectedUsername);
      expect(storedUser).toBeDefined();
      expect(storedUser.username).toBe(expectedUsername);
    });

    test('should throw BusinessLogicError for duplicate username', async () => {
      const username = 'duplicate';
      await createUser(username); // Create the user first

      // Attempt to create the same user again
      await expect(createUser(username)).rejects.toThrow(BusinessLogicError);
      await expect(createUser(username)).rejects.toThrow(
        `Username "${username}" is already taken.`,
      );
    });

    test('should throw BusinessLogicError for empty username', async () => {
      await expect(createUser('')).rejects.toThrow(BusinessLogicError);
      await expect(createUser('')).rejects.toThrow('Username cannot be empty.');
    });

    test('should throw BusinessLogicError for whitespace-only username', async () => {
      await expect(createUser('   ')).rejects.toThrow(BusinessLogicError);
      await expect(createUser('   ')).rejects.toThrow('Username cannot be empty.');
    });

    test('should throw BusinessLogicError for non-string username', async () => {
      await expect(createUser(null)).rejects.toThrow(BusinessLogicError);
      await expect(createUser(undefined)).rejects.toThrow(BusinessLogicError);
      await expect(createUser(123)).rejects.toThrow(BusinessLogicError);
      await expect(createUser({})).rejects.toThrow(BusinessLogicError);
    });
  });

  describe('findUser', () => {
    test('should find an existing user', async () => {
      const username = 'findme';
      await createUser(username); // Create user first

      const foundUser = await findUser(username);
      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(username);
    });

    test('should return undefined for a non-existent user', async () => {
      const foundUser = await findUser('nonexistent');
      expect(foundUser).toBeUndefined();
    });
  });
});
