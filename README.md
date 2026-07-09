# API Gateway Dashboard

A full-stack API Gateway management dashboard built with React, Node.js, and Express.
The project provides a clean admin interface for managing backend services, gateway routes, authentication, API keys, rate limits, cache rules, real-time request metrics, and runtime logs.

## LOGIN WITH : user - Admin@example.com/password : Admin!123

The app includes two modes:

* **Demo Mode** — simulated gateway traffic and UI preview data.
* **Real Gateway Mode** — connects to the actual backend API and displays live runtime data.

---

## Features

### Dashboard Overview

The main dashboard gives a quick view of the API gateway runtime:

* Total gateway requests
* Average response time
* Success rate
* Error rate
* Traffic overview chart
* Service health status
* Recent requests
* Top routes by request volume

---

### Services Management

The Services page allows the admin to register backend services that the gateway can forward requests to.

Each service includes:

* Service name
* Service base URL
* Request count
* Error count
* Average latency
* Health status

Example service:

```json
{
  "name": "User Service",
  "url": "https://user-service.example.com"
}
```

---

### Routes Management

The Routes page allows the admin to create gateway routes that forward traffic to registered backend services.

Each route supports:

* Route path
* Linked backend service
* HTTP methods
* Authentication requirement
* Runtime request tracking
* Average latency
* Error tracking

Example route:

```json
{
  "path": "/api/users/*",
  "service": "user-service",
  "methods": ["GET", "POST"],
  "auth": true
}
```

Gateway routes are accessed through:

```txt
/gateway/your-forwarded-path
```

---

### Authentication

The real gateway includes protected admin login using backend environment credentials.

Supported authentication methods include:

* Admin JWT login
* Bearer token authorization
* API key authentication for protected gateway routes

Admin credentials are configured through environment variables.

---

### API Keys

The Authentication tab allows the admin to generate and delete API keys.

API keys are securely handled by the backend:

* Raw API key is shown only once after creation
* Stored version is hashed
* Dashboard only displays masked keys
* Tracks last used time
* Tracks request count

API keys can be used by clients through the header:

```txt
X-API-Key: your_api_key_here
```

---

### Rate Limits

The Rate Limits page allows the admin to create and remove rate limit rules for gateway routes.

Each rate limit rule includes:

* Route
* Rule name
* Maximum requests
* Time window in seconds
* Current usage
* Status

Example:

```json
{
  "routeId": "route-id",
  "name": "User route limit",
  "maxRequests": 60,
  "windowSeconds": 60
}
```

---

### Cache Rules

The Cache page allows the admin to create and remove real cache rules for GET routes.

Each cache rule includes:

* Route
* Rule name
* TTL in seconds
* Cache type: public or private
* Active cache entries
* Cache size
* Rule status

The cache dashboard also displays real runtime metrics:

* Total cache size
* Cache hit rate
* Average TTL

Only `GET` routes can be cached.

Example:

```json
{
  "routeId": "route-id",
  "name": "Search cache",
  "ttlSeconds": 300,
  "type": "public"
}
```

---

### Logs

The Logs page displays real backend runtime logs.

Logs are generated when the gateway performs important actions such as:

* Admin login
* Service creation
* Route creation
* API key creation
* Rate limit creation
* Cache rule creation
* Gateway request errors
* Gateway request events

Each log entry includes:

* Time
* Log level
* Service/source
* Message
* Metadata where available

---

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Chart.js
* Lucide React icons

### Backend

* Node.js
* Express.js
* JSON Web Tokens
* File-based JSON config storage
* Native Node.js crypto module
* Express middleware

---

## Project Structure

```txt
project-root/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── data/
│       └── gateway-config.json
│
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── README.md
└── .gitignore
```

Your exact structure may differ depending on whether you keep frontend and backend in separate folders or in one combined project.

---

## Environment Variables

Create a backend environment file:

```env
PORT=5000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=1h
CORS_ORIGIN=http://localhost:5173
GATEWAY_CONFIG_PATH=./data/gateway-config.json
```

Create a frontend environment file:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

For Render deployment, the frontend value should point to your hosted backend:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com/api
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

---

## Running Locally

Start the backend:

```bash
cd backend
npm run dev
```

The backend should run on:

```txt
http://localhost:5000
```

Start the frontend:

```bash
cd frontend
npm run dev
```

The frontend should run on:

```txt
http://localhost:5173
```

---

## Backend Scripts

Recommended backend scripts:

