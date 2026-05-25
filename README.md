# ResQAI - Disaster & Crisis Management Platform

![ResQAI Banner](https://via.placeholder.com/1200x400.png?text=ResQAI+-+Disaster+Management+Platform)

ResQAI is a comprehensive, full-stack disaster and crisis management system designed to coordinate citizens, volunteers, and command centers during emergencies. It bridges the gap between those needing help (SOS reports, resource requests) and those providing relief (shelters, medical aid, volunteers) using real-time geolocation and intelligent triage AI.

## ðŸš€ Features

*   **Real-Time SOS & Incident Reporting:** Live socket-based emergency alerts mapping citizens to authorities instantly.
*   **Geospatial Tracking:** Map incidents and active shelters accurately using Google Maps / Leaflet.
*   **Intelligent Triage (AI):** Uses Google Gemini to analyze and categorize incoming distressed reports based on severity and type.
*   **Multi-Role Dashboards:** Unique, protected routing interfaces for `Citizens`, `Volunteers`, `Shelter Managers`, and `Admins`.
*   **Resource Management:** Track live inventory (Food, Water, Medical Supplies) and capacity within relief camps.
*   **Real-Time Chat Context:** Instant internal chat channels for volunteer coordination and quick dispatch.
*   **Data Driven Insights:** Analytics dashboard summarizing disaster hit zones, recovery times, and active alerts.

## ðŸ’¾ Tech Stack

**Frontend (Client)**
*   **React** (v19) via **Vite**
*   **TailwindCSS** + Shadcn UI components
*   **Zustand** & **TanStack React Query** (State & Data Fetching)
*   **React Router** (Protected layouts/roles)
*   **Socket.io-client** (Real-time updates)
*   **Leaflet & @react-google-maps** 

**Backend (Server)**
*   **Node.js & Express.js**
*   **MongoDB + Mongoose** (NoSQL & Geospatial Queries)
*   **Socket.io** (WebSockets)
*   **JWT & Passport/OAuth** (Role-based authentication)
*   **Cloudinary** (Media/Image management)
*   **Google Generative AI** (Gemini)

## ðŸ—‚ï¸  Installation & Setup

### Prerequisites
*   Node.js (v18+)
*   MongoDB Instance
*   Cloudinary Account 

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ResQAI.git
cd ResQAI
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Rename `backend/.env.example` to `backend/.env` and update the environment variables.

Run the server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```
Rename `frontend/.env.example` to `frontend/.env` and insert your frontend keys.

Run the client:
```bash
npm run dev
```

### 4. Admin Bootstrap
To create your first admin user, run the included Mongo seed script from the root `backend` directory:
```bash
node seeds/createAdmin.js
```

## ðŸ›¡ï¸  Security
*   **Helmet.js** to secure Express HTTP headers.
*   **express-mongo-sanitize** to prevent NoSQL Injection.
*   **express-rate-limit** attached to auth forms and API gateways.

## ðŸ”„ License
This project is open-source and available under the [MIT License](LICENSE).
