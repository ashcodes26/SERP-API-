# AIMORA local browser ↔ FastAPI connection fix

This update sets the Expo web API base to `http://127.0.0.1:8000` and permits both `localhost:8081` and `127.0.0.1:8081` in backend CORS defaults. It also adds `mobile/.env` for browser development.

## Start the backend (PowerShell, terminal 1)

```powershell
cd aimora_phase5\backend
# If .env does not exist: Copy-Item .env.example .env
# Keep your existing .env and credentials if it already exists.
# If backend/.env exists, ensure CORS_ORIGINS includes BOTH http://localhost:8081 and http://127.0.0.1:8081
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/docs`. A 404 at `/` is expected: API routes live under `/api`.

## Start Expo web (PowerShell, terminal 2)

```powershell
cd aimora_phase5\mobile
npm install
npx expo start --web --clear
```

Open `http://localhost:8081`, sign in using your configured **backend** `.env` credentials. Restart Expo after changing `mobile/.env`.

### If it still cannot connect

- Open browser devtools > Network, select the failed `POST /api/auth/login` request.
- `ERR_CONNECTION_REFUSED`: backend not reachable on port 8000.
- `CORS` message: check `CORS_ORIGINS` **in your actual backend/.env**; that value overrides code defaults. Restart FastAPI after editing it.
- `401`: connectivity works but credentials are incorrect.
- `422`: payload validation; inspect response in Network.
- A request sent to `localhost:8000` means Expo has not reloaded `.env`; restart with `--clear`.

For Android on a physical phone, change mobile `.env` to the PC's LAN IP and start FastAPI with `--host 0.0.0.0`; `127.0.0.1` on the phone refers to the phone, not the PC. Do not expose development credentials or the backend to the public Internet.
