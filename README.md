# Fixie

Fixie is an autonomous dead link fixer for GitHub repositories. It scans markdown files within a repository, identifies broken hyperlinks, replaces them with active snapshots from the Wayback Machine (Archive.org), and automatically opens a pull request with the fixes.

## How It Works

1. **Submission**: A user submits a public GitHub repository URL on the dashboard.
2. **Queueing**: The request is added to a database-backed queue to process sequentially, avoiding rate limits.
3. **Execution**:
   - The bot forks the repository.
   - It recursively scans all markdown files for links.
   - It checks if the links are dead and fetches the closest archive snapshot.
   - It commits the changes to a new branch on the fork and creates a pull request to the original repository.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# GitHub Personal Access Token (PAT) for the bot account
GITHUB_BOT_TOKEN="your_github_pat"

# Secret key to secure the cron route from unauthorized access
CRON_SECRET="your_secure_cron_secret"

# Local SQLite database url
DATABASE_URL="file:./dev.db"

# Turso serverless SQLite configuration (optional for production deployment)
TURSO_DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="your_turso_auth_token"
```

## Getting Started

First, install the dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Create database tables:
- For local development: `npx prisma db push`
- For Turso: `node init-turso.mjs`

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

You can deploy the application on Vercel. 
- Ensure all environment variables are added in the Vercel project settings.
- To run the queue processing periodically, configure an external cron service (like cron-job.org) to ping `https://your-domain.vercel.app/api/process-queue` with the header `Authorization: Bearer <your_cron_secret>`.

This project is licensed under the terms of the MIT License. See the [LICENSE](LICENSE) file for details.
