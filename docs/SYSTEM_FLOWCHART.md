# System Flowchart

This document summarizes the current runtime flow of the voting application.

```mermaid
flowchart TD
    A[Visitor opens slash] --> B[Load session from cookie]
    B --> C[Load candidates]
    C --> D[Load voting status from app_settings]
    D --> E{Signed in}
    E -- No --> F[Render landing page with sign-in CTA]
    E -- Yes --> G{Voting open}
    G -- No --> H[Render ballot as closed]
    G -- Yes --> I{Submit vote}
    I -- No --> J[Render ballot]
    I -- Yes --> K[Server action submitVote]
    K --> L[Check if iduser already exists in users table]
    L --> M{Already voted}
    M -- Yes --> N[Redirect with already-voted status]
    M -- No --> O[Insert user row]
    O --> P[Insert vote row]
    P --> Q[Revalidate pages and redirect]

    R[User opens slash login] --> S[Authenticate with iduser plus password]
    S --> T{Valid credentials}
    T -- No --> U[Return invalid or locked status]
    T -- Yes --> V[Create session token]
    V --> W[Set session cookie]
    W --> X[Redirect to slash]

    Y[User opens slash register] --> Z[Submit name, phone, password]
    Z --> AA[Create auth_users record with generated iduser]
    AA --> AB[Redirect to login with generated iduser]

    AC[Admin opens slash admin] --> AD[Require active session]
    AD --> AE{Admin allowed}
    AE -- No --> AF[Render access denied]
    AE -- Yes --> AG[Render admin panel]
    AG --> AH[Add candidate]
    AG --> AI[Delete candidate]
    AG --> AJ[Open or close voting]
    AG --> AK[Reset votes]

    AL[Dashboard route slash dashboard] --> AM[Client polls slash api slash results]
    AM --> AN[Aggregate votes by candidate]
    AN --> AO[Return JSON]

    AP[Export route slash api slash export] --> AQ[Load vote rows]
    AQ --> AR[Generate XLSX with xlsx package]
    AR --> AS[Send file download]
```

## Main Components

- Next.js App Router pages, route handlers, and server actions
- PostgreSQL database
- Local session-cookie authentication
- Docker-based deployment

## Notes

- Authentication data is stored separately from vote data.
- Voting availability is controlled through the `app_settings` table.
- Admin access is controlled through the `ADMIN_IDUSERS` environment variable.
