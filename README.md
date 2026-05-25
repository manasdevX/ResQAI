<div align="center">

# ResQAI

**Real-time disaster response — from citizen SOS to command centre resolution.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongoosejs.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## What is this?

When a disaster happens — flood, fire, earthquake — three groups of people need to act fast and in sync, but they almost never do. Citizens don't know who to call. Responders don't know where to go first. Admins are refreshing spreadsheets trying to understand what's happening.

ResQAI is an attempt to fix that. It's a full-stack emergency management platform with a shared real-time data layer: citizens report, responders get dispatched, shelter managers track occupancy, and admins watch everything on a live map — all without anyone hitting refresh.

The project is a MERN stack app (MongoDB, Express, React, Node.js) with Socket.IO for real-time events, Google Gemini for AI triage, Cloudinary for media, and Leaflet for geospatial mapping.

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
│       └───────────────┴───────────────┴───────────────┘         │
│                               │                                 │
│              ┌────────────────┼──────────────────┐              │
│              │   AuthContext  │  SocketContext    │              │
│              │   (Axios+JWT)  │  (socket.io-cli)  │              │
│              └────────────────┼──────────────────┘              │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP REST + WebSocket
┌───────────────────────────────┼─────────────────────────────────┐
│                  SERVER (Node.js + Express 5)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  REST API — /api/auth  /api/incidents  /api/shelters     │   │
│  │             /api/chat  /api/users  /api/analytics  ...   │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────┐   ┌───────┴────────────────┐                │
│  │  Gemini AI    │   │    Socket.IO Server     │                │
│  │  (triage)     │   │  (rooms, events, auth)  │                │
│  └───────────────┘   └───────┬────────────────┘                │
│                              │                                  │
│  ┌───────────────┐   ┌───────┴────────────────┐                │
│  │  Cloudinary   │   │       MongoDB           │                │
│  │  (media)      │   │  (geospatial + docs)    │                │
│  └───────────────┘   └────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

A few things worth knowing about how this is structured:

- Every connected socket joins two rooms automatically — `user:<id>` for personal events and `role:<role>` for broadcast events. This keeps targeted messages like SOS acknowledgements from leaking to the wrong person.
- Incidents, shelters, and resource requests all store `GeoJSON Point` coordinates with `2dsphere` indexes. Distance-based queries use `$near` — no external mapping API needed for that.
- Gemini triage is intentionally non-blocking. It runs after the incident is saved, with a 15-second timeout and a safe fallback. The incident is always created regardless of whether the AI responds.

---

## Core Flow

The main thing the system does — from incident report to resolution:

```
Citizen reports an incident
        │
        ▼
POST /api/report  ─► Validate + duplicate check (500m / 30 min)
        │
        ├──► Save to MongoDB
        │
        ├──► Gemini triage (async, 15s timeout)
        │         └── severity, risk score, summary, recommended actions
        │
        ├──► io.emit('newIncident')  ──► Admin dashboards update live
        │
        └──► Smart dispatch (setImmediate, non-blocking)
                  │
                  ├── Find skill-matched available responders
                  ├── Fall back to all available if no match
                  └── io.to(`user:${id}`).emit('newIncidentAssigned')
                              │
                              ▼
                  Responder sees dispatch on their dashboard
                              │
                              ▼
                  POST /api/incidents/:id/accept
                              │
                              ├── Atomic $addToSet (race-condition safe)
                              ├── Status → 'responding'
                              ├── io.emit('incidentUpdated') → all dashboards
                              └── SOS? → io.to(`user:${reporterId}`).emit('sosAcknowledged')

                  ── 15 minutes pass with no acceptance ──►

                  Auto-escalation fires
                              │
                              └── io.to('role:admin').emit('incidentEscalated')
                                        └── Escalation banner on admin dashboard
```

---

## Feature Reference

### Authentication & Onboarding

Signup uses a two-step email verification flow. The user submits their details, gets a 6-digit OTP by email (hashed with bcrypt before storing), and enters it on a verification screen. The OTP expires in 10 minutes, locks after 5 wrong attempts, and can be resent after 60 seconds. On success a JWT is issued.

