from flask import Flask, render_template, request, redirect, send_file, jsonify
import psycopg2
import os
from dotenv import load_dotenv
from openpyxl import Workbook

load_dotenv()

app = Flask(__name__)

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASS")
)

cur = conn.cursor()


@app.route("/",methods=["GET","POST"])
def home():

    if request.method=="POST":

        name=request.form["name"]
        candidate=request.form["candidate"]

        try:

            cur.execute("SELECT id FROM users WHERE name=%s",(name,))
            user=cur.fetchone()

            if not user:

                cur.execute(
                "INSERT INTO users (name) VALUES (%s) RETURNING id",
                (name,)
                )

                uid=cur.fetchone()[0]

                cur.execute(
                "INSERT INTO votes (user_id,candidate_id) VALUES (%s,%s)",
                (uid,candidate)
                )

                conn.commit()

        except:
            conn.rollback()

    cur.execute("SELECT * FROM candidates")
    candidates=cur.fetchall()

    return render_template("home.html",candidates=candidates)

@app.route("/admin",methods=["GET","POST"])
def admin():

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

app.run(host="0.0.0.0",port=5000)

