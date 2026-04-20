# Voting Web Application

ระบบโหวตออนไลน์ด้วย Flask + PostgreSQL + Google OAuth ผู้ใช้ล็อกอินด้วย Google แล้วโหวตได้ 1 ครั้งต่อ 1 บัญชี แอดมินจัดการรายชื่อผู้สมัครได้ ดูผลรวมผ่านหน้า dashboard และดาวน์โหลดผลเป็น Excel ได้

## ภาพรวมระบบ

ลำดับการทำงานหลักของระบบ:

1. ผู้ใช้เข้า `/login_page`
2. กด `Login with Google`
3. ระบบ redirect ไป Google OAuth
4. เมื่อล็อกอินสำเร็จ ระบบเก็บข้อมูลผู้ใช้ใน session
5. ผู้ใช้เลือก candidate และ submit vote
6. ระบบตรวจจากอีเมลว่าเคยโหวตแล้วหรือยัง
7. ถ้ายังไม่เคย ระบบจะบันทึก `users` และ `votes`
8. แอดมินเข้า `/admin` เพื่อเพิ่ม ลบ candidate หรือ reset votes
9. หน้า `/dashboard` ดึงข้อมูลจาก `/data` มาแสดงผลกราฟ
10. หน้า `/excel` สร้างไฟล์สรุปผล `.xlsx`

เวอร์ชันใน repo นี้เป็นเวอร์ชันหน้าตาและ flow แบบเดียวกับต้นฉบับบนเซิร์ฟเวอร์อ้างอิง ไม่ใช่เวอร์ชัน lucky wheel

## ฟีเจอร์

- ล็อกอินด้วย Google
- จำกัด 1 บัญชี Google ต่อ 1 โหวต
- แอดมินเพิ่ม candidate ได้
- แอดมินลบ candidate ได้
- แอดมิน reset ผู้ใช้และผลโหวตได้
- Dashboard แสดงกราฟผลโหวตแบบสด
- Export ผลโหวตเป็น Excel
- รองรับการรันผ่าน Docker
- รองรับ reverse proxy ด้วย `ProxyFix`

## Tech Stack

- Backend: Flask
- Database: PostgreSQL
- Auth: Authlib + Google OAuth 2.0
- Frontend: HTML + Bootstrap
- Chart: Chart.js
- Excel Export: OpenPyXL
- Production Server: Gunicorn
- Container: Docker + Docker Compose

## Route ทั้งหมด

| Route | Method | รายละเอียด |
| --- | --- | --- |
| `/` | `GET`, `POST` | หน้าโหวตหลักและส่งผลโหวต |
| `/login_page` | `GET` | หน้า login |
| `/login` | `GET` | เริ่ม Google OAuth |
| `/login/google/callback` | `GET` | callback จาก Google |
| `/logout` | `GET` | ล้าง session |
| `/admin` | `GET`, `POST` | หน้า admin และเพิ่ม candidate |
| `/delete/<id>` | `GET` | ลบ candidate |
| `/reset` | `POST` | reset ตาราง users และ votes |
| `/dashboard` | `GET` | หน้าแสดงผลกราฟ |
| `/data` | `GET` | ส่งข้อมูลผลโหวตเป็น JSON |
| `/excel` | `GET` | ดาวน์โหลดผลเป็นไฟล์ Excel |

## Flow การทำงาน

```mermaid
flowchart TD
    A[เปิด /login_page] --> B[กด Login with Google]
    B --> C[/login]
    C --> D[Google OAuth]
    D --> E[/login/google/callback]
    E --> F[เก็บ user ลง session]
    F --> G[/]
    G --> H{ส่งโหวตไหม}
    H -- ไม่ --> I[แสดงรายชื่อ candidate]
    H -- ใช่ --> J[เช็ก users จาก email]
    J --> K{เคยโหวตแล้วหรือยัง}
    K -- ใช่ --> L[คืนข้อความ You already voted]
    K -- ยัง --> M[เพิ่ม user]
    M --> N[เพิ่ม vote]
    N --> O[แสดงหน้าหลัก]

    P[/admin] --> Q{ล็อกอินหรือยัง}
    Q -- ไม่ --> C
    Q -- ใช่ --> R[เช็กในตาราง admins]
    R --> S{เป็น admin หรือไม่}
    S -- ไม่ --> T[Access Denied]
    S -- ใช่ --> U[จัดการ candidate หรือ reset votes]

    V[/dashboard] --> W[/data]
    W --> X[aggregate ผลโหวต]
    X --> Y[render chart]

    Z[/excel] --> AA[aggregate ผลโหวต]
    AA --> AB[สร้างไฟล์ xlsx]
    AB --> AC[ดาวน์โหลด]
```

