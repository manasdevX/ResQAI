<div align="center">

# ResQAI

**Real-time disaster response — from citizen SOS to command centre resolution.**

ResQAI is an open-source, full-stack emergency management platform that connects citizens in crisis, field responders, shelter operators, and administrators through a single real-time interface backed by AI-powered triage.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongoosejs.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## What is ResQAI?

When a disaster strikes, coordination breaks down fast. Citizens don't know who to call. Responders don't know where to go. Shelter operators don't know how full they are. Admins can't see anything in real time.

ResQAI solves this by giving every stakeholder a role-specific interface that shares a single live data layer:

- A **citizen** triggers an SOS, reports an incident with photos, checks into a shelter, and requests food or water — all from their phone.
- A **responder** receives a skill-matched dispatch notification, accepts the task, fulfils resource requests in the field, and chats with the team.
- A **shelter manager** tracks occupancy live, updates status, and manages their assigned facility.
- An **admin** watches a live map of every active incident, broadcasts evacuation orders, reassigns responders, reads AI triage summaries, and monitors analytics — without refreshing a page.

Everything is connected through WebSockets. Every status change, SOS alert, check-in, and message propagates to every relevant party within milliseconds.

---

## Table of Contents

- [Architecture](#architecture)
- [Core Flow](#core-flow)
- [Feature Reference](#feature-reference)
  - [Authentication & Onboarding](#authentication--onboarding)
  - [Incident Reporting & AI Triage](#incident-reporting--ai-triage)
  - [SOS Emergency System](#sos-emergency-system)
  - [Smart Dispatch & Escalation](#smart-dispatch--escalation)
  - [Shelter Management](#shelter-management)
  - [Resource Requests](#resource-requests)
  - [Real-Time Chat](#real-time-chat)
  - [Emergency Broadcast](#emergency-broadcast)
  - [Notifications](#notifications)
  - [Analytics](#analytics)
  - [User & Role Management](#user--role-management)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Security](#security)
- [Contributing](#contributing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React 19 + Vite)                │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Citizen  │  │  Responder   │  │ Shelter  │  │   Admin   │  │
│  │   /home   │  │  /volunteer  │  │ Manager  │  │  /admin   │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └─────┬─────┘  │
│       │               │               │               │         │
│       └───────────────┴───────────────┴───────────────┘         │
│                               │                                 │
│              ┌────────────────┼──────────────────┐              │
│              │   AuthContext  │  SocketContext    │              │
│              │   (Axios+JWT)  │  (Socket.io-cli)  │              │
│              └────────────────┼──────────────────┘              │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP REST + WebSocket
┌───────────────────────────────┼─────────────────────────────────┐
│                  SERVER (Node.js + Express 5)                   │
│                               │                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  REST API Layer                                          │   │
│  │  /api/auth  /api/incidents  /api/shelters  /api/chat     │   │
│  │  /api/users  /api/resources  /api/analytics  /api/...   │   │
│  └───────────────────────────────┬──────────────────────────┘   │
│                                  │                              │
│  ┌───────────────┐   ┌───────────┴───────────┐                 │
│  │  Gemini AI    │   │    Socket.IO Server    │                 │
│  │  (triage)     │   │  (events, rooms, auth) │                 │
│  └───────────────┘   └───────────┬────────────┘                │
│                                  │                              │
│  ┌───────────────┐   ┌───────────┴────────────┐                │
│  │  Cloudinary   │   │       MongoDB           │                │
│  │  (media)      │   │  (geospatial + docs)    │                │
│  └───────────────┘   └────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Role rooms** — every connected socket automatically joins `user:<id>` (personal) and `role:<role>` (broadcast) rooms. Targeted events never reach the wrong audience.
- **Geospatial-first** — incidents, shelters, and resource requests all store `GeoJSON Point` locations with `2dsphere` indexes, enabling `$near` queries for distance-aware filtering.
- **AI as a non-blocking enrichment** — Gemini triage runs asynchronously after an incident is saved. A timeout and fallback guarantee the incident is always created, even when the AI service is unavailable.

---

## Core Flow

Understanding how the system flows end-to-end:

```
Citizen reports incident
        │
        ▼
POST /api/report  ──► Validate + Duplicate check (500m / 30min)
        │
        ├──► Save Incident to MongoDB
        │
        ├──► Gemini AI Triage (async, 15s timeout)
        │         └── sets severity, risk score, summary, recommended actions
        │
        ├──► io.emit('newIncident')  ──► All admin dashboards update live
        │
        └──► Smart Dispatch (setImmediate)
                  │
                  ├── Query skill-matched responders (e.g. fire → firefighters)
                  ├── Fallback to all available responders if no skill match
                  └── io.to(`user:${id}`).emit('newIncidentAssigned') per responder
                              │
                              ▼
                  Responder sees dispatch alert on dashboard
                              │
                              ▼
                  POST /api/incidents/:id/accept
                              │
                              ├── Atomic $addToSet (race-condition safe)
                              ├── Status → 'responding'
                              ├── io.emit('incidentUpdated') → all dashboards
                              └── SOS? → io.to(`user:${reporterId}`).emit('sosAcknowledged')

                  ── 15 minutes pass with no acceptance ──►

                  Auto-escalation timer fires
                              │
                              └── io.to(`role:admin`).emit('incidentEscalated')
                                        └── Admin dashboard shows escalation banner
```

---

## Feature Reference

### Authentication & Onboarding

ResQAI uses a two-step email verification flow for all new accounts.

**Signup flow:**
1. User submits name, email, password, and role (`citizen` or `responder`). If an invite token is present in the URL, the role is overridden by the invite.
2. A 6-digit OTP is hashed with bcrypt and stored. The raw OTP is emailed via Nodemailer.
3. The user enters the OTP on a verification screen. After 5 wrong attempts, the code is locked. A new code can be requested after 60 seconds.
4. On success, the account is marked verified and a JWT is issued.

**Invite-based onboarding:**
- Admins generate time-limited invite links (48-hour expiry) for `admin` and `shelter_manager` roles from the Invites panel.
- The link encodes a one-use token. When a new user signs up via that URL, the token is validated and the correct role is automatically assigned.
- Used tokens are stamped with `usedAt` and `usedBy` and cannot be reused.

**Additional auth:**
- **Google OAuth** — One-tap sign-in. If the email already exists, the account is linked; if not, a new account is created with the email pre-verified.
- **Forgot / Reset Password** — A raw 32-byte token is emailed. Only its SHA-256 hash is stored in the database. The link expires in 1 hour.
- **Session restore** — On app load, the stored JWT is validated against `GET /api/auth/me`. Invalid or expired tokens trigger a clean logout.

---

### Incident Reporting & AI Triage

Citizens and responders can report any of the following incident types: `fire`, `flood`, `earthquake`, `cyclone`, `landslide`, `accident`, `medical_emergency`, `building_collapse`, `chemical_spill`, `riot`, `other`.

**Report form (`POST /api/report`):**
- Accepts `multipart/form-data` — up to 5 files (images, video, audio, documents), 10 MB each, uploaded to Cloudinary.
- Also accepts `POST /api/incidents` as a JSON-only variant.
- Location is sent as a GeoJSON `Point` with optional address fields.

**AI Triage:**

Every new incident is passed to Gemini 2.0 Flash with a structured prompt. The model returns:

| Field | Description |
|-------|-------------|
| `summary` | 1–2 sentence human-readable summary |
| `urgency` | `low` \| `medium` \| `high` \| `critical` |
| `recommendedActions` | Array of step-by-step response actions |
| `estimatedAffected` | Estimated number of people affected |
| `riskScore` | Integer 0–100 |

The AI output is stored in the `aiTriage` sub-document on the incident and displayed on admin and responder dashboards. If the AI call fails or times out (15 s), a safe fallback is used and the incident is still saved.

**Lifecycle statuses:** `reported` → `acknowledged` → `responding` → `resolved` → `closed`  
Every status transition is appended to a `statusHistory` array with the user who made the change and a timestamp. The original reporter receives a socket notification for key transitions.

**Duplicate detection:**  
A `$near` query checks if the same user already has an active incident within 500 m, reported in the last 30 minutes. If so, the request is rejected with the ID of the existing incident.

---

### SOS Emergency System

The SOS button is available to every authenticated citizen. It follows a deliberate 4-phase UI flow to prevent accidental triggers:

```
idle  ──tap──►  confirm  ──"YES, SEND SOS"──►  sending (GPS fetch)  ──►  done / error
```

On confirmation:
1. The browser requests high-accuracy GPS coordinates.
2. `POST /api/incidents/sos` creates a `critical`-severity incident with `isSOS: true`.
3. `io.emit('sosAlert')` broadcasts to all connected clients — every admin and volunteer dashboard shows an immediate alert banner.
4. `io.emit('newIncident')` propagates the incident to the live map.

When a responder accepts the SOS task:
- `io.to(`user:${reporterId}`).emit('sosAcknowledged')` sends a personal notification back to the citizen with the responder's name, showing them help is on the way.

---

### Smart Dispatch & Escalation

**Smart dispatch** runs immediately after every new incident is saved, in a `setImmediate` callback (non-blocking).

The system maintains a skill keyword map for each incident type:

```
fire              → ['firefighting', 'fire', 'rescue']
flood             → ['water rescue', 'swimming', 'flood', 'search and rescue']
medical_emergency → ['medical', 'first aid', 'cpr', 'paramedic', 'nurse', 'doctor']
chemical_spill    → ['hazmat', 'chemical', 'decontamination']
...
```

All available, active responders are fetched. Those whose skill profiles overlap with the incident's keyword list are targeted first. If no skill-matched responders exist, all available responders receive the dispatch.

Each targeted responder gets a personal socket event `newIncidentAssigned` with the incident summary, severity, type, SOS flag, and AI summary — directly on their dashboard without any polling.

**Auto-escalation** runs on a `setTimeout` 15 minutes after incident creation. If the incident still has zero `assignedResponders` and is not yet resolved, a `incidentEscalated` event is emitted to every socket in the `role:admin` room. The admin dashboard shows a dismissible escalation banner.

---

### Shelter Management

**Registered shelters** are stored in MongoDB with full GeoJSON coordinates and can be queried by distance using `$near`.

Shelter types: `hospital`, `relief_camp`, `school`, `community_hall`, `government_building`, `other`  
Shelter statuses: `active`, `full`, `preparing`, `closed`  
Tracked amenities: food, water, medical, electricity, wifi, bedding, toilets, childCare, wheelchairAccessible, security

**Citizen check-in flow:**
- A citizen can check in to one shelter at a time. A pre-check verifies they are not already registered elsewhere.
- The actual check-in uses a MongoDB atomic `findOneAndUpdate` with a `$expr: { $lt: ['$currentOccupancy', '$totalCapacity'] }` filter — if two citizens try to fill the last spot simultaneously, only one succeeds.
- On success, `shelterOccupancyUpdated` is emitted via socket so every connected client's shelter list updates without a reload.
- If occupancy reaches capacity after a check-in, status automatically flips to `full`.

**OSM Nearby Places tab:**
- Uses the free [OpenStreetMap Overpass API](https://overpass-api.de) — no API key required.
- Fetches real hospitals, clinics, pharmacies, police stations, fire stations, and shelters within the user's chosen radius.
- Results include name, address, phone, website, opening hours, and Haversine distance, sorted nearest first.

**Shelter manager role:**
- A `shelter_manager` account can only view and edit the shelter explicitly assigned to them by an admin.
- Occupancy and status updates go through an ownership check before being applied.

---

### Resource Requests

Citizens can request essential supplies: `food`, `water`, `medical`, `clothing`, `shelter`, `other`.

**Flow:**
1. Citizen submits a request with type, description, urgency, and GPS location via the Resource Request modal.
2. `newResourceRequest` is broadcast via socket — responders see it appear on their Resources page in real time.
3. A responder acknowledges the request (`acknowledged` status), claiming it so others know it is being handled.
4. The responder fulfils it on delivery, moving it to `fulfilled`.

Responders can also query resource requests by proximity (`GET /api/resources/nearby`) to see what needs handling in their area.

---

### Real-Time Chat

Every role has access to direct messaging. Chat is built on Socket.IO with REST fallbacks.

**Features:**
- **Direct messages** between any two users — citizens, responders, shelter managers, and admins can all message each other.
- **Online presence** — a `chat:onlineUsers` event is broadcast whenever someone connects or disconnects, showing live green/grey status indicators on all user avatars.
- **Typing indicators** — `chat:typing` events are debounced client-side (2-second idle timeout) and shown to the recipient in real time.
- **Reply threads** — any message can be replied to; the reply preview is stored as a `replyTo` reference.
- **Unread counts** — per-conversation unread badge counts are fetched on load and decremented as messages are read.
- **Soft delete** — deleted messages are marked `isDeleted: true` and their content replaced with `[Message deleted]`. The sender or any admin can delete.
- **Optimistic UI** — sent messages appear instantly with a temporary ID. When the server echo arrives, the temp message is replaced in-place.
- **Incident threads** — incidents have their own message rooms (`incident:<id>`). Responders assigned to an incident can post updates in the thread, visible to everyone viewing that incident's detail page.

All messages are persisted in MongoDB and available as a scrollable history (50 messages per page, paginated).

---

### Emergency Broadcast

Admins can push a system-wide alert from the **Alerts** panel.

Alert types: `evacuation`, `medical`, `shelter`, `general`

`POST /api/incidents/broadcast-alert` emits an `alertBroadcast` event to **all connected sockets** (`io.emit`). Every dashboard — citizen, responder, and admin — shows an animated banner at the top of the screen with the alert type, message, and the admin who sent it. The banner auto-dismisses after 12 seconds or can be closed manually.

---

### Notifications

Notifications are generated for specific events and delivered in two ways simultaneously:

1. **Database** — a `Notification` document is created with `recipient`, `type`, `title`, `body`, and `link`.
2. **Socket** — the same payload is emitted to `user:<id>` so the recipient sees it immediately if they are online.

Events that trigger notifications:
- A responder is manually assigned to an incident by an admin
- An incident's status changes to `acknowledged`, `responding`, `resolved`, or `closed` (notifies the original reporter)

The notification bell in the navigation header shows an unread badge count. Clicking it navigates to the Notifications page where all notifications are listed with mark-one-read and mark-all-read actions.

---

### Analytics

The Analytics dashboard (admin only) is built on a single MongoDB aggregation request using `$facet` for efficiency — one round-trip returns all data.

**Metrics available:**

| Metric | Source |
|--------|--------|
| Total, active, resolved, and critical incidents | `$facet` on `Incident` collection |
| SOS count | `isSOS` flag count |
| Resolution rate | `resolved / total × 100` |
| Average resolution time | `statusHistory` — time from `createdAt` to first `resolved` entry |
| Incidents by severity | `$group` on `severity` |
| Incidents by type | `$group` on `type`, sorted by count |
| Incidents by status | `$group` on `status` |
| 14-day daily incident trend | `$dateToString` grouping, gap-filled with zeros |
| Total shelters, active shelters | `$group` on `Shelter` |
| Total capacity and current occupancy | `$sum` of respective fields |
| Shelter utilization rate | `totalOccupancy / totalCapacity × 100` |
| Responders registered and on duty | `$group` on `User` where role is `responder` or `shelter_manager` |

Charts are rendered with pure CSS/SVG — no charting library dependency.

---

### User & Role Management

**Admin → User Manager:**
- Search users by name or email, filter by role.
- Change a user's role between `citizen`, `responder`, and `shelter_manager`. Admin role is protected and cannot be changed by another admin.
- Activate or deactivate accounts. Deactivated accounts cannot log in.

**Volunteer availability toggle:**
- Responders can toggle their duty status (ON DUTY / OFF DUTY) from their dashboard or profile.
- When toggled, all admin sockets immediately receive a `responderAvailabilityChanged` event and update their displayed "responders on duty" count without a page refresh.

**Skills management:**
- Responders maintain a personal skills list (e.g., "first aid", "search and rescue", "driving") that drives smart dispatch.
- Skills can be added and removed from the volunteer dashboard and profile page.

---

## Roles & Permissions

| Capability | Citizen | Responder | Shelter Manager | Admin |
|-----------|:-------:|:---------:|:---------------:|:-----:|
| Report incident | ✅ | ✅ | ✅ | ✅ |
| Trigger SOS | ✅ | ✅ | ✅ | ✅ |
| View own incidents only | ✅ | — | — | — |
| View all incidents | — | ✅ | ✅ | ✅ |
| Accept incident task | — | ✅ | — | ✅ |
| Assign responder to incident | — | — | — | ✅ |
| Check in / out of shelter | ✅ | ✅ | ✅ | ✅ |
| Manage own shelter | — | — | ✅ | ✅ |
| Create / delete shelters | — | — | — | ✅ |
| Request resources | ✅ | — | — | — |
| Acknowledge / fulfil resources | — | ✅ | ✅ | ✅ |
| Chat (DM) | ✅ | ✅ | ✅ | ✅ |
| Broadcast emergency alert | — | — | — | ✅ |
| Create invite links | — | — | — | ✅ |
| View analytics | — | — | — | ✅ |
| Manage users (role, active) | — | — | — | ✅ |

---

## Tech Stack

### Backend

| Package | Version | Role |
|---------|---------|------|
| Node.js | 18+ | Runtime |
| Express | 5 | HTTP framework |
| Mongoose | 9 | ODM + geospatial queries |
| Socket.IO | 4 | WebSocket server |
| jsonwebtoken | 9 | JWT sign / verify |
| bcryptjs | 3 | Password and OTP hashing |
| Nodemailer | 8 | SMTP email (OTP, reset) |
| Cloudinary SDK | 2 | Media storage |
| Multer | 2 | Multipart file parsing |
| @google/generative-ai | 0.24 | Gemini 2.0 Flash triage |
| Helmet | 8 | Security headers |
| express-rate-limit | 8 | Abuse protection |
| express-mongo-sanitize | 2 | NoSQL injection prevention |

### Frontend

| Package | Version | Role |
|---------|---------|------|
| React | 19 | UI framework |
| Vite | 8 | Build tool and dev server |
| React Router | 7 | Client-side routing |
| TailwindCSS | 3 | Utility-first styling |
| Shadcn UI | — | Accessible component primitives |
| Leaflet + react-leaflet | 1.9 / 5 | Interactive map |
| socket.io-client | 4 | WebSocket client |
| Axios | 1 | HTTP client |
| Framer Motion | 12 | Animations |
| Lucide React | — | Icon set |
| Geist Variable | — | Typeface |
| Zod | 4 | Schema validation |
| react-hook-form | 7 | Form state management |
| @react-oauth/google | 0.13 | Google sign-in button |

---

## Project Structure

```
ResQAI/
├── backend/
│   ├── controllers/
│   │   ├── authController.js         # Signup/OTP/login/Google/reset
│   │   ├── incidentController.js     # CRUD, SOS, dispatch, escalation, media
│   │   ├── shelterController.js      # CRUD, check-in/out, OSM, manager assign
│   │   ├── chatController.js         # DM, threads, unread, soft delete, socket
│   │   ├── resourceController.js     # Request, acknowledge, fulfil
│   │   ├── userController.js         # Profile, skills, availability, admin ops
│   │   ├── analyticsController.js    # $facet aggregation pipeline
│   │   ├── inviteController.js       # Create, validate, list, revoke
│   │   └── notificationController.js # Fetch, mark read
│   ├── models/
│   │   ├── User.js                   # 4 roles, bcrypt hook, 2dsphere index
│   │   ├── Incident.js               # Full enum set, aiTriage, statusHistory
│   │   ├── Shelter.js                # Amenities map, occupant refs, 2dsphere
│   │   ├── Message.js                # DM + incident threads, readBy, soft delete
│   │   ├── ResourceRequest.js        # GeoJSON location, status workflow
│   │   ├── Notification.js           # Recipient, type, read flag
│   │   └── Invite.js                 # Token, role, expiry, usedAt
│   ├── routes/                       # One router per resource
│   ├── middleware/
│   │   ├── authMiddleware.js         # JWT protect guard
│   │   └── upload.js                 # Cloudinary + Multer config
│   ├── utils/
│   │   ├── aiTriage.js               # Gemini prompt + fallback
│   │   ├── emailService.js           # OTP and reset email templates
│   │   ├── notify.js                 # DB + socket notification helper
│   │   └── generateToken.js          # JWT sign
│   ├── seeds/
│   │   ├── createAdmin.js            # Bootstrap first admin
│   │   └── seedShelters.js           # Sample shelter data
│   ├── .env.example
│   └── server.js                     # Express + Socket.IO + MongoDB entry
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/                # Dashboard, IncidentManager, ShelterManager,
        │   │                         # Analytics, Alerts, Invites, UserManager
        │   ├── volunteer/            # Dashboard, Incidents, Assignments,
        │   │                         # Resources, ShelterManagerPanel
        │   ├── citizen/              # Home, Shelters, MyReports,
        │   │                         # IncidentDetail, Resources
        │   └── (shared)              # Login, Signup, Chat, Notifications,
        │                             # Profile, Report, ForgotPassword, ResetPassword
        ├── components/
        │   ├── SOSButton.jsx         # 4-phase confirm guard + GPS + API
        │   ├── LiveMap.jsx           # Leaflet map, incident + shelter markers
        │   ├── IncidentReportForm.jsx# Full form with Cloudinary upload
        │   ├── IncidentManagementPanel.jsx  # Admin single-incident controls
        │   ├── IncidentToast.jsx     # Real-time new incident popup
        │   ├── NotificationBell.jsx  # Unread badge + dropdown
        │   ├── ResourceRequestModal.jsx     # Citizen resource request form
        │   ├── WeatherWidget.jsx     # Compact / full weather card
        │   ├── ProtectedRoute.jsx    # Role-based route guard
        │   ├── ErrorBoundary.jsx     # Graceful error fallback
        │   └── OfflineBanner.jsx     # Network status indicator
        ├── context/
        │   ├── AuthContext.jsx       # User, token, all auth actions, Axios instance
        │   ├── SocketContext.jsx     # JWT-authenticated socket lifecycle
        │   └── NotificationContext.jsx  # Unread count, real-time push
        ├── layouts/
        │   ├── AdminLayout.jsx       # Sidebar nav for admin
        │   ├── VolunteerLayout.jsx   # Sidebar nav for responder/shelter_manager
        │   └── CitizenLayout.jsx     # Bottom nav for citizen
        └── constants/
            ├── incident.js           # Type icons, severity badges, status styles
            └── shelter.js            # Type metadata, amenity list, status badges
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or above
- **MongoDB** — a local instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- **Cloudinary** account — for incident photo and video uploads
- **Google Cloud** project — Generative AI API enabled, for Gemini triage
- **Gmail** (or any SMTP provider) — with an [App Password](https://support.google.com/accounts/answer/185833) for sending OTP and reset emails

---

### 1. Clone

```bash
git clone https://github.com/your-username/ResQAI.git
cd ResQAI
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in your values
npm run dev
```

Expected output:

```
  ResQAI Server
  ✓ MongoDB    connected
  ✓ Socket.IO  running
```

### 3. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env   # then fill in your values
npm run dev
```

Open `http://localhost:5173`.

### 4. Bootstrap the first admin

```bash
# from the backend/ directory
node seeds/createAdmin.js
```

Log in with the credentials printed by the script. From the Admin panel, use **Invites** to onboard additional staff.

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|----------|:--------:|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Signing secret — minimum 32 characters |
| `PORT` | — | HTTP port (default `5000`) |
| `FRONTEND_URL` | — | CORS origin + email link base (default `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `EMAIL_HOST` | — | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | — | SMTP port (e.g. `587`) |
| `EMAIL_SECURE` | — | `true` for port 465, `false` for STARTTLS |
| `EMAIL_USER` | — | Sender address |
| `EMAIL_PASS` | — | App password |
| `CLOUDINARY_CLOUD_NAME` | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | — | Cloudinary API secret |
| `GEMINI_API_KEY` | — | Google Generative AI key |

> The server refuses to start if `MONGO_URI` or `JWT_SECRET` are missing. All other variables degrade gracefully — features simply become unavailable rather than crashing.

### `frontend/.env`

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend REST base URL (default `http://localhost:5000/api`) |
| `VITE_SOCKET_URL` | Socket.IO server URL (default `http://localhost:5000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for the sign-in button |

---

## API Overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

| Resource | Prefix | Notable endpoints |
|----------|--------|-------------------|
| Auth | `/api/auth` | `POST /signup`, `POST /verify-otp`, `POST /login`, `POST /google`, `POST /forgot-password`, `POST /reset-password`, `GET /me` |
| Incidents | `/api/incidents` | `GET /`, `GET /nearby`, `GET /:id`, `POST /sos`, `POST /broadcast-alert`, `PATCH /:id/status`, `PATCH /:id/severity`, `POST /:id/accept`, `POST /:id/assign`, `DELETE /:id/assign/:responderId` |
| Report | `/api/report` | `POST /` — multipart with up to 5 media files |
| Shelters | `/api/shelters` | `GET /`, `GET /nearby`, `GET /places`, `GET /mine`, `POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/status`, `PATCH /:id/occupancy`, `POST /:id/checkin`, `POST /:id/checkout`, `PATCH /:id/assign-manager` |
| Chat | `/api/chat` | `GET /users`, `GET /dm/:userId`, `POST /dm/:userId`, `PATCH /dm/:userId/read`, `GET /unread`, `GET /incident/:id`, `POST /incident/:id`, `DELETE /message/:id` |
| Resources | `/api/resources` | `GET /` (admin), `GET /nearby`, `GET /mine`, `POST /`, `PATCH /:id/acknowledge`, `PATCH /:id/fulfill` |
| Users | `/api/users` | `GET /profile`, `PATCH /profile`, `PATCH /avatar`, `PATCH /password`, `PATCH /availability`, `PATCH /skills`, `PATCH /safe`, `GET /responders`, `GET /all` (admin), `PATCH /:id/role` (admin), `PATCH /:id/active` (admin) |
| Invites | `/api/invites` | `POST /`, `GET /`, `GET /validate`, `DELETE /:id` |
| Analytics | `/api/analytics` | `GET /summary` |
| Notifications | `/api/notifications` | `GET /`, `PATCH /:id/read`, `PATCH /read-all` |

### Socket.IO events

| Event | Direction | Description |
|-------|-----------|-------------|
| `newIncident` | Server → All | A new incident was reported |
| `incidentUpdated` | Server → All | Status, severity, or assignees changed |
| `sosAlert` | Server → All | SOS triggered |
| `sosAcknowledged` | Server → Citizen | A responder accepted the citizen's SOS |
| `newIncidentAssigned` | Server → Responder | Dispatch to a specific responder |
| `incidentEscalated` | Server → Admins | 15-min escalation, no one accepted |
| `alertBroadcast` | Server → All | Emergency broadcast from admin |
| `shelterUpdated` | Server → All | Shelter details changed |
| `shelterOccupancyUpdated` | Server → All | Check-in or check-out occurred |
| `newResourceRequest` | Server → All | New resource request submitted |
| `resourceRequestAcknowledged` | Server → All | Responder claimed a resource request |
| `resourceRequestFulfilled` | Server → All | Resource request fulfilled |
| `responderAvailabilityChanged` | Server → Admins | Responder toggled duty status |
| `notification` | Server → User | Personal in-app notification |
| `chat:newDM` | Server → User | New direct message |
| `chat:typing` | Server → User | Typing indicator |
| `chat:onlineUsers` | Server → All | Updated online presence list |
| `chat:incidentMessage` | Server → Room | Message in an incident thread |

---

## Security

| Layer | Mechanism |
|-------|-----------|
| HTTP headers | `helmet` — sets `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy`, and more |
| NoSQL injection | `express-mongo-sanitize` strips `$` operators and `.` from all request bodies and query strings |
| Rate limiting | 200 req / 15 min globally; 15 req / 15 min on all auth endpoints (`/login`, `/signup`, `/verify-otp`, `/resend-otp`, `/forgot-password`, `/reset-password`, `/google`) |
| Password hashing | bcrypt with salt rounds of 12; never stored in plain text |
| OTP security | bcrypt-hashed OTP storage; 10-minute expiry; 5-attempt lockout; 60-second resend cooldown |
| Password reset | Raw token in email link; SHA-256 hash stored in DB; plain token is never persisted |
| JWT | Signed `HS256` tokens validated on every protected request; Socket.IO connections verified via JWT middleware before any event is processed |
| Role isolation | Citizens receive only their own incidents from the API; shelter managers are ownership-checked before any mutation |
| CORS | Explicitly configured to the `FRONTEND_URL` origin; credentials allowed |
| Media validation | Multer `fileFilter` restricts uploads to `image/*`, `video/*`, `audio/*`, and `application/pdf`; 10 MB per file; 5 files maximum |

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit following [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat: describe your change"`
4. Push and open a Pull Request against `main`

For significant changes, open an issue first to discuss the approach.