```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

---

## Frontend Scripts

Recommended frontend scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## API Overview

### Auth

```txt
POST /api/auth/login
GET  /api/auth/me
```

### Gateway State

```txt
GET /api/gateway/state
```

### Services

```txt
GET  /api/services
POST /api/services
```

### Routes

```txt
GET  /api/routes
POST /api/routes
```

### API Keys

```txt
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys/:id
```

### Rate Limits

```txt
GET    /api/rate-limits
POST   /api/rate-limits
DELETE /api/rate-limits/:id
```

### Cache Rules

```txt
GET    /api/cache-rules
POST   /api/cache-rules
DELETE /api/cache-rules/:id
```

### Gateway Proxy

```txt
/gateway/*
```

---

## How Real Gateway Routing Works

A route is created with a wildcard path such as:

```txt
/api/users/*
```

When a request comes into the gateway through:

```txt
/gateway/api/users/profile
```

The gateway matches the route prefix and forwards the remaining path to the linked backend service.

For example, if the service URL is:

```txt
https://user-service.example.com
```

Then:

```txt
/gateway/api/users/profile
```

forwards to:

```txt
https://user-service.example.com/profile
```

---

## Security Notes

The project includes several security-conscious choices:

* Admin login is protected with JWT
* JWT secret is stored in environment variables
* API keys are hashed before storage
* Raw API keys are only shown once
* CORS origins are controlled by environment variables
* Protected routes can require Bearer token or API key
* Rate limits are applied per client/IP or API key
* Sensitive `.env` files should never be committed

---

## .gitignore

Use this `.gitignore` before pushing to GitHub:

```gitignore
node_modules
.env
.env.local
.env.backend
dist
build
.DS_Store
data/gateway-config.json
```

If you want to commit an example config, create:

```txt
.env.example
```

and:

```txt
gateway-config.example.json
```

instead of pushing real secrets or runtime data.

---

## Deployment on Render

This project should be deployed as two Render services:

1. Backend as a **Web Service**
2. Frontend as a **Static Site**

---

### Backend Deployment

Create a new Render Web Service.

Use these settings:

```txt
Build Command:
npm install

Start Command:
npm start
```

Add environment variables in Render:

```env
PORT=10000
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRES_IN=1h
CORS_ORIGIN=https://your-frontend-service.onrender.com
GATEWAY_CONFIG_PATH=./data/gateway-config.json
```

Render automatically provides the correct port through `process.env.PORT`, so the backend should use:

```js
const port = Number(process.env.PORT || 5000);
```

---

### Frontend Deployment

Create a new Render Static Site.

Use these settings:

```txt
Build Command:
npm install && npm run build

Publish Directory:
dist
```

Add this frontend environment variable:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com/api
```

After changing frontend environment variables on Render, redeploy the frontend.

---

## Important Deployment Notes

The backend currently uses file-based JSON storage for gateway configuration.

That means:

* It works fine for demos and small projects
* It is simple and easy to understand
* It does not require a database
* But on free hosting platforms, file changes may not be permanent after redeploys

For production, it is better to move the config storage to a real database such as:

* PostgreSQL
* MongoDB
* Redis
* SQLite with persistent disk
* Render Disk

---

## Recommended Production Improvements

Future improvements can include:

* PostgreSQL database storage
* Persistent Render Disk
* Route editing
* Service editing
* Better health checks
* Redis-backed rate limiting
* Redis-backed response cache
* Request analytics by day/week/month
* Role-based admin users
* WebSocket live logs
* Better gateway retry logic
* Request body size limits per route
* Export logs as CSV
* Export gateway reports as PDF

---

## Screenshots

Dashboard 
<img width="1366" height="768" alt="Screenshot (219)" src="https://github.com/user-attachments/assets/256dae2e-8ad4-4ea8-8a64-54c7d76b806b" />
Cache Management
<img width="1366" height="768" alt="Screenshot (223)" src="https://github.com/user-attachments/assets/da719437-ebcc-4919-b1fa-9497bcf09a5f" />
service/routes
<img width="1366" height="768" alt="Screenshot (222)" src="https://github.com/user-attachments/assets/1ca7ef19-3833-4e8c-95b0-fe7b7bafef88" />
logs
<img width="1366" height="768" alt="Screenshot (221)" src="https://github.com/user-attachments/assets/1335b65d-c9d0-434f-a472-2133e2845b4d" />


---

## Author

Built by Prince Ikechukwu.

---

## License

This project is open for learning, demo, and portfolio use.
You may update the license depending on how you want the project to be used.
