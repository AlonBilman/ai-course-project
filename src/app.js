import express from 'express';
import userRoutes from './routes/userRoutes.js';
import pollRoutes from './routes/pollRoutes.js'; // We'll create this next
import { BusinessLogicError } from './services/userService.js'; // Import the custom error

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Mount routers
app.use('/users', userRoutes);
app.use('/polls', pollRoutes); // Mount poll routes under /polls

// Basic root route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'PollSystem+ API is running!' });
});

// Centralized Error Handling Middleware
// This should be defined AFTER all other app.use() and routes calls
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err); // Log error for debugging

  if (err instanceof BusinessLogicError) {
    // Handle specific business logic errors
    // You might want more granular checks here based on the error message
    // to return different 4xx status codes (400, 403, 404, 409 etc.)
    if (err.message.includes('not found') || err.message.includes('does not exist')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('not authorized')) {
      return res.status(403).json({ error: err.message });
    }
    if (
      err.message.includes('already exists') ||
      err.message.includes('already taken') ||
      err.message.includes('already voted')
    ) {
      return res.status(400).json({ error: err.message }); // Or 409 Conflict for duplicates
    }
    // Default for other business logic errors
    return res.status(400).json({ error: err.message });
  }

  // Handle other types of errors (e.g., unexpected errors)
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
