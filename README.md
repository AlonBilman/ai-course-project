# PollSystem+ (EX2.2)

A multi-user, Express-based polling server with layered logic, modularity, and asynchronous operations. Built with Node.js, Express, and Jest.

---

## Team Info

- **Adi Karif:** 208295576
- **Yakir Twil:** 313528168
- **Alon Bilman:** 211684535
- **Ahmad Danaf:** 211787833

---

## Design & Structure

This application follows a 3-layered architecture:

1.  **Request Handling Layer (`src/routes`)**: Handles incoming HTTP requests using Express, performs basic input validation, orchestrates calls to the business logic layer, and formats JSON responses with appropriate RESTful status codes.
2.  **Business Logic Layer (`src/services`)**: Contains the core application logic, including user creation rules (unique username), poll creation (UUID generation), voting rules (no duplicates per user/poll), and ownership checks for deletion. This layer interacts with the storage layer asynchronously and throws `BusinessLogicError` for validation failures.
3.  **Storage Layer (`src/storage`)**: Provides an asynchronous interface for data persistence. The current implementation (`memoryStorage.js`) uses in-memory `Map` objects. All methods return Promises to simulate real database interactions.

---

## Design Assumptions & Edge Cases

- **Users**:
  - Usernames are unique strings. Case-sensitivity depends on the underlying storage (currently case-sensitive Map keys). Whitespace is trimmed.
  - Only user creation is supported. No update/delete/listing of users via API.
  - No authentication/authorization beyond checking username for poll deletion.
- **Polls**:
  - Poll IDs are generated server-side using UUID v4.
  - Polls require a question (non-empty string) and at least two unique, non-empty options (strings).
  - Polls do not expire.
  - Only the creator (matched by username string) can delete their poll.
- **Voting**:
  - Users vote by providing their username and the 0-based index of their chosen option.
  - A user can only vote once per poll. Re-votes result in a 400 error.
  - Votes cannot be changed once cast.
  - Both the user and the poll must exist for a vote to be valid.
  - The option index must be valid for the specific poll.
- **Error Handling**:
  - Uses standard HTTP status codes (200, 201, 400, 403, 404, 500).
  - Returns JSON error objects: `{ "error": "Error message description" }`.
  - `BusinessLogicError` from the service layer is mapped to appropriate 4xx codes in the central error handler (`src/app.js`).

---

## API Summary

**Base URL:** (Provided when server starts, e.g., `http://localhost:3000`)

**Common Responses:**

- `400 Bad Request`: Invalid input, validation error (e.g., duplicate username, already voted, invalid option).
- `403 Forbidden`: Action not allowed (e.g., deleting poll not owned by user).
- `404 Not Found`: Resource not found (e.g., user, poll).
- `500 Internal Server Error`: Unexpected server error.

---

### User Endpoints

**1. Create User**

- **Endpoint:** `POST /users`
- **Request Body:** `application/json`
  ```json
  {
    "username": "new_user"
  }
  ```
- **Success Response (201 Created):** `application/json`
  ```json
  {
    "username": "new_user"
  }
  ```
- **Error Responses:** 400 (duplicate/invalid username)

**2. List Polls Created by User**

- **Endpoint:** `GET /users/:username/polls`
- **URL Parameter:** `username` (string)
- **Success Response (200 OK):** `application/json` - Array of Poll objects created by the user.
  ```json
  [
    {
      "id": "uuid-string-1",
      "question": "...",
      "options": ["...", "..."],
      "creator": "username",
      "votes": { "voter_username": 0 }
    }
    // ... more polls
  ]
  ```
- **Error Responses:** 404 (user not found)

**3. List Polls Voted In by User**

- **Endpoint:** `GET /users/:username/votes`
- **URL Parameter:** `username` (string)
- **Success Response (200 OK):** `application/json` - Array of Poll objects the user has voted in.
  ```json
  [
    {
      "id": "uuid-string-2",
      "question": "...",
      "options": ["...", "..."],
      "creator": "other_user",
      "votes": { "username": 1, "another_voter": 0 }
    }
    // ... more polls
  ]
  ```
- **Error Responses:** 404 (user not found)

---

### Poll Endpoints

**1. Create Poll**

- **Endpoint:** `POST /polls`
- **Request Body:** `application/json`
  ```json
  {
    "question": "Favorite Drink?",
    "options": ["Coffee", "Tea", "Water"],
    "creator": "existing_user"
  }
  ```
- **Success Response (201 Created):** `application/json` - The newly created Poll object.
  ```json
  {
    "id": "new-uuid-string",
    "question": "Favorite Drink?",
    "options": ["Coffee", "Tea", "Water"],
    "creator": "existing_user",
    "votes": {} // Initially empty
  }
  ```
- **Error Responses:** 400 (invalid input, <2 options, non-unique options), 404 (creator user not found)

**2. List Polls**

- **Endpoint:** `GET /polls`
- **Query Parameter (Optional):** `createdBy` (string, username) - Filters polls by creator.
- **Success Response (200 OK):** `application/json` - Array of all Poll objects, or filtered by creator if query param is used.
  ```json
  [
    // ... Poll objects
  ]
  ```