If someone has an invite link (generated by an admin), the role is taken from the invite rather than what the user picked — that's how responder and shelter manager accounts are created.

Google OAuth is also supported. If the email already exists the account gets linked; if not, a new account is created with the email pre-verified.

Password resets use a 32-byte random token sent in the email link. Only its SHA-256 hash is stored in the database — the plain token is never persisted anywhere.

---

### Incident Reporting & AI Triage

Incidents can be reported through two endpoints. `/api/report` accepts `multipart/form-data` with up to 5 files (images, video, audio, documents — 10 MB each, uploaded to Cloudinary). `/api/incidents` accepts JSON if no media is needed.

Supported incident types: `fire`, `flood`, `earthquake`, `cyclone`, `landslide`, `accident`, `medical_emergency`, `building_collapse`, `chemical_spill`, `riot`, `other`.

Every new incident is sent to Gemini 2.0 Flash with a structured prompt asking for:

| Field | What it is |
|-------|-----------|
| `summary` | A 1–2 sentence plain-English summary |
| `urgency` | `low` / `medium` / `high` / `critical` |
| `recommendedActions` | Ordered list of response steps |
| `estimatedAffected` | Best-guess number of people affected |
| `riskScore` | 0–100 integer |

This gets stored in the `aiTriage` sub-document on the incident and shows up on admin and responder dashboards inline.

Status lifecycle: `reported` → `acknowledged` → `responding` → `resolved` → `closed`. Every transition is appended to a `statusHistory` array with who changed it and when. The person who reported the incident gets a socket notification when the status moves to `acknowledged`, `responding`, `resolved`, or `closed`.

On creation, the system also checks if the same user already has an open incident within 500m in the last 30 minutes. If yes, the request is rejected and the existing incident ID is returned — avoids duplicate floods during large events.

---

### SOS Emergency System

Every citizen has a one-tap SOS button. To prevent accidental triggers it goes through four states before anything is sent:

```
idle  ──tap──►  confirm  ──"YES, SEND SOS"──►  sending (GPS fetch)  ──►  done / error
```

On confirmation, the browser requests GPS coordinates, then `POST /api/incidents/sos` creates a critical-severity incident with `isSOS: true`. Two socket events fire: `sosAlert` goes to every connected client (admins and responders see an alert banner), and `newIncident` puts it on the live map.

When a responder accepts the SOS task, the person who triggered it gets a `sosAcknowledged` event with the responder's name — so they know someone is actually coming.

---

### Smart Dispatch & Escalation

After every new incident is saved, a non-blocking `setImmediate` callback tries to route it to the right people.

There's a keyword map per incident type — for example:

```
fire              → ['firefighting', 'fire', 'rescue']
medical_emergency → ['medical', 'first aid', 'cpr', 'paramedic', 'nurse', 'doctor']
flood             → ['water rescue', 'swimming', 'flood', 'search and rescue']
chemical_spill    → ['hazmat', 'chemical', 'decontamination']
```

Responders whose skill profiles overlap those keywords get targeted first. If nobody qualifies, the dispatch goes to all available responders. Each targeted responder receives a `newIncidentAssigned` socket event with the incident title, severity, type, and AI summary.

The escalation timer runs on a `setTimeout` set 15 minutes after creation. If the incident still has no `assignedResponders` and isn't resolved, a `incidentEscalated` event fires to every socket in `role:admin`. The admin dashboard shows a dismissible orange banner for each pending escalation.

---

### Shelter Management

Shelters live in MongoDB with `GeoJSON Point` coordinates and `2dsphere` indexes. The `/nearby` endpoint uses `$near` to return shelters sorted by distance, with the calculated distance attached to each result.

Supported types: `hospital`, `relief_camp`, `school`, `community_hall`, `government_building`, `other`.  
Tracked amenities: food, water, medical, electricity, wifi, bedding, toilets, child care, wheelchair access, security.

