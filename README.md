# RecallOps Frontend

RecallOps is an incident monitoring and automated remediation dashboard for
GitHub repositories deployed through Vercel or Render. This folder contains the
React single-page application.

The frontend does not hold provider secrets. It authenticates the user, sends
the resulting RecallOps JWT to the two backend services, and presents
repositories, deployment health, failures, incidents, suggested fixes, and
draft pull requests.

## Main features

- Email/password and GitHub/Firebase authentication
- Guided Vercel and Render connection setup
- GitHub repository discovery and import
- Per-repository monitoring interval controls
- Live deployment health for Vercel and Render resources
- Deployment logs and commit-specific failure history
- Incident memory grouped by repository and commit
- DeepSeek diagnosis and fix summaries
- Explicitly approved draft pull request creation
- On-call handoff and downloadable incident reports
- Account and connected-provider views
- Responsive dashboard, transient notifications, and custom not-found view

## Technology

- React 19
- TypeScript
- Vite
- Firebase Web Authentication
- Recharts
- Lucide icons

## Requirements

- Node.js 20 or newer
- npm
- A running Node authentication backend
- A running Python agent backend
- A Firebase web application with GitHub Authentication enabled

## Environment variables

Copy the example file:

```powershell
Copy-Item .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the Python agent API |
| `VITE_AUTH_URL` | Base URL of the Node authentication/integration API |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | Firebase web application ID |

Local defaults used by the application are:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_AUTH_URL=http://localhost:4000
```

Restart Vite after changing any `VITE_` variable.

## Local development

Install dependencies and start the development server:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

The complete local stack normally runs in three terminals:

```powershell
# frontend/
npm run dev

# node-backend/
npm run dev

# backend/
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

## Authentication flow

1. Firebase completes GitHub sign-in in the browser.
2. The frontend sends the Firebase ID token and GitHub access token to
   `POST /api/auth/firebase` on the Node backend.
3. The Node backend verifies the Firebase token and returns a RecallOps JWT.
4. The frontend sends that JWT as `Authorization: Bearer <token>` to both
   backend services.
5. Provider credentials remain encrypted on the Node backend and are never
   returned to the browser.

In Firebase Authentication, enable the GitHub provider and add every frontend
hostname to **Authorized domains**, including localhost during development and
the production Vercel domain.

## Dashboard pages

| Page | Purpose |
| --- | --- |
| Overview | Monitoring summary, tracked repositories, failures, and recent incidents |
| Repositories | Browse GitHub repositories, import one, inspect activity, and set polling |
| Health | Inspect Vercel and Render resources and start tracking mapped repositories |
| Deployment failures | Review captured failed deployments and build logs |
| Incidents | View diagnosis and remediation history by repository and commit |
| On-call brief | Review open work, recently resolved incidents, and trends |
| Connections | Connect or rotate Vercel/Render credentials and map projects |
| Account | View the signed-in identity and connected provider accounts |

Importing a repository starts monitoring it. A matching accessible Vercel
project or Render service is linked automatically when possible.

## Useful scripts

```powershell
npm run dev       # Start Vite with hot reload
npm run build     # Type-check and create the production bundle
npm run preview   # Serve the production bundle locally
```

Production files are generated in `dist/`.

## Production deployment on Vercel

Use these project settings:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Set the production `VITE_` variables before building. The included
`vercel.json` rewrites application routes to `index.html`, allowing direct
navigation and refreshes inside the SPA.

Current service layout:

- Frontend: `https://imagent-zeta.vercel.app`
- Node API: `https://ima-node-ckgjatf7btgeczgd.canadacentral-01.azurewebsites.net`
- Python API: `https://ima-python-g3dghmfzcxhwfwg2.canadacentral-01.azurewebsites.net`

## Troubleshooting

### Firebase `auth/operation-not-allowed`

Enable GitHub under **Firebase Console > Authentication > Sign-in method**.

### CORS errors

The exact frontend origin must appear in:

- `NODE_CORS_ORIGINS` on the Node backend
- `CORS_ORIGINS` on the Python backend

Do not add a trailing slash to the origin.

### Authentication works on one API but not the other

`AUTH_JWT_SECRET` must have the exact same value in the Node and Python
backends.

### The browser still shows OAuth query parameters

The frontend removes integration callback parameters after reading them. If an
old bundle is cached, redeploy and perform a hard refresh.

### Repositories or deployments are missing

The signed-in GitHub, Vercel, or Render identity must have access to those
resources. Collaborator repositories are shown only when the GitHub token is
authorized to read them.

## Security

- Never place provider tokens, service-account JSON, or backend API keys in
  `VITE_` variables; Vite embeds them in the public browser bundle.
- Commit `.env.example`, not `.env`.
- Treat the Firebase web configuration as public client configuration, but
  protect Firebase Admin credentials on the backend.
