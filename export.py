import psycopg2
import os
from dotenv import load_dotenv
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

load_dotenv()

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASS")
)

cur = conn.cursor()

cur.execute("""
SELECT users.name,candidates.name
FROM votes
JOIN users ON votes.user_id=users.id
JOIN candidates ON votes.candidate_id=candidates.id
""")

rows=cur.fetchall()

# ---------- Excel ----------
wb=Workbook()
ws=wb.active

ws.append(["User","Candidate"])

for r in rows:
    ws.append(r)

wb.save("votes.xlsx")

# ---------- PDF ----------
c=canvas.Canvas("votes.pdf",pagesize=letter)

y=750
c.drawString(50,y,"Voting Results")

y-=40

for r in rows:
    c.drawString(50,y,f"{r[0]} voted {r[1]}")
    y-=20

c.save()

print("Export complete")