Check-in is atomic. The update query includes `$expr: { $lt: ['$currentOccupancy', '$totalCapacity'] }` — so if two people race to fill the last spot, only one gets in. After every check-in or check-out, a `shelterOccupancyUpdated` socket event updates every connected client's shelter list in place. If occupancy hits capacity, status flips to `full` automatically.

The **OSM Nearby Places** tab fetches real-world data from the OpenStreetMap Overpass API — no API key, no cost. It returns hospitals, clinics, pharmacies, police stations, and fire stations within the user's radius, sorted by Haversine distance. Useful when registered shelters are sparse.

Shelter managers can only see and modify the shelter assigned to them by an admin. Every mutation goes through an ownership check.

---

### Resource Requests

Citizens can request `food`, `water`, `medical`, `clothing`, `shelter`, or `other` supplies from their home page. The request stores GPS coordinates and an urgency level.

When a request is created, `newResourceRequest` is broadcast so responders see it appear on their Resources page immediately. A responder acknowledges it to claim it, then marks it fulfilled on delivery. The whole workflow is: `pending` → `acknowledged` → `fulfilled`.

---

### Real-Time Chat

All four roles can message each other directly. The chat is built on Socket.IO with REST endpoints for history.

- **Presence** — `chat:onlineUsers` fires whenever someone connects or disconnects. Green/grey dots on avatars update for everyone in real time.
- **Typing indicators** — `chat:typing` is debounced client-side at 2 seconds, so the "is typing…" indicator disappears naturally when someone pauses.
- **Unread counts** — per-conversation unread badges are fetched on load and cleared when you open that conversation.
- **Replies** — any message can be replied to. The `replyTo` reference is stored and the original message content is shown as a preview above the reply.
- **Soft delete** — deleted messages flip to `isDeleted: true` and show "[Message deleted]" in place. Senders can delete their own; admins can delete anyone's.
- **Optimistic UI** — sent messages appear instantly with a temp ID and get replaced with the real document when the server echo arrives.
- **Incident threads** — each incident has a thread room (`incident:<id>`). Responders on that incident can post updates visible to anyone viewing the detail page.

All messages are persisted. History loads 50 messages per page.

---

### Emergency Broadcast

From the Admin Alerts panel, any admin can push a system-wide message: `evacuation`, `medical`, `shelter`, or `general`.

`POST /api/incidents/broadcast-alert` calls `io.emit('alertBroadcast')` — every connected socket gets it. Citizens, responders, and other admins all see an animated banner with the alert type, message text, and the sender's name. It auto-dismisses after 12 seconds or can be closed manually.

---

### Notifications

Two things happen simultaneously whenever a notification-worthy event occurs:

1. A `Notification` document is written to MongoDB with `recipient`, `type`, `title`, `body`, and an optional `link`.
2. The same payload is emitted to `user:<id>` via socket so the recipient sees it instantly if they're online.

Events that generate notifications: manual responder assignment by an admin, and status changes on incidents the user reported.

The bell icon in the nav shows an unread count. The Notifications page lists everything with mark-one-read and mark-all-read.

---

### Analytics

The analytics dashboard makes a single request to the server, which runs one aggregation using MongoDB's `$facet` — multiple pipelines in one round-trip.

What you get:

| Metric | How it's computed |
|--------|------------------|
| Total, active, resolved, critical incident counts | `$facet` on the Incident collection |
| SOS count | Count where `isSOS: true` |
| Resolution rate | `resolved / total × 100` |
| Avg resolution time | Time from `createdAt` to first `resolved` entry in `statusHistory` |
| Incidents by severity, type, status | `$group` aggregations |
| 14-day daily trend | `$dateToString` group, zero-filled for missing days |
| Shelter utilisation | `totalOccupancy / totalCapacity × 100` across all shelters |
| Responders on duty | Count where `role = responder` and `isAvailable = true` |

Charts are pure CSS/SVG — no charting library.

---

### User & Role Management

