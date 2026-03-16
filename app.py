from flask import Flask, render_template_string, request, redirect
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("DB_HOST")
database = os.getenv("DATABASE")
user = os.getenv("DB_USER")
password = os.getenv("DB_PASSWORD")

app = Flask(__name__)

conn = psycopg2.connect(
    host=host,
    database=database,
    user=user,
    password=password
)

cur = conn.cursor()

HTML = """

<!DOCTYPE html>
<html>

<head>

<title>Voting System</title>

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

</head>

<body class="bg-dark text-white">

<div class="container mt-5">

<div class="card bg-secondary shadow-lg">

<div class="card-body">

<h2 class="text-center mb-4">🗳 Voting System</h2>

<form method="POST">

<div class="mb-3">

<label class="form-label">Your Name</label>

<input class="form-control" name="name" required>

</div>

<label class="form-label">Choose Candidate</label>

{% for c in candidates %}

<div class="form-check">

<input class="form-check-input" type="radio" name="candidate" value="{{c[0]}}" required>

<label class="form-check-label">

{{c[1]}}

</label>

</div>

{% endfor %}

<br>

<div class="d-grid">

<button class="btn btn-primary btn-lg">Vote</button>

</div>

</form>

<hr>

<div class="text-center">

<a href="/results" class="btn btn-warning">View Results</a>

</div>

</div>

</div>

</div>

</body>

</html>

"""

RESULT_HTML = """

<!DOCTYPE html>

<html>

<head>

<title>Results</title>

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

</head>

<body class="bg-dark text-white">

<div class="container mt-5">

<div class="card bg-secondary shadow">

<div class="card-body text-center">

<h2 class="mb-4">📊 Voting Results</h2>

<table class="table table-dark table-striped">

<thead>

<tr>

<th>Candidate</th>

<th>Votes</th>

</tr>

</thead>

<tbody>

{% for r in results %}

<tr>

<td>{{r[0]}}</td>

<td>{{r[1]}}</td>

</tr>

{% endfor %}

</tbody>

</table>

<a href="/" class="btn btn-light">Back to Vote</a>

</div>

</div>

</div>

</body>

</html>

"""

@app.route("/",methods=["GET","POST"])

def index():

    cur.execute("SELECT * FROM candidates")

    candidates = cur.fetchall()

    if request.method == "POST":

        name = request.form["name"]

        candidate = request.form["candidate"]

        cur.execute(

        "INSERT INTO users (name) VALUES (%s) RETURNING id",

        (name,)

        )

        user_id = cur.fetchone()[0]

        cur.execute(

        "INSERT INTO votes (user_id,candidate_id) VALUES (%s,%s)",

        (user_id,candidate)

        )

        conn.commit()

        return redirect("/results")

    return render_template_string(HTML,candidates=candidates)

@app.route("/results")

def results():

    cur.execute("""

    SELECT candidates.name,COUNT(votes.id)

    FROM candidates

    LEFT JOIN votes

    ON candidates.id=votes.candidate_id

    GROUP BY candidates.name

    """)

    results = cur.fetchall()

    return render_template_string(RESULT_HTML,results=results)

app.run(host="0.0.0.0",port=5000)

