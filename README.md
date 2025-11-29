## CSInvest

Portfolio a cenové sledování CS2 skinů / case položek.

### Backend
FastAPI + SQLAlchemy. Ceny se aktualizují přes strategii `CSFloatStrategy`.

### Auth (Nově přidáno)
Jednoduché JWT (ruční HS256 implementace) pro registraci / přihlášení.

Endpointy:
- `POST /auth/register` body: `{ "username": "nick", "email": "mail@example.com", "password": "heslo" }`
- `POST /auth/login` body: `{ "username": "nick", "password": "heslo" }`
- `GET /auth/me` hlavička: `Authorization: Bearer <token>`

Odpověď login/register:
```json
{
	"access_token": "<JWT>",
	"token_type": "bearer",
	"user": { "user_id": 1, "username": "nick", "email": "mail@example.com" }
}
```

### .env konfigurace
Vytvořte `csinvest-backend/.env` podle vzoru `.env.example`:
```
DATABASE_URL=sqlite:///./csinvest.db
SECRET_KEY=dlouhy_nahodny_retezec
PASSWORD_SALT=vlastni_salt
CSFLOAT_API_KEY=volitelne
```

### Frontend
React + Vite. Token a uživatel se ukládají do `localStorage` (`csinvest:token`, `csinvest:user`).

### Bezpečnostní poznámka
Hesla jsou zatím hashována pouze salted SHA256 (nevhodné pro produkci). Doporučeno nahradit za bcrypt / argon2.

### Rychlý start
```
cd csinvest-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Frontend:
```
cd csinvest-frontend
npm install
npm run dev
```

### Licence
Interní projekt / zatím bez licence.