Admins can search users by name or email, filter by role, change roles, and activate or deactivate accounts. Deactivated accounts are blocked at the auth middleware.

Responders toggle their duty status (on/off duty) from their dashboard or profile. When they do, all admin sockets receive `responderAvailabilityChanged` and the "responders on duty" counter updates live.

Skills are managed from the volunteer dashboard or profile page. Adding or removing a skill immediately affects which incidents get dispatched to that person.

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
| Direct message anyone | ✅ | ✅ | ✅ | ✅ |
| Broadcast emergency alert | — | — | — | ✅ |
| Create invite links | — | — | — | ✅ |
| View analytics | — | — | — | ✅ |
| Change user roles / active status | — | — | — | ✅ |

> Admins are created via the seed script. All other privileged roles (`responder`, `shelter_manager`) require an invite link generated from the Admin panel.

---

## Tech Stack

### Backend

| Package | Role |
|---------|------|
| Node.js 18+ / Express 5 | HTTP server and REST API |
| Mongoose 9 | ODM, schema validation, `2dsphere` geospatial indexes |
| Socket.IO 4 | Bidirectional real-time events |
| jsonwebtoken | JWT sign and verify |
| bcryptjs | Password and OTP hashing (12 salt rounds) |
| Nodemailer | Transactional email — OTP and password reset |
| Cloudinary SDK + Multer | Media upload, storage, and retrieval |
| @google/generative-ai | Gemini 2.0 Flash for incident triage |
| Helmet | Security headers |
| express-rate-limit | Brute-force protection |
| express-mongo-sanitize | NoSQL injection prevention |

### Frontend

| Package | Role |
|---------|------|
| React 19 + Vite 8 | UI framework and dev/build tooling |
| React Router v7 | Client-side routing, protected layouts |
| TailwindCSS 3 + Shadcn UI | Styling and accessible component primitives |
| Leaflet + react-leaflet | Interactive geospatial map |
| socket.io-client 4 | WebSocket subscription |
| Axios | HTTP client with JWT interceptor and 401 redirect |
| Framer Motion | Page and component animations |
| Lucide React | Icons |
| Geist Variable | Typeface |
| Zod + react-hook-form | Form validation |
| @react-oauth/google | Google sign-in button |

---

## Project Structure

