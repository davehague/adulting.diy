# adulting.diy

A household management app built with Nuxt 3, Vue.js, Prisma, and CockroachDB. It helps households manage recurring and one-time tasks, keep a directory of contractors, and track home projects.

## Features

- Household-based multi-tenancy
- Recurring and non-recurring task management (based on schedules)
- Task occurrences tracking (completion, skipping, comments)
- Custom categorization system for tasks
- Flexible notification system (email + Slack) with configurable reminders
- Task pausing and soft deletion
- Provider directory: contractors and service providers with ratings, notes, neighbor recommendations and task links
- Home projects with private photos, step checklists, linked providers with a per-project status, AI provider suggestions, an AI DIY plan and a per-project chat that can read the photos and search the web (for households switched on), and next steps on the dashboard
- User authentication (Google OAuth)
- Persistent authentication state

## Tech Stack

- **Framework:** [Nuxt 3](https://nuxt.com/)
- **UI Library:** [Vue.js](https://vuejs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **State Management:** [Pinia](https://pinia.vuejs.org/)
- **Database ORM:** [Prisma](https://www.prisma.io/)
- **Database:** [CockroachDB](https://www.cockroachlabs.com/) (compatible with PostgreSQL)
- **Storage:** [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store, project photos)
- **AI:** [Ollama Cloud](https://ollama.com/) for provider suggestions, DIY plans and the project chat (plain HTTP, no SDK)
- **Notifications:** [Mailjet](https://www.mailjet.com/) email and Slack incoming webhooks
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

```bash
npm run test              # Run all tests (excludes e2e)
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

See [docs/tech/testing.md](docs/tech/testing.md) for full details on test structure and coverage.

## Documentation

Project documentation is organized in `docs/`:

| Location | Audience | What it covers |
|----------|----------|----------------|
| [docs/functionality/](docs/functionality/) | Product | One doc per capability, no code: [tasks](docs/functionality/task-management.md), [notifications and reminders](docs/functionality/notifications-and-reminders.md), [households](docs/functionality/household-management.md), [providers](docs/functionality/providers.md), [projects](docs/functionality/projects.md) |
| [docs/functionality/changelog.md](docs/functionality/changelog.md) | Product | What changed, from the user's point of view |
| [docs/tech/architecture.md](docs/tech/architecture.md) | Developers | System map: structure, request flow, auth, data model, integrations |
| [docs/tech/](docs/tech/) | Developers | Subsystem docs: [API reference](docs/tech/api-endpoints.md), [task scheduling](docs/tech/task-scheduling.md), [notification system](docs/tech/notification-system.md), [provider ingest](docs/tech/provider-ingest.md), [testing](docs/tech/testing.md), [dev login bypass](docs/tech/dev-login-bypass.md) |
| [docs/adrs/](docs/adrs/) | Developers | Architectural Decision Records |
| [docs/brand.md](docs/brand.md) | Everyone | Colors, typography, component patterns |
| [docs/next-up.md](docs/next-up.md) | Everyone | Roadmap and deferred work |

## Development Features

### Development Login Bypass

For faster development, you can bypass Google OAuth and switch between users instantly:

1. Enable the feature by setting `DEV_LOGIN_BYPASS=true` in your `.env` file
2. Run the development server: `npm run dev`
3. Look for the red "🧪 Dev" button in the top-right corner
4. Click to see all users in your database and switch between them instantly

**Security Note**: This feature ONLY works in development mode and automatically disables in production.

## Environment Variables

Ensure your `.env` file contains the necessary variables:

```dotenv
# Example .env file
DATABASE_URL="postgresql://user:password@host:port/adulting?sslmode=verify-full"

# Google Sign-In (for authentication)
NUXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id"

# Email service (Mailjet for notifications)
MJ_APIKEY_PUBLIC="your-mailjet-api-key"
MJ_APIKEY_PRIVATE="your-mailjet-secret-key"

# Vercel Blob (private store for project photos; shared by local dev and production)
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# AI features: provider suggestions, DIY plans, project chat (optional; all off without the key and the household list)
OLLAMA_API_KEY="your-ollama-cloud-key"
AI_SUGGESTIONS_HOUSEHOLD_IDS="household-id-1,household-id-2"  # Households allowed to use the AI features
AI_SUGGESTIONS_MODEL="glm-5.3-flash"   # Optional; this is the default for suggestions and plans
AI_CHAT_MODEL="glm-5.3-flash"          # Optional; this is the default for the chat (must read images)

# Base URL used in notification links (defaults to https://adulting.diy)
APP_URL="https://localhost:3000"

# Vercel Cron
CRON_SECRET="your-random-secret"        # Must match Vercel project settings

# Development features (optional)
DEV_LOGIN_BYPASS=true  # Enable development login bypass
```