ไฟล์ diagram แยก: [docs/SYSTEM_FLOWCHART.md](/home/thiraphat/voting-webapp/docs/SYSTEM_FLOWCHART.md)

## โครงสร้างโปรเจกต์

```text
voting-webapp/
├── voting_app.py
├── export.py
├── schema.sql
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── templates/
│   ├── home.html
│   ├── login.html
│   ├── admin.html
│   └── dash.html
├── docs/
│   └── SYSTEM_FLOWCHART.md
└── README.md
```

## โครงสร้างฐานข้อมูล

ไฟล์ schema: [schema.sql](/home/thiraphat/voting-webapp/schema.sql)

ตารางหลัก:

- `users` เก็บอีเมลผู้โหวต
- `candidates` เก็บรายชื่อผู้สมัคร
- `votes` เก็บความสัมพันธ์ระหว่างผู้ใช้กับ candidate
- `admins` เก็บอีเมลของแอดมิน

กติกา:

- `users.name` เป็น unique
- `votes.user_id` เป็น unique
- 1 บัญชี Google โหวตได้ 1 ครั้ง

## Environment Variables

ให้สร้าง `.env` จาก [`.env.example`](/home/thiraphat/voting-webapp/.env.example)

```env
APP_PORT=8081

DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=voting
DB_USER=postgres
DB_PASS=change-me

SECRET_KEY=change-this-secret-key

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

ความหมายของตัวแปร:

- `APP_PORT` พอร์ตฝั่ง host ที่จะเปิดให้เข้าเว็บ
- `DB_HOST` ที่อยู่ PostgreSQL
- `DB_PORT` พอร์ต PostgreSQL
- `DB_NAME` ชื่อฐานข้อมูล
- `DB_USER` ชื่อผู้ใช้ฐานข้อมูล
- `DB_PASS` รหัสผ่านฐานข้อมูล
- `SECRET_KEY` ค่า secret ของ Flask session
- `GOOGLE_CLIENT_ID` Google OAuth client id
- `GOOGLE_CLIENT_SECRET` Google OAuth client secret

## Google OAuth Setup

ตั้งค่าที่ Google Cloud Console ดังนี้:

1. เข้า `APIs & Services`
2. ไปที่ `Credentials`
3. สร้างหรือแก้ `OAuth 2.0 Client ID`
4. เลือกประเภท `Web application`
5. เพิ่ม callback URL ให้ตรงกับ URL ของระบบ

ตัวอย่าง callback:

```text
https://your-domain/login/google/callback
```

ข้อสำคัญ:

ในโค้ดตอนนี้ route `/login` สร้าง callback แบบนี้:

```python
url_for("google_callback", _external=True, _scheme="https")
```

ดังนั้น callback จะเป็น `https` เสมอ ถ้า deploy หลัง reverse proxy หรือ domain จริง ต้องตั้ง Google OAuth ให้ตรงกับ URL นั้นแบบเป๊ะ

## วิธีรันในเครื่อง

### 1. สร้าง virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. ติดตั้ง dependency

```bash
pip install -r requirements.txt
```

### 3. สร้างฐานข้อมูล

ตัวอย่าง:

```bash
createdb voting
psql -d voting -f schema.sql
```

### 4. เพิ่มแอดมินอย่างน้อย 1 คน

ตัวอย่าง:

```sql
INSERT INTO admins (email) VALUES ('your-admin@gmail.com');
```

### 5. สร้าง `.env`

```bash
cp .env.example .env
```

แล้วใส่ค่าจริงของ database และ Google OAuth

### 6. รันแอป

```bash
python3 voting_app.py
```

ค่า default ของแอป:

```text
http://127.0.0.1:8080
```

## วิธี deploy ด้วย Docker

เริ่มรัน:

```bash
docker compose up -d --build
```

ดู log:

```bash
docker compose logs -f
```

หยุด:

```bash
docker compose down
```

หมายเหตุ:

- container เปิดพอร์ตภายในที่ `8080`
- พอร์ตภายนอกถูกกำหนดด้วย `APP_PORT`
- `docker-compose.yml` โหลดค่าจาก `.env`
- Gunicorn ใช้ app object จาก `voting_app:app`

## Deploy สำหรับเครื่อง `10.33.1.34`

กรณี deploy ไปเครื่องนี้ โครงสร้างที่ใช้อยู่คือ:

- app path: `~/voting-webapp`
- run ผ่าน `docker compose`
- เปิดเว็บผ่านพอร์ต `8083`

ตัวอย่าง `.env` สำหรับเครื่องนี้:

```env
APP_PORT=8083
DB_HOST=10.33.1.34
DB_PORT=5432
DB_NAME=voting
DB_USER=voting_app
DB_PASS=your-db-password

