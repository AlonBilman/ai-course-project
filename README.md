# Poll Management System

In-memory JavaScript polling system.

---

## Overview

This backend-only polling system offers:

- **Poll creation** with custom questions and multiple options
- **Secure voting** with robust validation
- **Result retrieval** with vote counts and statistics

No database, no persistence — pure in-memory logic using modern JavaScript best practices.

---

### Error Handling

The system validates all inputs and throws appropriate errors for:

- Duplicate poll questions
- Invalid poll IDs
- Invalid voting options
- Insufficient options (minimum 2 required)

---

## Design

| Feature             | Implementation Details                               |
| ------------------- | ---------------------------------------------------- |
| **Storage**         | In-memory only (no persistence layer)                |
| **Poll Questions**  | Must be unique (case-insensitive)                    |
| **Poll Options**    | Minimum of two unique options required               |
| **Input Handling**  | Case-insensitive with whitespace trimming            |
| **Data Protection** | Immutable return values to prevent external mutation |
| **Poll Lifecycle**  | No expiration or deletion functionality              |

---

## Development Tools

- **Prettier** – Used for consistent code formatting
- **Jest** – Test framework for checking both normal and edge-case scenarios
