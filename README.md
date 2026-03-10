# CSInvest

CSInvest is a CS2 portfolio and price-tracking app with a FastAPI backend and a React + Vite frontend.

## Stack

- Backend: FastAPI, SQLAlchemy, APScheduler
- Frontend: React, Vite
- Auth: JWT bearer tokens

## Quick Start

1. Create a backend env file at `csinvest-backend/.env`:

```env
DATABASE_URL=sqlite:///./csinvest.db
SECRET_KEY=your_long_random_secret
PASSWORD_SALT=your_custom_salt
INVITE_CODE=your_invite_code
CSFLOAT_API_KEY=
CSFLOAT_ENCRYPTION_KEY=
CSFLOAT_ENCRYPTION_LEGACY_KEYS=
ACCESS_TOKEN_EXPIRE_SECONDS=
```

2. Start the backend:

```powershell
cd csinvest-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

3. Start the frontend in a second terminal:

```powershell
cd csinvest-frontend
npm install
npm run dev
```

4. Open the app in your browser:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`