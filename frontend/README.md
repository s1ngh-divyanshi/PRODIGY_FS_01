# 🔒 SentinelAuth Platform

SentinelAuth is a production-grade, full-stack user authentication and management dashboard built using the **MERN Stack** (MongoDB, Express, React, Node.js). Designed with security first, the application uses short-lived **JSON Web Tokens (JWT)** transmitted securely via **HTTP-Only Cookies**, providing robust protection against Cross-Site Scripting (XSS) and brute-force vector threats.

---

## 🚀 Key Features

### 🛡️ Core Security Architecture
* **HTTP-Only Cookies:** Tokens are handled directly by the browser container, keeping sensitive JWT strings completely hidden from client-side JavaScript.
* **API Rate Limiting:** Outfitted with `express-rate-limit` middleware on critical routes (`/login`, `/register`) to actively stop automated brute-force attacks.
* **Input Sanitation & Validation:** Uses `express-validator` to inspect input fields, enforcing password complexity rules and proper email formats at the gate.
* **Password Hashing:** Implements asynchronous blowfish salting routines via `bcryptjs` before updating user document states.

### 👥 Role-Based Access Control (RBAC)
The platform establishes a strict hierarchical privilege tree with distinct validation gates:

| Authority Level | Privileges | Deletion Matrix Rights |
| :--- | :--- | :--- |
| **`User`** | View personal session data. | Can delete their own account context only. |
| **`Admin`** | View global registry grid metrics. | Can delete themselves OR standard `User` accounts. Blocked from dropping other Admins. |
| **`Superadmin`** | Complete system visibility & management. | Can delete `User` and `Admin` tiers. Cannot delete themselves if they are the last standing root. |

### 💎 User Experience (UX) Optimizations
* **Persistent Login Checks:** Backed by an automated background session-pinging mechanism (`/api/auth/me`), ensuring browser reloads keep user workflow intact.
* **Loading Hooks:** Interactive components feature real-time disable states during server execution loops to block duplicate submission requests.
* **Dynamic UI Scaling:** The dashboard automatically reconstructs its layout view models conditionally based on verified authority tiers.

---

## 🛠️ Built With

* **Frontend Library:** React.js (Hooks, Context, Router v6)
* **Backend Server Framework:** Node.js + Express.js
* **Database ODM Matrix:** MongoDB Engine via Mongoose ODM
* **HTTP Middleware:** Axios, Cookie-Parser, Cors, Express-Validator, Express-Rate-Limit

---

## 📦 Directory Structure

```text
secure-auth-app/
├── backend/
│   ├── models/       # Mongoose Schemas (User.js)
│   ├── .env          # Private Server Configurations
│   └── server.js     # Express Router & Security Gateway Middleware
└── frontend/
    ├── public/       # Client Asset Index & Web Favicon
    └── src/
        ├── App.js    # React Application Core & UI Views
        └── App.css   # Tailored Scoped UI Styling Properties

```

---

## 🛠️ Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) installed on your machine.
* [MongoDB Community Server](https://www.mongodb.com/try/download/community) running locally on port `27017` or an active MongoDB Atlas cluster URL string.

### 1. Clone and Navigate

```bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/sentinel-auth-platform.git](https://github.com/YOUR_GITHUB_USERNAME/sentinel-auth-platform.git)
cd sentinel-auth-platform

```

### 2. Configure the Backend Application

Navigate into the backend subfolder and install your app dependencies:

```bash
cd backend
npm install

```

Create an environment variable configuration file named `.env` inside the `backend/` folder directory:

```env
PORT=8000
MONGO_URI=mongodb://127.0.0.1:27017/secureAuthDB
JWT_SECRET=your_super_secure_random_production_secret_key

```

Run the backend server in developer watch mode:

```bash
npm run dev

```

### 3. Configure the Frontend Application

Open a new separate terminal screen, hop into the client subfolder, and build out your assets:

```bash
cd frontend
npm install

```

Spin up the local React script execution pipeline:

```bash
npm start

```

Your browser tab will load automatically on `http://localhost:3000`.

---

## 🛡️ Cluster Safety & Operational Safeguards

The backend features an explicit protection intercept layer during deletion sequences. If a privileged node attempts self-destruction:

1. The server executes dynamic role counts (`totalAdmins` / `totalSuperAdmins`) relative to the request context.
2. If the single category count totals `<= 1`, execution sequencing halts immediately, delivering a clear safety message block back to the user view:

> `Action Denied: You are the last remaining Admin/Superadmin node. Self-deletion is blocked unless another user is promoted first.`

```