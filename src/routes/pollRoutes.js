import express from 'express';
import * as pollService from '../services/pollService.js';
// No need to import BusinessLogicError here if we always use next(error)

const router = express.Router();

/**
 * Helper function to convert a Poll object's votes Map to a plain object
 * suitable for JSON serialization.
 * @param {object} poll - The poll object potentially containing a votes Map.
 * @returns {object} - The poll object with votes converted to a plain object.
 */
function serializePollVotes(poll) {
  if (poll && poll.votes instanceof Map) {
    return {
      ...poll,
      votes: Object.fromEntries(poll.votes), // Convert Map to object
    };
  }
  return poll; // Return unchanged if no votes map or poll is null/undefined
}

/**
 * Helper function to serialize votes for an array of polls.
 * @param {object[]} polls - Array of poll objects.
 * @returns {object[]} - Array of poll objects with votes converted.
 */
function serializePollVotesArray(polls) {
  return polls.map(serializePollVotes);
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Poll:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the poll
 *         question:
 *           type: string
 *           description: The question asked in the poll
 *         options:
 *           type: array
 *           items:
 *             type: string
 *           description: List of possible answers
 *         creator:
 *           type: string
 *           description: Username of the poll creator
 *         votes:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: Map of username to the index of their chosen option
 *       required:
 *         - id
 *         - question
 *         - options
 *         - creator
 *         - votes
 *     NewPoll:
 *       type: object
 *       properties:
 *         question:
 *           type: string
 *           description: The question for the new poll
 *           example: "What is your favorite color?"
 *         options:
 *           type: array
 *           items:
 *             type: string
 *           description: List of possible answers (at least 2 unique)
 *           example: ["Red", "Blue", "Green"]
 *         creator:
 *           type: string
 *           description: Username of the user creating the poll
 *           example: "alice"
 *       required:
 *         - question
 *         - options
 *         - creator
 *     VoteInput:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: Username of the voter
 *           example: "bob"
 *         optionIndex:
 *           type: integer
 *           description: The 0-based index of the selected option
 *           example: 1
 *       required:
 *         - username
 *         - optionIndex
 *     DeleteRequest:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: Username of the user attempting deletion (must match creator)
 *           example: "alice"
 *       required:
 *         - username
 */

/**
 * @swagger
 * /polls:
 *   post:
 *     summary: Create a new poll
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewPoll'
 *     responses:
 *       201:
 *         description: Poll created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poll'
 *       400:
 *         description: Invalid input (e.g., missing fields, not enough options, non-unique options, creator not found)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       404:
 *         description: Creator user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req, res, next) => {
  const { question, options, creator } = req.body;

  // Basic validation at route level
  if (!question || !options || !creator) {
    return res.status(400).json({ error: 'Missing required fields: question, options, creator.' });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Options must be an array with at least two elements.' });
  }

  try {
    const newPoll = await pollService.createPoll(question, options, creator);
    res.status(201).json(serializePollVotes(newPoll)); // Serialize votes
  } catch (error) {
    next(error); // Pass to centralized error handler
  }
});

/**
 * @swagger
 * /polls:
 *   get:
 *     summary: List all polls or filter by creator
 *     parameters:
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter polls by the username of the creator
 *     responses:
 *       200:
 *         description: A list of polls
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Poll'
 *       404:
 *         description: User specified in createdBy query not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res, next) => {
  const { createdBy } = req.query; // Check for query parameter

  try {
    let polls;
    if (createdBy) {
      polls = await pollService.getPollsByCreator(createdBy);
    } else {
      polls = await pollService.getAllPolls();
    }
    res.status(200).json(serializePollVotesArray(polls)); // Serialize votes for the array
  } catch (error) {
    next(error); // Handle potential errors (like user not found for createdBy)
  }
});

/**
 * @swagger
 * /polls/{id}:
 *   get:
 *     summary: Get a specific poll by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the poll to retrieve
 *     responses:
 *       200:
 *         description: The requested poll object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poll'
 *       404:
 *         description: Poll not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const poll = await pollService.getPollById(id);
    if (!poll) {
      // Explicitly handle not found at the route level for GET by ID
      return res.status(404).json({ error: `Poll with ID "${id}" not found.` });
    }
    res.status(200).json(serializePollVotes(poll)); // Serialize votes
  } catch (error) {
    next(error); // Catch potential unexpected errors
  }
});

/**
 * @swagger
 * /polls/{id}:
 *   delete:
 *     summary: Delete a poll (only creator can delete)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the poll to delete
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteRequest'
 *     responses:
 *       200:
 *         description: Poll deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Poll deleted successfully."
 *       400:
 *         description: Missing username in request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       403:
 *         description: Forbidden - User is not the creator
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       404:
 *         description: Poll not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { username } = req.body; // Username required in body for ownership check

  if (!username) {
    return res
      .status(400)
      .json({ error: 'Username is required in the request body to delete a poll.' });
  }

  try {
    const deleted = await pollService.deletePoll(id, username);
    // pollService.deletePoll throws errors for not found or forbidden, handled by error middleware
    // If it returns successfully (true), send 200 OK
    if (deleted) {
      res.status(200).json({ message: `Poll "${id}" deleted successfully.` });
    } else {
      // Should not happen if service layer throws correctly, but as a fallback:
      res.status(404).json({ error: `Poll with ID "${id}" not found or deletion failed.` });
    }
  } catch (error) {
    next(error); // Pass errors (403, 404) to centralized handler
  }
});

/**
 * @swagger
 * /polls/{id}/vote:
 *   post:
 *     summary: Vote on a poll
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the poll to vote on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VoteInput'
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poll' # Return updated poll
 *       400:
 *         description: Invalid input (missing fields, invalid option index, user already voted)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       404:
 *         description: Poll or User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/:id/vote', async (req, res, next) => {
  const { id } = req.params;
  const { username, optionIndex } = req.body;

  if (!username || optionIndex === undefined) {
    return res.status(400).json({ error: 'Missing required fields: username, optionIndex.' });
  }
  if (typeof optionIndex !== 'number') {
    return res.status(400).json({ error: 'optionIndex must be a number.' });
  }

  try {
    const updatedPoll = await pollService.vote(id, optionIndex, username);
    res.status(200).json(serializePollVotes(updatedPoll)); // Serialize votes
  } catch (error) {
    next(error); // Handle errors (poll/user not found, invalid index, already voted)
  }
});

export default router;
