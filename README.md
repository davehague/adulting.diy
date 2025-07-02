# adulting.diy Task Management System

This project is a task management system built with Nuxt 3, Vue.js, Prisma, and CockroachDB. It's designed to help households manage recurring and non-recurring tasks efficiently.

## Features

- Household-based multi-tenancy
- Recurring and non-recurring task management (based on schedules)
- Task occurrences tracking (completion, skipping, comments)
- Custom categorization system for tasks
- Flexible notification system (planned)
- Task pausing and soft deletion
- User authentication (Email/Password)
- Persistent authentication state

## Tech Stack

- **Framework:** [Nuxt 3](https://nuxt.com/)
- **UI Library:** [Vue.js](https://vuejs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **State Management:** [Pinia](https://pinia.vuejs.org/)
- **Database ORM:** [Prisma](https://www.prisma.io/)
- **Database:** [CockroachDB](https://www.cockroachlabs.com/) (compatible with PostgreSQL)
- **Icons:** [Lucide Vue Next](https://lucide.dev/)

## Prerequisites

- Node.js (version compatible with Nuxt 3 - check `.nvmrc` or `package.json` engines)
- npm or yarn or pnpm
- Access to a CockroachDB instance (local or cloud)

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd adulting-diy
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or yarn install or pnpm install
    ```

3.  **Set up Environment Variables:**

    - Create a `.env` file in the project root.
    - Add your CockroachDB connection string:
      ```dotenv
      DATABASE_URL="postgresql://user:password@host:port/adulting?sslmode=verify-full"
      ```
      _(Replace with your actual connection details. Ensure the database name is `adulting` or update the connection string accordingly)_

4.  **Set up the Database Schema:**

    - Run the Prisma migrations to create the necessary tables:
      ```bash
      npx prisma migrate dev
      ```
      _(This will apply existing migrations and prompt you to create new ones if you change `prisma/schema.prisma`)_

5.  **(Optional) Seed Initial Data:**

    - If needed, run the seed script to populate the database with initial data (e.g., default categories):
      ```bash
      node scripts/seed.js
      ```

6.  **Run the Development Server:**

    - The project might require HTTPS for local development (check `nuxt.config.ts`). If so, you may need to generate local certificates using `mkcert`:
      ```bash
      # Install mkcert (e.g., brew install mkcert on macOS)
      mkcert -install
      mkcert localhost
      ```
      _(The `nuxt.config.ts` should be pre-configured to use `localhost-key.pem` and `localhost.pem` if HTTPS is enabled)_
    - Start the Nuxt development server:
      ```bash
      npm run dev
      # or yarn dev or pnpm dev
      ```

7.  Open your browser to the specified local address (e.g., `https://localhost:3000`).

## Styling with Tailwind CSS

This project uses Tailwind CSS for styling. Modify `tailwind.config.ts` for customizations.

## Icons with Lucide Vue Next

The project includes [Lucide](https://lucide.dev/) for icons.

## Favicon

To change the title and favicon, update `nuxt.config.ts`. Create your own favicon at https://favicon.io/ and replace the files in the `public` folder.

## Testing

The project includes a comprehensive testing framework built with Vitest:

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui
```

### Test Structure

- **Unit Tests**: Core business logic (scheduling, notifications)
- **Integration Tests**: API endpoints and service interactions
- **Fixtures**: Shared test data and mocks

### Coverage Areas

- ✅ Task scheduling algorithms (all 6 recurrence patterns)
- ✅ Notification preference logic
- ✅ Date calculations and edge cases
- ✅ Scheduler integration and horizon calculations
- ✅ Business rule validation

The test suite includes 41+ tests covering critical functionality and edge cases to ensure reliability.

## Environment Variables

Ensure your `.env` file contains the necessary variables:

```dotenv
# Example .env file
DATABASE_URL="postgresql://user:password@host:port/adulting?sslmode=verify-full"

# Google OAuth (for authentication)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email service (Mailjet for notifications)
MAILJET_API_KEY="your-mailjet-api-key"
MAILJET_SECRET_KEY="your-mailjet-secret-key"
MAILJET_FROM_EMAIL="noreply@yourdomain.com"
```