```
ResQAI/
├── backend/
│   ├── controllers/
│   │   ├── authController.js           # Signup, OTP, login, Google, reset
│   │   ├── incidentController.js       # CRUD, SOS, dispatch, escalation, media
│   │   ├── shelterController.js        # CRUD, check-in/out, OSM, manager assign
│   │   ├── chatController.js           # DM, threads, unread, delete, socket events
│   │   ├── resourceController.js       # Request, acknowledge, fulfil
│   │   ├── userController.js           # Profile, skills, availability, admin ops
│   │   ├── analyticsController.js      # $facet aggregation pipeline
│   │   ├── inviteController.js         # Create, validate, list, revoke
│   │   └── notificationController.js  # Fetch, mark read
│   ├── models/
│   │   ├── User.js                     # 4 roles, bcrypt pre-save, 2dsphere index
│   │   ├── Incident.js                 # Types, statuses, aiTriage, statusHistory
│   │   ├── Shelter.js                  # Amenities map, occupant refs, 2dsphere
│   │   ├── Message.js                  # DM + incident threads, soft delete
│   │   ├── ResourceRequest.js          # GeoJSON location, status workflow
│   │   ├── Notification.js             # Recipient, type, read flag
│   │   └── Invite.js                   # Token, role, expiry, usedAt
│   ├── routes/                         # One router file per resource
│   ├── middleware/
│   │   ├── authMiddleware.js           # JWT protect + role guards
│   │   └── upload.js                   # Cloudinary + Multer config
│   ├── utils/
│   │   ├── aiTriage.js                 # Gemini prompt, timeout, fallback
│   │   ├── emailService.js             # OTP and reset email HTML templates
│   │   ├── notify.js                   # Creates DB notification + emits socket
│   │   └── generateToken.js            # JWT sign helper
│   ├── seeds/
│   │   ├── createAdmin.js              # Bootstrap first admin account
│   │   └── seedShelters.js             # Sample shelter data
│   ├── .env.example
│   └── server.js                       # Entry point — Express + Socket.IO + MongoDB
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── admin/                  # Dashboard, IncidentManager, ShelterManager,
        │   │                           # Analytics, Alerts, Invites, UserManager
        │   ├── volunteer/              # Dashboard, Incidents, Assignments,
        │   │                           # Resources, ShelterManagerPanel
        │   ├── citizen/                # Home, Shelters, MyReports,
        │   │                           # IncidentDetail, Resources
        │   └── (shared)                # Login, Signup, Chat, Notifications,
        │                               # Profile, Report, ForgotPassword, ResetPassword
        ├── components/
        │   ├── SOSButton.jsx           # 4-phase confirm guard, GPS, API call
        │   ├── LiveMap.jsx             # Leaflet map with incident + shelter markers
        │   ├── IncidentReportForm.jsx  # Full form with Cloudinary media upload
        │   ├── IncidentManagementPanel.jsx  # Admin controls for a single incident
        │   ├── IncidentToast.jsx       # Real-time new-incident popup
        │   ├── NotificationBell.jsx    # Unread badge + dropdown list
        │   ├── ResourceRequestModal.jsx # Citizen resource request form
        │   ├── WeatherWidget.jsx       # Compact / full weather card
        │   ├── ProtectedRoute.jsx      # Role-based route guard
        │   ├── ErrorBoundary.jsx       # Graceful crash fallback
        │   └── OfflineBanner.jsx       # Network status indicator
        ├── context/
        │   ├── AuthContext.jsx         # User state, token, all auth actions, Axios instance
        │   ├── SocketContext.jsx       # JWT-authenticated socket lifecycle
        │   └── NotificationContext.jsx # Unread count, real-time push
        ├── layouts/
        │   ├── AdminLayout.jsx         # Sidebar nav for admin
        │   ├── VolunteerLayout.jsx     # Sidebar nav for responder / shelter manager
        │   └── CitizenLayout.jsx       # Bottom nav for citizen
        └── constants/
            ├── incident.js             # Type icons, severity badges, status colours
            └── shelter.js              # Type metadata, amenity list, status badges
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **MongoDB** — local or [Atlas](https://www.mongodb.com/atlas)
- **Cloudinary** — for incident media uploads
- **Google AI Studio** — Gemini API key for triage
- **SMTP** — Gmail with an [App Password](https://support.google.com/accounts/answer/185833) works fine

### 1. Clone

```bash
git clone https://github.com/your-username/ResQAI.git
cd ResQAI
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run dev
```

```
  ResQAI Server
  ✓ MongoDB    connected
  ✓ Socket.IO  running
```

### 3. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

### 4. Create the first admin

```bash
# run from backend/
node seeds/createAdmin.js
```

The script prints the credentials. Log in with them, then use the **Invites** panel to onboard responders and shelter managers.

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|----------|:--------:|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Signing key — use at least 32 random characters |
| `PORT` | — | HTTP port (default `5000`) |
| `FRONTEND_URL` | — | CORS origin + email link base (default `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `EMAIL_HOST` | — | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | — | SMTP port (`587` for STARTTLS) |
| `EMAIL_SECURE` | — | `true` for port 465, `false` otherwise |
| `EMAIL_USER` | — | Sender address |
| `EMAIL_PASS` | — | App password |
| `CLOUDINARY_CLOUD_NAME` | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | — | Cloudinary API secret |
| `GEMINI_API_KEY` | — | Google Generative AI key |

The server exits immediately if `MONGO_URI` or `JWT_SECRET` are absent. Everything else degrades gracefully — missing credentials just disable that feature.

