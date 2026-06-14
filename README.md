# 69hitow MVP

69hitow to MVP aplikacji desktopowej z muzycznymi krzyżówkami. Projekt jest inspirowany ideą muzycznych zagadek, ale ma osobny branding, osobny wygląd i własną architekturę.

Monorepo zawiera:

```txt
music-crossword/
├── apps/
│   ├── desktop/       Electron + React + Vite + TypeScript
│   ├── admin/         React + Vite + TypeScript
│   └── api/           Express + TypeScript + Prisma + MySQL
├── packages/
│   └── shared/        wspólne typy, schematy Zod i normalizeAnswer()
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

## Wymagania

- Node.js 20+
- pnpm 9+
- MySQL 8+

## Instalacja

```bash
pnpm install
```

Skopiuj konfigurację:

```bash
cp .env.example .env
```

Dla serwera z panelem pod `admin.hity.mionix.pl` można zacząć od:

```bash
cp .env.production.example .env
```

Przykładowe wartości:

```env
DATABASE_URL="mysql://user:password@localhost:3306/music_crossword"
PORT=6969
JWT_SECRET="dlugi-losowy-sekret"
ADMIN_PASSWORD_HASH="$2b$12$..."
PUBLIC_API_URL="http://admin.hity.mionix.pl"
VITE_API_URL="http://admin.hity.mionix.pl"
VITE_ADMIN_PANEL_URL="http://admin.hity.mionix.pl"
DESKTOP_APP_VERSION="0.2.2"
DESKTOP_DOWNLOAD_URL="http://admin.hity.mionix.pl/downloads/69hitow-0.2.2-win-x64.exe"
DESKTOP_RELEASE_NOTES="Opis zmian widoczny w aplikacji"
```

## Hasło administratora

Wygeneruj bcrypt hash:

```bash
pnpm generate:admin-hash "twoje-haslo"
```

Wklej wynik do `ADMIN_PASSWORD_HASH` w `.env`.

## Baza danych i Prisma

Utwórz bazę w MySQL:

```sql
CREATE DATABASE music_crossword CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Wykonaj migrację:

```bash
pnpm --filter @music-crossword/api prisma:migrate
```

Na serwerze produkcyjnym użyj:

```bash
pnpm --filter @music-crossword/api prisma:migrate:deploy
```

W razie potrzeby sam generator Prisma:

```bash
pnpm --filter @music-crossword/api prisma:generate
```

## Uruchamianie lokalne

API:

```bash
pnpm --filter @music-crossword/api dev
```

Panel administratora:

```bash
pnpm --filter @music-crossword/admin dev
```

Aplikacja Electron gracza:

```bash
pnpm --filter @music-crossword/desktop dev
```

Można też uruchomić workspace równolegle:

```bash
pnpm dev
```

Domyślne adresy:

- API: `http://localhost:6969`
- Admin: `http://localhost:5174`
- Desktop renderer dev: `http://localhost:5173`

## Build i Windows

Sprawdzenie typów:

```bash
pnpm typecheck
```

Build wszystkich pakietów:

```bash
pnpm build
```

Przyszły build instalatora Windows:

```bash
pnpm --filter @music-crossword/desktop dist:win
```

Build produkcyjny pod `admin.hity.mionix.pl`:

```bash
PUBLIC_API_URL="http://admin.hity.mionix.pl" pnpm --filter @music-crossword/api build
VITE_API_URL="http://admin.hity.mionix.pl" pnpm --filter @music-crossword/admin build
VITE_API_URL="http://admin.hity.mionix.pl" VITE_ADMIN_PANEL_URL="http://admin.hity.mionix.pl" pnpm --filter @music-crossword/desktop dist:win
```

Panel administratora po buildzie można wystawić jako statyczne pliki z `apps/admin/dist` albo uruchomić podgląd produkcyjny:

```bash
pnpm --filter @music-crossword/admin preview
```

Konfiguracja `electron-builder` znajduje się w `apps/desktop/package.json`.

## Główne endpointy

Publiczne:

- `GET /api/health`
- `GET /api/app-version`
- `GET /api/crosswords`
- `GET /api/crosswords/:id`
- `POST /api/crosswords/:id/result`
- `POST /api/crosswords/:id/give-up`
- `POST /api/crosswords/:crosswordId/entries/:entryId/check`
- `POST /api/crosswords/:crosswordId/entries/:entryId/give-up`

Administrator:

- `POST /api/admin/login`
- `GET /api/admin/crosswords`
- `POST /api/admin/crosswords`
- `GET /api/admin/crosswords/:id`
- `PUT /api/admin/crosswords/:id`
- `POST /api/admin/crosswords/:id/entries`
- `PUT /api/admin/crosswords/:id/entries/:entryId`
- `DELETE /api/admin/crosswords/:id/entries/:entryId`
- `POST /api/admin/crosswords/:id/publish`
- `POST /api/admin/crosswords/:id/unpublish`
- `DELETE /api/admin/crosswords/:id`

Wszystkie endpointy `/api/admin/*` poza logowaniem wymagają nagłówka `Authorization: Bearer <JWT>`.

## Audio i ujawnianie metadanych

W MVP administrator dodaje gotowy krótki plik MP3. Backend przyjmuje wyłącznie `audio/mpeg`, limituje upload do 10 MB i zapisuje pliki w `apps/api/uploads/audio`.

Publiczne API nie zwraca odpowiedzi, `normalizedAnswer`, tytułu, wykonawcy ani linków Spotify/YouTube przed rozwiązaniem hasła. Po poprawnej odpowiedzi albo poddaniu hasła zwracane są pełna odpowiedź i metadane.

## Aplikacja desktopowa

Normalny interfejs gracza nie pokazuje panelu administratora. Ukryty skrót:

- Windows/Linux: `Ctrl + Shift + K`
- macOS: `Cmd + Shift + K`

Skrót otwiera zewnętrzny panel ustawiony przez `VITE_ADMIN_PANEL_URL` przez bezpieczne `shell.openExternal`.

Postęp gracza jest lokalny w Zustand persist: widziane plansze, rozwiązane i poddane hasła, wpisane odpowiedzi oraz ukończenie planszy.

Przy starcie aplikacja pobiera `GET /api/app-version`. Jeśli backend zwróci nowszą wersję niż wersja wbudowana w klienta, na ekranie głównym pojawi się przycisk pobrania instalatora z `DESKTOP_DOWNLOAD_URL`.

Po ukończeniu lub poddaniu krzyżówki klient wysyła anonimowy wynik do bazy przez publiczne API. Identyfikator gracza jest generowany lokalnie i zapisywany w localStorage, bez kont użytkowników i logowania.
