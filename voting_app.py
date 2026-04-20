from flask import Flask, render_template, request, redirect, send_file, jsonify, abort
import psycopg2
from psycopg2 import IntegrityError
import os
import random
import secrets
from io import BytesIO
from datetime import timedelta
from dotenv import load_dotenv
from openpyxl import Workbook
from authlib.integrations.flask_client import OAuth
from authlib.integrations.base_client.errors import MismatchingStateError
from flask import session, url_for
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

app = Flask(__name__)

app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

app.secret_key = os.getenv("SECRET_KEY")
app.config["SESSION_COOKIE_SECURE"] = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = os.getenv("SESSION_COOKIE_SAMESITE", "None")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)

DEFAULT_WHEEL_ITEMS = [
    "Reward 01",
    "Reward 02",
    "Reward 03",
    "Reward 04",
    "Reward 05",
    "Reward 06",
    "Reward 07",
    "Reward 08",
]

oauth = OAuth(app)

google = oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile"
    }
)


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
    )


def query_all(sql, params=None):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return cur.fetchall()


def query_one(sql, params=None):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return cur.fetchone()


def execute_write(sql, params=None, fetchone=False):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            result = cur.fetchone() if fetchone else None
        conn.commit()
    return result


def get_wheel_items_from_env():
    configured = os.getenv("WHEEL_ITEMS", "")
    items = [item.strip() for item in configured.split(",") if item.strip()]
    return items or DEFAULT_WHEEL_ITEMS


def ensure_seed_candidates():
    existing = query_one("SELECT COUNT(*) FROM candidates")
    if existing and existing[0] > 0:
        return

    for item in get_wheel_items_from_env():
        execute_write("INSERT INTO candidates (name) VALUES (%s)", (item,))


def get_candidates():
    return query_all("SELECT id, name FROM candidates ORDER BY id")


def get_user_vote(email):
    return query_one(
        """
        SELECT candidates.id, candidates.name
        FROM users
        JOIN votes ON votes.user_id = users.id
        JOIN candidates ON candidates.id = votes.candidate_id
        WHERE users.name = %s
        """,
        (email,),
    )


def get_vote_summary():
    return query_all(
        """
        SELECT candidates.id, candidates.name, COUNT(votes.id) AS total_votes
        FROM candidates
        LEFT JOIN votes ON candidates.id = votes.candidate_id
        GROUP BY candidates.id, candidates.name
        ORDER BY candidates.id
        """
    )

@app.route("/", methods=["GET"])
def home():
    if "user" not in session:
        return redirect("/login_page")

    if "spin_csrf" not in session:
        session["spin_csrf"] = secrets.token_urlsafe(24)

    email = session["user"]["email"]
    candidates = get_candidates()
    existing_vote = get_user_vote(email)
    return render_template(
        "home.html",
        candidates=candidates,
        existing_vote=existing_vote,
        wheel_count=len(candidates),
        csrf_token=session["spin_csrf"],
    )

@app.route("/login")
def login():
    session.clear()
    session.permanent = True
    redirect_uri = url_for("google_callback", _external=True, _scheme="https")
    return google.authorize_redirect(redirect_uri)

@app.route("/login/google/callback")
def google_callback():
    try:
        google.authorize_access_token()
    except MismatchingStateError:
        session.clear()
        return redirect("/login_page?error=session")
    except Exception:
        session.clear()
        return redirect("/login_page?error=google")

    # ✅ ดึง user จาก Google API
    user = google.get("https://www.googleapis.com/oauth2/v3/userinfo").json()

    session["user"] = {
        "name": user["name"],
        "email": user["email"],
        "picture": user["picture"]
    }
    session.permanent = True
    session["spin_csrf"] = secrets.token_urlsafe(24)

    return redirect("/")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

@app.route("/login_page")
def login_page():
    return render_template("login.html", error=request.args.get("error"))


@app.route("/spin", methods=["POST"])
def spin():
    if "user" not in session:
        return jsonify({"error": "Please login first"}), 401

    if request.headers.get("X-CSRF-Token") != session.get("spin_csrf"):
        return jsonify({"error": "Your session is no longer valid. Please refresh and try again."}), 403

    email = session["user"]["email"]
    existing_vote = get_user_vote(email)
    if existing_vote:
        return jsonify(
            {
                "error": "You already spun the wheel",
                "result": {
                    "candidate_id": existing_vote[0],
                    "candidate_name": existing_vote[1],
                },
            }
        ), 409

    candidates = get_candidates()
    if not candidates:
        return jsonify({"error": "Wheel options are not configured yet"}), 503

    winner = random.choice(candidates)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (name) VALUES (%s) RETURNING id",
                    (email,),
                )
                uid = cur.fetchone()[0]
                cur.execute(
                    "INSERT INTO votes (user_id, candidate_id) VALUES (%s, %s)",
                    (uid, winner[0]),
                )
            conn.commit()
    except IntegrityError:
        existing_vote = get_user_vote(email)
        return jsonify(
            {
                "error": "You already spun the wheel",
                "result": {
                    "candidate_id": existing_vote[0],
                    "candidate_name": existing_vote[1],
                },
            }
        ), 409

    winner_index = next(index for index, candidate in enumerate(candidates) if candidate[0] == winner[0])
    return jsonify(
        {
            "candidate_id": winner[0],
            "candidate_name": winner[1],
            "winner_index": winner_index,
            "total_segments": len(candidates),
        }
    )

@app.route("/admin", methods=["GET", "POST"])
def admin():
    abort(404)

@app.route("/delete/<id>")
def delete(id):
    abort(404)

@app.route("/reset",methods=["POST"])
def reset():
    abort(404)

@app.route("/dashboard")
def dashboard():
    return render_template("dash.html")

@app.route("/data")
def data():
    rows = get_vote_summary()
    labels = [r[1] for r in rows]
    votes = [r[2] for r in rows]
    total_votes = sum(votes)
    leaderboard = [
        {
            "candidate_id": r[0],
            "name": r[1],
            "votes": r[2],
            "share": round((r[2] / total_votes) * 100, 1) if total_votes else 0,
        }
        for r in rows
    ]
    return jsonify(
        {
            "labels": labels,
            "votes": votes,
            "total_votes": total_votes,
            "total_options": len(rows),
            "leaderboard": leaderboard,
        }
    )

@app.route("/excel")
def export_excel():
    rows = get_vote_summary()
    wb = Workbook()
    ws = wb.active
    ws.title = "Wheel Results"
    ws.append(["Candidate", "Votes"])

    for _, name, votes in rows:
        ws.append((name, votes))

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="wheel-results.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/health")
def health():
    candidate_count = query_one("SELECT COUNT(*) FROM candidates")[0]
    vote_count = query_one("SELECT COUNT(*) FROM votes")[0]
    return jsonify(
        {
            "status": "ok",
            "candidate_count": candidate_count,
            "vote_count": vote_count,
            "login_configured": bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET")),
        }
    )


ensure_seed_candidates()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
