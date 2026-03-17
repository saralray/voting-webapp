from flask import Flask, render_template, request, redirect, send_file, jsonify
import psycopg2
import os
from dotenv import load_dotenv
from openpyxl import Workbook
from authlib.integrations.flask_client import OAuth
from flask import session, url_for
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

app = Flask(__name__)

app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASS")
)

cur = conn.cursor()

app.secret_key = os.getenv("SECRET_KEY")

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

@app.route("/",methods=["GET","POST"])
def home():

    if "user" not in session:
        return redirect("/login_page")

    email = session["user"]["email"]

    if request.method=="POST":

        candidate=request.form["candidate"]

        try:

            # เช็ค user จาก email
            cur.execute("SELECT id FROM users WHERE name=%s",(email,))
            user=cur.fetchone()

            if user:
                # ❌ ถ้าเคยโหวตแล้ว
                return "You already voted"

            # ✅ สร้าง user ใหม่
            cur.execute(
                "INSERT INTO users (name) VALUES (%s) RETURNING id",
                (email,)
            )

            uid=cur.fetchone()[0]

            # ✅ insert vote
            cur.execute(
                "INSERT INTO votes (user_id,candidate_id) VALUES (%s,%s)",
                (uid,candidate)
            )

            conn.commit()

        except Exception as e:
            conn.rollback()
            return str(e)

    cur.execute("SELECT * FROM candidates")
    candidates=cur.fetchall()

    return render_template("home.html",candidates=candidates)

@app.route("/login")
def login():
    redirect_uri = url_for("google_callback", _external=True, _scheme="https")
    return google.authorize_redirect(redirect_uri)

@app.route("/login/google/callback")
def google_callback():

    token = google.authorize_access_token()

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
    return render_template("login.html")

@app.route("/admin",methods=["GET","POST"])
def admin():

    if "user" not in session:
        return redirect("/login")

    email = session["user"]["email"]

    cur.execute("SELECT * FROM admins WHERE email=%s",(email,))
    admin = cur.fetchone()

    if not admin:
        return "Access Denied"

    if request.method=="POST":
        name=request.form["name"]

        if name:
            cur.execute("INSERT INTO candidates (name) VALUES (%s)",(name,))
            conn.commit()

    cur.execute("SELECT * FROM candidates")
    candidates=cur.fetchall()

    return render_template("admin.html",candidates=candidates)

@app.route("/delete/<id>")
def delete(id):

    cur.execute("DELETE FROM candidates WHERE id=%s",(id,))

    conn.commit()

    return redirect("/admin")

@app.route("/reset",methods=["POST"])
def reset():

    cur.execute("TRUNCATE votes,users RESTART IDENTITY CASCADE")

    conn.commit()

    return redirect("/admin")

@app.route("/dashboard")
def dashboard():

    return render_template("dash.html")

@app.route("/data")
def data():

    cur.execute("""

    SELECT candidates.name,COUNT(votes.id)

    FROM candidates

    LEFT JOIN votes

    ON candidates.id=votes.candidate_id

    GROUP BY candidates.name

    """)

    rows=cur.fetchall()

    labels=[r[0] for r in rows]

    votes=[r[1] for r in rows]

    return jsonify({"labels":labels,"votes":votes})

@app.route("/excel")
def export_excel():

    cur.execute("""

    SELECT candidates.name,COUNT(votes.id)

    FROM candidates

    LEFT JOIN votes

    ON candidates.id=votes.candidate_id

    GROUP BY candidates.name

    """)

    rows=cur.fetchall()

    wb=Workbook()

    ws=wb.active

    ws.append(["Candidate","Votes"])

    for r in rows:
        ws.append(r)

    file="results.xlsx"

    wb.save(file)

    return send_file(file,as_attachment=True)

app.run(host="0.0.0.0",port=8080)