- **Error Responses:** 404 (user specified in `createdBy` not found)

**3. Get Specific Poll**

- **Endpoint:** `GET /polls/:id`
- **URL Parameter:** `id` (string, UUID)
- **Success Response (200 OK):** `application/json` - The requested Poll object.
  ```json
  {
    "id": "uuid-string-requested",
    "question": "...",
    "options": ["...", "..."],
    "creator": "...",
    "votes": { ... }
  }
  ```
- **Error Responses:** 404 (poll not found)

**4. Delete Poll**

- **Endpoint:** `DELETE /polls/:id`
- **URL Parameter:** `id` (string, UUID)
- **Request Body:** `application/json` - Requires username for ownership check.
  ```json
  {
    "username": "poll_creator_username"
  }
  ```
- **Success Response (200 OK):** `application/json`
  ```json
  {
    "message": "Poll \"uuid-string-deleted\" deleted successfully."
  }
  ```
- **Error Responses:** 400 (username missing in body), 403 (user is not creator), 404 (poll not found)

**5. Vote on Poll**

- **Endpoint:** `POST /polls/:id/vote`
- **URL Parameter:** `id` (string, UUID)
- **Request Body:** `application/json`
  ```json
  {
    "username": "voter_username",
    "optionIndex": 1 // 0-based index
  }
  ```
- **Success Response (200 OK):** `application/json` - The updated Poll object with the new vote.
  ```json
  {
    "id": "uuid-string-voted-on",
    "question": "...",
    "options": ["...", "..."],
    "creator": "...",
    "votes": { "voter_username": 1, ... }
  }
  ```
- **Error Responses:** 400 (invalid input, invalid index, already voted), 404 (poll or user not found)

---

## Interface Contracts

### Business Logic Layer (`src/services`)

- **`userService.js`**
  - `createUser(username: string): Promise<{username: string}>`
  - `findUser(username: string): Promise<{username: string} | undefined>`
  - `BusinessLogicError` (Custom Error Class)
- **`pollService.js`**
  - `createPoll(question: string, options: string[], creatorUsername: string): Promise<Poll>`
  - `deletePoll(pollId: string, requestingUsername: string): Promise<boolean>`
  - `vote(pollId: string, optionIndex: number, username: string): Promise<Poll>`
  - `getPollById(pollId: string): Promise<Poll | undefined>`
  - `getAllPolls(): Promise<Poll[]>`
  - `getPollsByCreator(username: string): Promise<Poll[]>`
  - `getPollsVotedInByUser(username: string): Promise<Poll[]>`

_(Where `Poll` is an object `{ id: string, question: string, options: string[], creator: string, votes: Map<string, number> }`)_

### Storage Layer (`src/storage/memoryStorage.js`)

- `findUserByUsername(username: string): Promise<{username: string} | undefined>`
- `createUser(username: string): Promise<{username: string}>`
- `findPollById(pollId: string): Promise<Poll | undefined>`
- `createPoll(pollData: Poll): Promise<Poll>`
- `updatePoll(pollId: string, updatedPollData: Partial<Poll>): Promise<Poll>`
- `deletePoll(pollId: string): Promise<boolean>`
- `getAllPolls(): Promise<Poll[]>`
- `findPollsByCreator(username: string): Promise<Poll[]>`
- `findPollsVotedInByUser(username: string): Promise<Poll[]>`
- `clearStorage(): Promise<void>`

---

## Testing

- **Unit Tests (`/tests/*.test.js` excluding `e2e.test.js`)**: Use Jest to test the business logic layer (`userService.js`, `pollService.js`) in isolation. Mocks the storage layer implicitly via `memoryStorage.js`. Uses `clearStorage` before each test. Run with `npm test`.
- **End-to-End Tests (`/tests/e2e.test.js`)**: Use Jest and `supertest` to test the full application lifecycle via HTTP requests. Starts the server using `start()` and stops it using `stop()`. Uses `clearStorage` before each test. All E2E tests are in one file to run sequentially. Run with `npm test`.

---

## Team Retrospective

- **Collaboration Reflections:**

  Our team had two main meetings – one on Discord and one in person. We used GitHub Copilot to help us write the assignment more efficiently, and we conducted a code review to ensure quality and consistency.

- **Lessons Learned on AI Usage:**

  At first, we tried using ChatGPT by sending it the full assignment, but it struggled to integrate the new requirements with our previous exercise. When we switched to GitHub Copilot, it was much better at understanding the context and building on top of our existing code. One of the main challenges was that Copilot sometimes generated overly complex designs, so we had to simplify and refactor parts of it. Initially, we planned to divide the work among team members, but we realized it was more efficient to use Copilot for the core implementation and then focus on reviewing, correcting, and redesigning its output collaboratively. This approach boosted our productivity and helped us learn by analyzing and improving Copilot's suggestions.

---

## Development Tools

- **Node.js** (Runtime)
- **Express.js** (Web Framework)
- **uuid** (Generating Poll IDs)
- **Jest** (Testing Framework)
- **supertest** (HTTP Assertion Library for E2E tests)
- **Prettier** (Code Formatter - run with `npm run format`)
- **nodemon** (Optional: for auto-restarting server during development)
