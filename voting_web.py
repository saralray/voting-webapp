from flask import Flask, render_template, request, redirect, send_file, session
import psycopg2
import csv
import os 
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("DB_HOST")
database = os.getenv("DATABASE")
user = os.getenv("DB_USER")
password = os.getenv("DB_PASSWORD")


app = Flask(__name__)
app.secret_key = "supersecret"

conn = psycopg2.connect(
    host=host,
    database=database,
    user=user,
    password=password
)

cur = conn.cursor()

@app.route("/",methods=["GET","POST"])
def index():


    if "admin" not in session:
        return redirect("/login")

    error=None

    cur.execute("SELECT * FROM candidates")
    candidates=cur.fetchall()

    if request.method=="POST":

        name=request.form["name"]
        candidate=request.form["candidate"]

        try:

            cur.execute(
            "INSERT INTO users (name) VALUES (%s) RETURNING id",
            (name,)
            )

            user_id=cur.fetchone()[0]

            cur.execute(
            "INSERT INTO votes (user_id,candidate_id) VALUES (%s,%s)",
            (user_id,candidate)
            )

            conn.commit()

            return redirect("/results")

        except:

            conn.rollback()
            error="You already voted!"

    return render_template("index.html", candidates=candidates, error=error)

@app.route("/login", methods=["GET","POST"])
def login():

    error=None

    if request.method=="POST":

        username=request.form["username"]
        password=request.form["password"]

        cur.execute(
        "SELECT * FROM admins WHERE username=%s AND password=%s",
        (username,password)
        )

        admin=cur.fetchone()

        if admin:

            session["admin"]=username
            return redirect("/")

        else:
            error="Invalid login"

    return render_template("login.html",error=error)

@app.route("/logout")
def logout():

    session.pop("admin",None)
    return redirect("/login")

@app.route("/results")
def results():

    cur.execute("""
    SELECT candidates.name,COUNT(votes.id)
    FROM candidates
    LEFT JOIN votes
    ON candidates.id=votes.candidate_id
    GROUP BY candidates.name
    """)

    results=cur.fetchall()

    return render_template("results.html", results=results)

@app.route("/download")
def download():

    cur.execute("""
    SELECT candidates.name,COUNT(votes.id)
    FROM candidates
    LEFT JOIN votes
    ON candidates.id=votes.candidate_id
    GROUP BY candidates.name
    """)

    rows=cur.fetchall()

    with open("results.csv","w",newline="") as f:

        writer=csv.writer(f)
        writer.writerow(["Candidate","Votes"])

        for r in rows:
            writer.writerow(r)

    return send_file("results.csv",as_attachment=True)

app.run(host="0.0.0.0",port=5000)

