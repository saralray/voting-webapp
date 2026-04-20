from flask import Flask, render_template, request, redirect, send_file, jsonify, abort
import psycopg2
import os
import random
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

@app.route("/", methods=["GET"])
def home():
    if "user" not in session:
        return redirect("/login_page")

    email = session["user"]["email"]
    candidates = get_candidates()
    existing_vote = get_user_vote(email)
    return render_template(
        "home.html",
        candidates=candidates,
        existing_vote=existing_vote,
        wheel_count=len(candidates),
    )

@app.route("/login")
def login():
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
    uid = execute_write(
        "INSERT INTO users (name) VALUES (%s) RETURNING id",
        (email,),
        fetchone=True,
    )[0]
    execute_write(
        "INSERT INTO votes (user_id, candidate_id) VALUES (%s, %s)",
        (uid, winner[0]),
    )

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

    rows = query_all("""

    SELECT candidates.name,COUNT(votes.id)

    FROM candidates

    LEFT JOIN votes

    ON candidates.id=votes.candidate_id

    GROUP BY candidates.name

    """)

    labels=[r[0] for r in rows]

    votes=[r[1] for r in rows]

    return jsonify({"labels":labels,"votes":votes})

@app.route("/excel")
def export_excel():

    rows = query_all("""

    SELECT candidates.name,COUNT(votes.id)

    FROM candidates

    LEFT JOIN votes

    ON candidates.id=votes.candidate_id

    GROUP BY candidates.name

    """)

    wb=Workbook()

    ws=wb.active

    ws.append(["Candidate","Votes"])

    for r in rows:
        ws.append(r)

    file="results.xlsx"

    wb.save(file)

    return send_file(file,as_attachment=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
