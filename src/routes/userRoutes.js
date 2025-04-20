import express from 'express';
import * as userService from '../services/userService.js';
import * as pollService from '../services/pollService.js'; // Needed for user-related poll listings
import { BusinessLogicError } from '../services/userService.js'; // Import the custom error

const router = express.Router();

// Re-use or import the serialization helper functions
// For simplicity, duplicating the array helper here. Ideally, place in a shared utils file.
function serializePollVotesArray(polls) {
  return polls.map((poll) => {
    if (poll && poll.votes instanceof Map) {
      return {
        ...poll,
        votes: Object.fromEntries(poll.votes),
      };
    }
    return poll;
  });
}

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The desired username (must be unique)
 *                 example: 'john_doe'
 *             required:
 *               - username
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                   example: 'john_doe'
 *       400:
 *         description: Invalid input or username already taken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Username "john_doe" is already taken.'
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req, res, next) => {
  const { username } = req.body;

  if (!username) {
    // Basic input validation at route level
    return res.status(400).json({ error: 'Username is required in the request body.' });
  }

  try {
    const newUser = await userService.createUser(username);
    // Use 201 Created for successful resource creation
    res.status(201).json(newUser);
  } catch (error) {
    // Pass error to the centralized error handler
    next(error);
  }
});

/**
 * @swagger
 * /users/{username}/polls:
 *   get:
 *     summary: List polls created by a specific user
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: The username of the poll creator
 *     responses:
 *       200:
 *         description: A list of polls created by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Poll' # Assuming you define Poll schema elsewhere for Swagger
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'User "unknown_user" not found.'
 *       500:
 *         description: Internal server error
 */
router.get('/:username/polls', async (req, res, next) => {
  const { username } = req.params;
  try {
    const polls = await pollService.getPollsByCreator(username);
    res.status(200).json(serializePollVotesArray(polls)); // Serialize votes
  } catch (error) {
    next(error); // Let centralized handler manage errors (like user not found -> 404)
  }
});

/**
 * @swagger
 * /users/{username}/votes:
 *   get:
 *     summary: List polls a specific user has voted in
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: The username of the voter
 *     responses:
 *       200:
 *         description: A list of polls the user has voted in
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Poll' # Assuming you define Poll schema elsewhere for Swagger
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'User "unknown_user" not found.'
 *       500:
 *         description: Internal server error
 */
router.get('/:username/votes', async (req, res, next) => {
  const { username } = req.params;
  try {
    const polls = await pollService.getPollsVotedInByUser(username);
    res.status(200).json(serializePollVotesArray(polls)); // Serialize votes
  } catch (error) {
    next(error); // Let centralized handler manage errors (like user not found -> 404)
  }
});

export default router;
