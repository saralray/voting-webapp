# System Flowchart

This document summarizes the current runtime flow of the voting application.

```mermaid
flowchart TD
    A[User opens login page route slash login_page] --> B[Click Login with Google]
    B --> C[Flask login route slash login]
    C --> D[Redirect to Google OAuth]
    D --> E[User authenticates with Google]
    E --> F[Flask callback route slash login slash google slash callback]
    F --> G[Google userinfo API]
    G --> H[Store user profile in Flask session]
    H --> I[Redirect to home page]

    I --> J[Load candidates from PostgreSQL]
    J --> K{User submits a vote}
    K -- No --> L[Render home page]
    K -- Yes --> M[Check voter email in users table]
    M --> N{Email already exists}
    N -- Yes --> O[Return You already voted]
    N -- No --> P[Insert user]
    P --> Q[Insert vote]
    Q --> R[Render response]

    S[Admin accesses route slash admin] --> T{Session exists}
    T -- No --> C
    T -- Yes --> U[Check email in admins table]
    U --> V{Authorized admin}
    V -- No --> W[Return Access Denied]
    V -- Yes --> X[Manage candidates or reset votes]

    Y[Dashboard page route slash dashboard] --> Z[Request data route slash data]
    Z --> AA[Aggregate votes by candidate]
    AA --> AB[Return JSON]

    AC[Excel export route slash excel] --> AD[Aggregate votes]
    AD --> AE[Generate XLSX with OpenPyXL]
    AE --> AF[Send file download]
```

## Main Components

- Browser client
- Flask application
- Google OAuth provider
- PostgreSQL database
- Optional reverse proxy such as Nginx or Cloudflare

## Notes

- The app trusts forwarded host and protocol headers through `ProxyFix`.
- Google OAuth depends on valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- The production callback URL must match the value configured in Google Cloud Console.