### `frontend/.env`

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend REST base URL (default `http://localhost:5000/api`) |
| `VITE_SOCKET_URL` | Socket.IO server URL (default `http://localhost:5000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for the sign-in button |

---

## API Overview

All routes are prefixed `/api`. Protected routes require `Authorization: Bearer <token>`.

| Resource | Prefix | Notes |
|----------|--------|-------|
| Auth | `/api/auth` | Most endpoints public |
| Incidents | `/api/incidents` | Role-filtered on `GET /` |
| Report (multipart) | `/api/report` | Up to 5 files |
| Shelters | `/api/shelters` | |
| Chat | `/api/chat` | |
| Resources | `/api/resources` | |
| Users | `/api/users` | Admin ops on `/:id/*` |
| Invites | `/api/invites` | Admin only |
| Analytics | `/api/analytics` | Admin only |
| Notifications | `/api/notifications` | |

Key endpoints worth knowing:

```
# Auth
POST   /api/auth/signup
POST   /api/auth/verify-otp
POST   /api/auth/resend-otp
POST   /api/auth/login
POST   /api/auth/google
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me

# Incidents
GET    /api/incidents
GET    /api/incidents/nearby          ?lat=&lng=&maxDistance=
POST   /api/incidents/sos
POST   /api/incidents/broadcast-alert
PATCH  /api/incidents/:id/status
PATCH  /api/incidents/:id/severity
POST   /api/incidents/:id/accept
POST   /api/incidents/:id/assign
DELETE /api/incidents/:id/assign/:responderId

# Shelters
GET    /api/shelters/nearby           ?lat=&lng=&maxDistance=
GET    /api/shelters/places           ?lat=&lng=&type=&radius=   (OSM)
POST   /api/shelters/:id/checkin
POST   /api/shelters/:id/checkout
PATCH  /api/shelters/:id/assign-manager
```

### Socket events

| Event | Direction | Description |
|-------|-----------|-------------|
| `newIncident` | Server → All | New incident reported |
| `incidentUpdated` | Server → All | Status, severity, or assignees changed |
| `sosAlert` | Server → All | SOS triggered |
| `sosAcknowledged` | Server → Citizen | A responder accepted their SOS |
| `newIncidentAssigned` | Server → Responder | Dispatch to a specific responder |
| `incidentEscalated` | Server → Admins | 15-min escalation with no acceptance |
| `alertBroadcast` | Server → All | Emergency broadcast from admin |
| `shelterUpdated` | Server → All | Shelter details changed |
| `shelterOccupancyUpdated` | Server → All | Check-in or check-out |
| `newResourceRequest` | Server → All | New resource request |
| `resourceRequestAcknowledged` | Server → All | Request claimed by a responder |
| `resourceRequestFulfilled` | Server → All | Request completed |
| `responderAvailabilityChanged` | Server → Admins | Duty status toggled |
| `notification` | Server → User | Personal in-app notification |
| `chat:newDM` | Server → User | Incoming direct message |
| `chat:typing` | Server → User | Typing indicator |
| `chat:onlineUsers` | Server → All | Updated presence list |
| `chat:incidentMessage` | Server → Room | Incident thread message |

---

## Security

| What | How |
|------|-----|
| HTTP headers | `helmet` — `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, CSP, and more |
| NoSQL injection | `express-mongo-sanitize` strips `$` operators and `.` from all inputs |
| Rate limiting | 200 req / 15 min globally; 15 req / 15 min on every auth endpoint |
| Passwords | bcrypt with 12 salt rounds; password field is `select: false` on the schema |
| OTP | bcrypt-hashed before storage; 10-min expiry; 5-attempt lockout; 60-sec resend cooldown |
| Password reset tokens | 32-byte random token in the email link; SHA-256 hash stored in DB only |
| JWT | `HS256`, validated on every protected request; Socket.IO connections also JWT-verified before any event is processed |
| Role isolation | Citizens get only their own incidents from `GET /api/incidents`; shelter manager mutations go through an ownership check |
| CORS | Scoped to `FRONTEND_URL`; credentials allowed |
| File uploads | `fileFilter` restricts to `image/*`, `video/*`, `audio/*`, `application/pdf`; 10 MB per file; 5 files max |