SECRET_KEY=your-secret-key

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

ขั้นตอน deploy:

```bash
cd ~/voting-webapp
docker compose up -d --build
```

เช็กสถานะ:

```bash
docker ps
curl -I http://127.0.0.1:8083/login_page
```

URL ใช้งานใน LAN:

```text
http://10.33.1.34:8083
```

ถ้าจะใช้ Google login จริงบนเครื่องนี้ ต้องเช็กว่า callback URL ใน Google Cloud ตรงกับ URL ที่เปิดใช้งานจริง

## วิธีใช้ฝั่งแอดมิน

ผู้ใช้ที่จะเข้า `/admin` ได้ ต้องมีอีเมลอยู่ในตาราง `admins`

ตัวอย่าง:

```sql
INSERT INTO admins (email) VALUES ('your-admin@gmail.com');
```

สิ่งที่หน้า admin ทำได้:

- เพิ่ม candidate
- ลบ candidate
- reset `users` และ `votes`

## รูปแบบข้อมูลจาก `/data`

ตัวอย่าง response:

```json
{
  "labels": ["Alice", "Bob"],
  "votes": [3, 5]
}
```

## Export Excel

route `/excel` จะสร้างไฟล์ `.xlsx` ที่เก็บ:

- ชื่อ candidate
- จำนวน vote

## Reverse Proxy และ HTTPS

แอปรองรับ reverse proxy ผ่าน:

```python
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
```

ถ้า deploy หลัง Nginx, Traefik หรือ Cloudflare:

- ต้อง forward `X-Forwarded-Proto`
- ต้อง forward `Host`
- URL public ต้องตรงกับ callback URL ใน Google OAuth

## ข้อจำกัดของเวอร์ชันปัจจุบัน

- ใช้ global database connection และ cursor
- `/delete/<id>` ยังใช้ `GET`
- callback OAuth ถูก fix เป็น `https`
- ยังไม่มี `/health`
- โค้ดค่อนข้างตรงไปตรงมาตามเวอร์ชันต้นฉบับ ยังไม่ได้ refactor สำหรับ production scale สูง

## ปัญหาที่พบบ่อย

### `redirect_uri_mismatch`

สาเหตุ:

- callback URL ใน Google Cloud Console ไม่ตรงกับที่แอปสร้าง

วิธีแก้:

- เพิ่ม URL callback ที่ตรงจริงใน Google Cloud Console

### เข้า `/admin` แล้วขึ้น `Access Denied`

สาเหตุ:

- อีเมล Google ยังไม่อยู่ในตาราง `admins`

วิธีแก้:

- เพิ่มอีเมลนั้นลงใน `admins`

### ขึ้น `You already voted`

สาเหตุ:

- บัญชีนี้เคยโหวตแล้ว

วิธีแก้:

- เป็น behavior ปกติ
- ถ้าจะทดสอบใหม่ ให้ reset ผ่าน `/admin`

### ต่อ PostgreSQL ไม่ได้

ให้เช็ก:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- firewall และ listen address ของ PostgreSQL

## Security Notes

- ห้าม commit `.env`
- ถ้า secret เคยหลุด ให้ rotate ทันที
- ใช้ `SECRET_KEY` ที่เดายาก
- จำกัดอีเมลแอดมินเฉพาะคนที่เชื่อถือได้
- ถ้าเปิดใช้งานจริง ควรใช้ HTTPS

## License

ตอนนี้ repo ยังไม่มีไฟล์ license ถ้าจะเผยแพร่ต่อสาธารณะควรเพิ่มให้ชัดเจน
