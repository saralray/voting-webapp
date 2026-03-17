# Voting Web Application

This is a web-based voting system built with Flask and PostgreSQL. It supports Google OAuth login, an admin panel for managing candidates, real-time vote visualization, and Excel export.

## Features

- Google OAuth login (secure authentication)
- One user can vote only once
- Admin panel for managing candidates
- Real-time dashboard using Chart.js
- Export voting results to Excel
- PostgreSQL database backend
- Deployed behind Cloudflare with HTTPS supportflask psycopg2-binary python-dotenv openpyxl authlib werkzeug

## Requirements

- Python 3.8+
- PostgreSQL
- Cloudflare (for DNS and HTTPS)

## Installation

### Clone the repository

    git clone https://github.com/saralray/voting-webapp.git
    cd voting-webapp

### Install dependencies
    
    pip install -r requirements.txt

### Setup environment variables

Create a .env file:

    DB_HOST=your_database_host
    DB_NAME=your_database_name
    DB_USER=your_database_user
    DB_PASS=your_database_password
    
    SECRET_KEY=your_secret_key
    
    GOOGLE_CLIENT_ID=your_client_id
    GOOGLE_CLIENT_SECRET=your_client_secret

## Database Setup

    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE
    );

    CREATE TABLE candidates (
        id SERIAL PRIMARY KEY,
        name TEXT
    );

    CREATE TABLE votes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        candidate_id INTEGER REFERENCES candidates(id),flask psycopg2-binary python-dotenv openpyxl authlib werkzeug
        UNIQUE(user_id)
    );

    CREATE TABLE admins (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE
    );

## Run

    python3 voting_app.py

## Deployment Notes

- Use Cloudflare proxy with SSL set to Full (strict)
- Google OAuth redirect URI must be HTTPS domain

