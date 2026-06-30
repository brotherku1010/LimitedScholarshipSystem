import os
import sqlite3
import uuid
import csv
import io
import shutil
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, render_template, send_from_directory, make_response, session

app = Flask(__name__)
app.secret_key = 'guge_super_secure_session_key_for_admin_and_students_12345'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ----------------- Database Setup & Seeding -----------------
DB_FILE = 'scholarship.db'

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if the table invitations still exists, or if students has the right columns
    try:
        cursor.execute("SELECT nickname FROM students LIMIT 1")
    except sqlite3.OperationalError:
        # Table doesn't exist or is in old schema format, drop to recreate
        cursor.execute("DROP TABLE IF EXISTS invitations")
        cursor.execute("DROP TABLE IF EXISTS students")
        cursor.execute("DROP TABLE IF EXISTS applications")
        cursor.execute("DROP TABLE IF EXISTS settings")
        conn.commit()
    
    # Create students table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            name TEXT NOT NULL,
            birthday TEXT NOT NULL,
            nickname TEXT,
            school TEXT,
            department TEXT,
            grade TEXT,
            max_challenge INTEGER DEFAULT 8,
            PRIMARY KEY (name, birthday)
        )
    ''')
    
    # Create applications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,          -- 'challenge', 'progress', 'blueprint'
            status TEXT NOT NULL,        -- 'pending', 'approved', 'destroyed'
            created_at TEXT NOT NULL,
            student_name TEXT NOT NULL,
            student_birthday TEXT NOT NULL,
            name TEXT,                   -- Student name (PII - to be destroyed)
            gpa REAL,                    -- Grade (float)
            prev_gpa REAL,               -- Previous Grade (for progress)
            credits INTEGER,             -- Credits (for progress)
            challenge_target REAL,       -- Score target (87.58, etc.)
            amount INTEGER,              -- Calculated/Assigned scholarship amount
            bank_code TEXT,              -- Bank code (PII - to be destroyed)
            bank_account TEXT,           -- Bank account (PII - to be destroyed)
            file_path TEXT,              -- Uploaded file path (PII - to be destroyed)
            prev_file_path TEXT,         -- Previous report path (PII - to be destroyed)
            project_name TEXT,           -- For blueprint (non-PII)
            project_month TEXT,          -- For blueprint (non-PII)
            destruction_time TEXT,       -- Time when PII was destroyed
            FOREIGN KEY (student_name, student_birthday) REFERENCES students(name, birthday)
        )
    ''')
    
    # Create settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    conn.commit()

    # Seed mock student profiles
    cursor.execute("SELECT COUNT(*) FROM students")
    if cursor.fetchone()[0] == 0:
        students_data = [
            ('王小明', '0918', '小明', '國立台灣大學', '資訊工程學系', '大二', 8),
            ('李小華', '0520', '小華', '國立清華大學', '電機工程學系', '大三', 8),
            ('張大同', '1225', '大同', '國立陽明交通大學', '機械工程學系', '大四', 8)
        ]
        cursor.executemany('''
            INSERT INTO students (name, birthday, nickname, school, department, grade, max_challenge) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', students_data)
        conn.commit()

    # Seed default configurations
    cursor.execute("SELECT COUNT(*) FROM settings")
    if cursor.fetchone()[0] == 0:
        default_settings = [
            ('progress_base', '1500'),
            ('progress_conversion_rate', '50'),
            ('challenge_amounts', '7000,8500,10000,12000,15000,18000,20000,25000'),
            ('blueprint_amount', '30000'),
            ('admin_password', 'guge_admin_secret_999')
        ]
        cursor.executemany("INSERT INTO settings (key, value) VALUES (?, ?)", default_settings)
        conn.commit()

    # Create a mock report card file in static/uploads
    mock_file_name = 'mock_report.svg'
    mock_file_path = os.path.join(app.config['UPLOAD_FOLDER'], mock_file_name)
    if not os.path.exists(mock_file_path):
        mock_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#ffffff" stroke="#1b263b" stroke-width="8"/>
  <!-- Decorative Frame -->
  <rect x="20" y="20" width="760" height="960" fill="none" stroke="#ffd166" stroke-width="2"/>
  
  <!-- Header -->
  <text x="400" y="100" font-family="'Courier New', monospace" font-size="28" font-weight="bold" fill="#0d1b2a" text-anchor="middle">國立古哥大學 學期成績單</text>
  <text x="400" y="130" font-family="sans-serif" font-size="14" fill="#666" text-anchor="middle">National Guge University - Official Transcript</text>
  
  <!-- Seal/Stamp Graphic -->
  <circle cx="680" cy="130" r="50" fill="none" stroke="#d62828" stroke-width="3" stroke-dasharray="5,2"/>
  <text x="680" y="125" font-family="sans-serif" font-size="12" font-weight="bold" fill="#d62828" text-anchor="middle">古哥大學</text>
  <text x="680" y="142" font-family="sans-serif" font-size="10" font-weight="bold" fill="#d62828" text-anchor="middle">教務處章</text>

  <!-- Student Info -->
  <line x1="50" y1="180" x2="750" y2="180" stroke="#0d1b2a" stroke-width="2"/>
  <text x="60" y="210" font-family="sans-serif" font-size="16" font-weight="bold" fill="#1b263b">學生姓名：王小明</text>
  <text x="320" y="210" font-family="sans-serif" font-size="16" font-weight="bold" fill="#1b263b">學號：N11209043</text>
  <text x="560" y="210" font-family="sans-serif" font-size="16" font-weight="bold" fill="#1b263b">學系：資訊工程學系</text>
  <text x="60" y="240" font-family="sans-serif" font-size="16" fill="#1b263b">學年度：114 學年度</text>
  <text x="320" y="240" font-family="sans-serif" font-size="16" fill="#1b263b">學期：第一學期</text>
  <line x1="50" y1="260" x2="750" y2="260" stroke="#0d1b2a" stroke-width="2"/>

  <!-- Grades Table -->
  <text x="60" y="300" font-family="sans-serif" font-size="18" font-weight="bold" fill="#0d1b2a">科目成績明細</text>
  
  <rect x="50" y="320" width="700" height="40" fill="#f8f9fa" stroke="#ccc" stroke-width="1"/>
  <text x="80" y="345" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333">課號</text>
  <text x="180" y="345" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333">科目名稱</text>
  <text x="450" y="345" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">學分</text>
  <text x="580" y="345" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">成績</text>
  <text x="680" y="345" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">等第</text>

  <!-- Row 1 -->
  <rect x="50" y="360" width="700" height="50" fill="#fff" stroke="#eee" stroke-width="1"/>
  <text x="80" y="390" font-family="sans-serif" font-size="14" fill="#555">CS301</text>
  <text x="180" y="390" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1b263b">演算法 (Algorithms)</text>
  <text x="450" y="390" font-family="sans-serif" font-size="14" fill="#555" text-anchor="middle">3</text>
  <text x="580" y="390" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0d1b2a" text-anchor="middle">91</text>
  <text x="680" y="390" font-family="sans-serif" font-size="14" fill="#0d1b2a" text-anchor="middle">A</text>

  <!-- Row 2 -->
  <rect x="50" y="410" width="700" height="50" fill="#fcfcfc" stroke="#eee" stroke-width="1"/>
  <text x="80" y="440" font-family="sans-serif" font-size="14" fill="#555">CS302</text>
  <text x="180" y="440" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1b263b">計算機網路 (Computer Networks)</text>
  <text x="450" y="440" font-family="sans-serif" font-size="14" fill="#555" text-anchor="middle">3</text>
  <text x="580" y="440" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0d1b2a" text-anchor="middle">88</text>
  <text x="680" y="440" font-family="sans-serif" font-size="14" fill="#0d1b2a" text-anchor="middle">A-</text>

  <!-- Row 3 -->
  <rect x="50" y="460" width="700" height="50" fill="#fff" stroke="#eee" stroke-width="1"/>
  <text x="80" y="490" font-family="sans-serif" font-size="14" fill="#555">CS303</text>
  <text x="180" y="490" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1b263b">軟體工程 (Software Engineering)</text>
  <text x="450" y="490" font-family="sans-serif" font-size="14" fill="#555" text-anchor="middle">3</text>
  <text x="580" y="490" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0d1b2a" text-anchor="middle">95</text>
  <text x="680" y="490" font-family="sans-serif" font-size="14" fill="#0d1b2a" text-anchor="middle">A+</text>

  <!-- Row 4 -->
  <rect x="50" y="510" width="700" height="50" fill="#fcfcfc" stroke="#eee" stroke-width="1"/>
  <text x="80" y="540" font-family="sans-serif" font-size="14" fill="#555">CS304</text>
  <text x="180" y="540" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1b263b">編譯器設計 (Compiler Design)</text>
  <text x="450" y="540" font-family="sans-serif" font-size="14" fill="#555" text-anchor="middle">3</text>
  <text x="580" y="540" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0d1b2a" text-anchor="middle">85</text>
  <text x="680" y="540" font-family="sans-serif" font-size="14" fill="#0d1b2a" text-anchor="middle">B+</text>

  <!-- Row 5 -->
  <rect x="50" y="560" width="700" height="50" fill="#fff" stroke="#eee" stroke-width="1"/>
  <text x="80" y="590" font-family="sans-serif" font-size="14" fill="#555">CS305</text>
  <text x="180" y="590" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1b263b">人工智慧導論 (Intro to AI)</text>
  <text x="450" y="590" font-family="sans-serif" font-size="14" fill="#555" text-anchor="middle">3</text>
  <text x="580" y="590" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0d1b2a" text-anchor="middle">87</text>
  <text x="680" y="590" font-family="sans-serif" font-size="14" fill="#0d1b2a" text-anchor="middle">B+</text>

  <!-- Summary Statistics -->
  <rect x="50" y="630" width="700" height="80" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
  <text x="80" y="675" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">實得學分：15 學分</text>
  <text x="320" y="675" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">當學期總平均：89.20 分</text>
  <text x="600" y="675" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">操行評等：A</text>
  
  <!-- Verification Footnote -->
  <text x="400" y="760" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle">本成績單由國立古哥大學教務系統自動生成，影本與正本相符。</text>
  
  <!-- Verification Barcode (vector representations) -->
  <rect x="250" y="800" width="300" height="50" fill="#000000"/>
  <rect x="260" y="805" width="5" height="40" fill="#ffffff"/>
  <rect x="270" y="805" width="2" height="40" fill="#ffffff"/>
  <rect x="275" y="805" width="8" height="40" fill="#ffffff"/>
  <rect x="290" y="805" width="4" height="40" fill="#ffffff"/>
  <rect x="300" y="805" width="10" height="40" fill="#ffffff"/>
  <rect x="315" y="805" width="2" height="40" fill="#ffffff"/>
  <rect x="325" y="805" width="6" height="40" fill="#ffffff"/>
  <rect x="340" y="805" width="3" height="40" fill="#ffffff"/>
  <rect x="350" y="805" width="7" height="40" fill="#ffffff"/>
  <rect x="365" y="805" width="1" height="40" fill="#ffffff"/>
  <rect x="370" y="805" width="8" height="40" fill="#ffffff"/>
  <rect x="385" y="805" width="4" height="40" fill="#ffffff"/>
  <rect x="395" y="805" width="2" height="40" fill="#ffffff"/>
  <rect x="405" y="805" width="9" height="40" fill="#ffffff"/>
  <rect x="420" y="805" width="3" height="40" fill="#ffffff"/>
  <rect x="430" y="805" width="6" height="40" fill="#ffffff"/>
  <rect x="440" y="805" width="1" height="40" fill="#ffffff"/>
  <rect x="450" y="805" width="12" height="40" fill="#ffffff"/>
  <rect x="470" y="805" width="2" height="40" fill="#ffffff"/>
  <rect x="480" y="805" width="5" height="40" fill="#ffffff"/>
  <rect x="490" y="805" width="3" height="40" fill="#ffffff"/>
  <rect x="500" y="805" width="8" height="40" fill="#ffffff"/>
  <rect x="515" y="805" width="2" height="40" fill="#ffffff"/>
  <rect x="525" y="805" width="15" height="40" fill="#ffffff"/>
  
  <text x="400" y="870" font-family="'Courier New', monospace" font-size="12" fill="#000" text-anchor="middle">*NGU-VERIFY-11209043-89.20*</text>
  
  <!-- Stamp Footer -->
  <line x1="50" y1="910" x2="750" y2="910" stroke="#cbd5e1" stroke-dasharray="4,4"/>
  <text x="400" y="935" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">個資銷毀保證：本文件經系統比對完畢，將於匯款後 7 日內隨同所有申請記錄實體刪除銷毀，不予留存。</text>
</svg>"""
        with open(mock_file_path, 'w', encoding='utf-8') as f:
            f.write(mock_svg)

    # Seed mock application data for demonstration
    cursor.execute("SELECT COUNT(*) FROM applications")
    if cursor.fetchone()[0] == 0:
        # 1 Pending application (for double-screen audit demo)
        app_id_1 = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO applications (
                id, type, status, created_at, student_name, student_birthday, name, gpa, 
                challenge_target, amount, bank_code, bank_account, file_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            app_id_1, 'challenge', 'pending', datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '王小明', '0918', '王小明', 89.20, 88.55, 8500, '008', '123-456-789012', mock_file_name
        ))
        
        # 2 Already destroyed cases (statistics history only, PII is null)
        app_id_2 = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO applications (
                id, type, status, created_at, student_name, student_birthday, name, 
                challenge_target, amount, destruction_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            app_id_2, 'challenge', 'destroyed', '2026-06-25 10:14:32',
            '李小華', '0520', '李*華', 87.58, 7000, '2026-06-25 18:30:00'
        ))

        app_id_3 = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO applications (
                id, type, status, created_at, student_name, student_birthday, name, 
                amount, destruction_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            app_id_3, 'progress', 'destroyed', '2026-06-26 14:02:11',
            '張大同', '1225', '張*同', 4333, '2026-06-26 18:30:00'
        ))
        
        conn.commit()
    conn.close()

def get_all_settings(cursor):
    cursor.execute("SELECT key, value FROM settings")
    rows = cursor.fetchall()
    settings_dict = {}
    for r in rows:
        key = r['key']
        val = r['value']
        if key == 'admin_password':
            continue
        if key in ['progress_base', 'progress_conversion_rate', 'blueprint_amount']:
            settings_dict[key] = int(val)
        elif key == 'challenge_amounts':
            settings_dict[key] = [int(x) for x in val.split(',')]
        else:
            settings_dict[key] = val
    return settings_dict

# ----------------- Routes & Web Pages -----------------

@app.route('/')
def index():
    return render_template('index.html')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return jsonify({'success': False, 'message': '未授權的操作，請先登入管理端！'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    data = request.get_json() or {}
    password = data.get('password', '').strip()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'admin_password'")
    row = cursor.fetchone()
    conn.close()
    
    if not row or password != row['value']:
        return jsonify({'success': False, 'message': '密碼錯誤，拒絕登入後台管理端！'}), 401
        
    session['admin_logged_in'] = True
    return jsonify({'success': True, 'message': '管理端驗證登入成功！'})

@app.route('/api/admin/logout', methods=['POST'])
def api_admin_logout():
    session.pop('admin_logged_in', None)
    return jsonify({'success': True, 'message': '已登出管理端身分！'})

@app.route('/admin')
def admin():
    if not session.get('admin_logged_in'):
        return render_template('admin_login.html')
    return render_template('admin.html')

# Serve uploaded files securely
@app.route('/static/uploads/<path:filename>')
def custom_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ----------------- APIs for Students -----------------

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    birthday = data.get('birthday', '').strip()
    
    if not name or not birthday:
        return jsonify({'success': False, 'message': '請填寫中文姓名與生日！'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    # Query student profile
    cursor.execute("SELECT * FROM students WHERE name = ? AND birthday = ?", (name, birthday))
    student = cursor.fetchone()
    
    if not student:
        conn.close()
        return jsonify({
            'success': False, 
            'code': 'NOT_REGISTERED', 
            'message': '系統未偵測到此身分紀錄。若您是首次登入，請填寫下方基本資料以完成計畫註冊！'
        }), 200
        
    # Get previously unlocked levels for this student to light up shields
    cursor.execute("SELECT challenge_target FROM applications WHERE student_name = ? AND student_birthday = ? AND status != 'rejected'", (name, birthday))
    unlocked_rows = cursor.fetchall()
    unlocked_challenges = [row['challenge_target'] for row in unlocked_rows if row['challenge_target'] is not None]
    
    # Calculate current challenge attempts
    cursor.execute("SELECT COUNT(*) FROM applications WHERE student_name = ? AND student_birthday = ? AND type = 'challenge' AND status != 'rejected'", (name, birthday))
    attempts = cursor.fetchone()[0]
    
    # Retrieve active settings
    settings_dict = get_all_settings(cursor)
    
    conn.close()
    
    return jsonify({
        'success': True,
        'name': student['name'],
        'birthday': student['birthday'],
        'nickname': student['nickname'],
        'school': student['school'],
        'department': student['department'],
        'grade': student['grade'],
        'unlocked_challenges': unlocked_challenges,
        'attempts': attempts,
        'settings': settings_dict
    })

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    birthday = data.get('birthday', '').strip()
    nickname = data.get('nickname', '').strip()
    school = data.get('school', '').strip()
    department = data.get('department', '').strip()
    grade = data.get('grade', '').strip()
    
    if not all([name, birthday, nickname, school, department, grade]):
        return jsonify({'success': False, 'message': '註冊資訊 (姓名、生日、暱稱、學校、科系、年級) 皆為必填！'}), 400
        
    if len(birthday) != 4 or not birthday.isdigit():
        return jsonify({'success': False, 'message': '生日必須為4碼數字 (如0918)！'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if student already exists
    cursor.execute("SELECT * FROM students WHERE name = ? AND birthday = ?", (name, birthday))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'message': '此身分已存在，請直接登入！'}), 400
        
    # Insert new student record
    try:
        cursor.execute('''
            INSERT INTO students (name, birthday, nickname, school, department, grade) 
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (name, birthday, nickname, school, department, grade))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'資料庫註冊失敗: {str(e)}'}), 500
        
    conn.close()
    return jsonify({
        'success': True,
        'message': '註冊成功！已自動登入系統。'
    })

@app.route('/api/apply/challenge', methods=['POST'])
def api_apply_challenge():
    student_name = request.form.get('student_name', '').strip()
    student_birthday = request.form.get('student_birthday', '').strip()
    name = request.form.get('name', '').strip()
    gpa = request.form.get('gpa')
    target = request.form.get('target')
    bank_code = request.form.get('bank_code', '').strip()
    bank_account = request.form.get('bank_account', '').strip()
    file = request.files.get('file')
    
    if not all([student_name, student_birthday, name, gpa, target, bank_code, bank_account, file]):
        return jsonify({'success': False, 'message': '請填寫所有必要欄位並上傳成績單'}), 400
        
    # Validate GPA and target
    try:
        gpa = float(gpa)
        target = float(target)
    except ValueError:
        return jsonify({'success': False, 'message': '成績格式不正確'}), 400
        
    if gpa < target:
        return jsonify({'success': False, 'message': f'您的學期總平均 ({gpa}) 未達所挑戰的防線 ({target})'}), 400

    conn = get_db()
    cursor = conn.cursor()
    
    # Verify student exists
    cursor.execute("SELECT * FROM students WHERE name = ? AND birthday = ?", (student_name, student_birthday))
    student = cursor.fetchone()
    if not student:
        conn.close()
        return jsonify({'success': False, 'message': '登入身分失效，請重新登入'}), 403
        
    # Check if target already unlocked
    cursor.execute("SELECT COUNT(*) FROM applications WHERE student_name = ? AND student_birthday = ? AND challenge_target = ? AND status != 'rejected'", (student_name, student_birthday, target))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({'success': False, 'message': f'您已挑戰或擊破過此防線門檻 ({target})，請選擇其他防線'}), 400

    # Calculate reward amount based on attempt count
    cursor.execute("SELECT COUNT(*) FROM applications WHERE student_name = ? AND student_birthday = ? AND type = 'challenge' AND status != 'rejected'", (student_name, student_birthday))
    current_attempts = cursor.fetchone()[0]
    
    # Reward mapping from settings
    settings_dict = get_all_settings(cursor)
    rewards = settings_dict.get('challenge_amounts', [7000, 8500, 10000, 12000, 15000, 18000, 20000, 25000])
    assigned_amount = rewards[min(current_attempts, len(rewards)-1)]

    # File upload
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ['.jpg', '.jpeg', '.png', '.pdf', '.svg']:
        conn.close()
        return jsonify({'success': False, 'message': '僅支援 JPG、PNG、PDF 或 SVG 圖檔格式'}), 400
        
    file_id = str(uuid.uuid4())
    saved_filename = f"challenge_{file_id}{file_ext}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], saved_filename))
    
    # Save to database
    app_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO applications (
            id, type, status, created_at, student_name, student_birthday, name, gpa, 
            challenge_target, amount, bank_code, bank_account, file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        app_id, 'challenge', 'pending', datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        student_name, student_birthday, name, gpa, target, assigned_amount, bank_code, bank_account, saved_filename
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True, 
        'message': f'您的第 {current_attempts + 1} 次成績挑戰已成功送出！解鎖關卡金額為 NT$ {assigned_amount:,} 元，系統已進入快速審查階段。'
    })

@app.route('/api/apply/progress', methods=['POST'])
def api_apply_progress():
    # Progress Award submission
    student_name = request.form.get('student_name', '').strip()
    student_birthday = request.form.get('student_birthday', '').strip()
    name = request.form.get('name', '').strip()
    prev_gpa = request.form.get('prev_gpa')
    curr_gpa = request.form.get('curr_gpa')
    credits = request.form.get('credits')
    bank_code = request.form.get('bank_code', '').strip()
    bank_account = request.form.get('bank_account', '').strip()
    prev_file = request.files.get('prev_file')
    curr_file = request.files.get('curr_file')
    
    if not all([student_name, student_birthday, name, prev_gpa, curr_gpa, credits, bank_code, bank_account, prev_file, curr_file]):
        return jsonify({'success': False, 'message': '請填寫所有欄位並上傳上學期及本學期成績單'}), 400
        
    try:
        prev_gpa = float(prev_gpa)
        curr_gpa = float(curr_gpa)
        credits = int(credits)
    except ValueError:
        return jsonify({'success': False, 'message': '數據格式不正確'}), 400
        
    if curr_gpa <= prev_gpa:
        return jsonify({'success': False, 'message': '本學期成績需大於上學期成績才符合進步獎條件'}), 400
        
    # 1. Credits tier bonus
    credits_bonus = 0
    if 1 <= credits <= 9:
        credits_bonus = 300
    elif 10 <= credits <= 15:
        credits_bonus = 500
    elif 16 <= credits <= 23:
        credits_bonus = 1000
    elif credits >= 24:
        credits_bonus = 1800
        
    # 2. Difficulty coefficient (capped at 15.0)
    if prev_gpa >= 93.3333:
        difficulty_coeff = 15.0
    else:
        difficulty_coeff = 100.0 / (100.0 - prev_gpa)
        
    # 3. Credit weight
    credit_weight = credits / 15.0
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify student exists and is sophomore or above
    cursor.execute("SELECT grade FROM students WHERE name = ? AND birthday = ?", (student_name, student_birthday))
    student_row = cursor.fetchone()
    if not student_row:
        conn.close()
        return jsonify({'success': False, 'message': '登入身分失效，請重新登入'}), 403
        
    if student_row['grade'] == '大一':
        conn.close()
        return jsonify({'success': False, 'message': '抱歉！學期進步獎限大二（含）以上學生申請。'}), 403

    # Retrieve settings dynamically
    settings_dict = get_all_settings(cursor)
    progress_base = settings_dict.get('progress_base', 1500)
    conversion_rate = settings_dict.get('progress_conversion_rate', 50)

    # 4. Progress points & cash conversion
    improvement = curr_gpa - prev_gpa
    points = improvement * difficulty_coeff * credit_weight
    conversion = points * float(conversion_rate)
    
    # 5. Total
    calculated_amount = progress_base + credits_bonus + int(round(conversion))
        
    # Save files
    prev_ext = os.path.splitext(prev_file.filename)[1].lower()
    curr_ext = os.path.splitext(curr_file.filename)[1].lower()
    
    prev_file_id = str(uuid.uuid4())
    curr_file_id = str(uuid.uuid4())
    
    prev_saved = f"progress_prev_{prev_file_id}{prev_ext}"
    curr_saved = f"progress_curr_{curr_file_id}{curr_ext}"
    
    prev_file.save(os.path.join(app.config['UPLOAD_FOLDER'], prev_saved))
    curr_file.save(os.path.join(app.config['UPLOAD_FOLDER'], curr_saved))
    
    # Save application
    app_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO applications (
            id, type, status, created_at, student_name, student_birthday, name, gpa, prev_gpa, credits,
            amount, bank_code, bank_account, file_path, prev_file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        app_id, 'progress', 'pending', datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        student_name, student_birthday, name, curr_gpa, prev_gpa, credits, calculated_amount, bank_code, bank_account, curr_saved, prev_saved
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': f'您的學期進步獎申請已成功送出！試算金額為 NT$ {calculated_amount:,} 元，審核中。'
    })

@app.route('/api/apply/blueprint', methods=['POST'])
def api_apply_blueprint():
    # Future Blueprint Project
    student_name = request.form.get('student_name', '').strip()
    student_birthday = request.form.get('student_birthday', '').strip()
    name = request.form.get('name', '').strip()
    project_name = request.form.get('project_name', '').strip()
    project_month = request.form.get('project_month', '').strip()
    file = request.files.get('file')
    
    if not all([student_name, student_birthday, name, project_name, project_month, file]):
        return jsonify({'success': False, 'message': '請填寫所有欄位並上傳企劃書 PDF'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    # Save file
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ['.pdf', '.zip', '.rar']:
        conn.close()
        return jsonify({'success': False, 'message': '提案企劃僅支援 PDF 或 壓縮檔 (ZIP/RAR) 格式'}), 400
        
    file_id = str(uuid.uuid4())
    saved_filename = f"blueprint_{file_id}{file_ext}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], saved_filename))
    
    # Retrieve blueprint amount setting
    settings_dict = get_all_settings(cursor)
    blueprint_amount = settings_dict.get('blueprint_amount', 30000)

    # Save application
    app_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO applications (
            id, type, status, created_at, student_name, student_birthday, name, amount, 
            project_name, project_month, file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        app_id, 'blueprint', 'pending', datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        student_name, student_birthday, name, blueprint_amount, project_name, project_month, saved_filename
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': '您的未來藍圖計畫提案已成功提交！此專案有專屬三階段里程碑，審核通過後即解鎖執行權限！'
    })

# ----------------- APIs for Admin Panel -----------------

@app.route('/api/admin/settings', methods=['GET', 'POST'])
@admin_required
def api_admin_settings():
    if request.method == 'GET':
        conn = get_db()
        cursor = conn.cursor()
        settings_dict = get_all_settings(cursor)
        conn.close()
        return jsonify(settings_dict)
    
    # POST request to update settings
    data = request.get_json() or {}
    progress_base = data.get('progress_base')
    progress_conversion_rate = data.get('progress_conversion_rate')
    blueprint_amount = data.get('blueprint_amount')
    challenge_amounts = data.get('challenge_amounts') # expected: list of 8 ints
    
    if progress_base is None or progress_conversion_rate is None or blueprint_amount is None or challenge_amounts is None:
        return jsonify({'success': False, 'message': '所有設定參數皆為必填！'}), 400
        
    try:
        progress_base = int(progress_base)
        progress_conversion_rate = int(progress_conversion_rate)
        blueprint_amount = int(blueprint_amount)
        challenge_amounts = [int(x) for x in challenge_amounts]
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': '金額與係數格式必須為整數！'}), 400
        
    if len(challenge_amounts) != 8:
        return jsonify({'success': False, 'message': '挑戰級距獎金必須正好為 8 個等級！'}), 400
        
    challenge_amounts_str = ','.join(str(x) for x in challenge_amounts)
    
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE settings SET value = ? WHERE key = 'progress_base'", (str(progress_base),))
        cursor.execute("UPDATE settings SET value = ? WHERE key = 'progress_conversion_rate'", (str(progress_conversion_rate),))
        cursor.execute("UPDATE settings SET value = ? WHERE key = 'blueprint_amount'", (str(blueprint_amount),))
        cursor.execute("UPDATE settings SET value = ? WHERE key = 'challenge_amounts'", (challenge_amounts_str,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'success': False, 'message': f'更新設定失敗: {str(e)}'}), 500
        
    conn.close()
    return jsonify({'success': True, 'message': '獎金參數設定已成功更新！所有學生試算及申報金額將同步生效。'})

@app.route('/api/admin/list', methods=['GET'])
@admin_required
def api_admin_list():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, s.nickname, s.school, s.department, s.grade 
        FROM applications a 
        LEFT JOIN students s ON a.student_name = s.name AND a.student_birthday = s.birthday 
        ORDER BY a.created_at DESC
    ''')
    rows = cursor.fetchall()
    
    results = []
    for r in rows:
        results.append({
            'id': r['id'],
            'type': r['type'],
            'status': r['status'],
            'created_at': r['created_at'],
            'student_name': r['student_name'],
            'student_birthday': r['student_birthday'],
            'name': r['name'],
            'gpa': r['gpa'],
            'prev_gpa': r['prev_gpa'],
            'credits': r['credits'],
            'challenge_target': r['challenge_target'],
            'amount': r['amount'],
            'bank_code': r['bank_code'],
            'bank_account': r['bank_account'],
            'file_path': r['file_path'],
            'prev_file_path': r['prev_file_path'],
            'project_name': r['project_name'],
            'project_month': r['project_month'],
            'destruction_time': r['destruction_time'],
            'nickname': r['nickname'] or '',
            'school': r['school'] or '',
            'department': r['department'] or '',
            'grade': r['grade'] or ''
        })
    conn.close()
    return jsonify(results)

@app.route('/api/admin/approve', methods=['POST'])
@admin_required
def api_admin_approve():
    data = request.get_json() or {}
    app_id = data.get('id')
    
    if not app_id:
        return jsonify({'success': False, 'message': '未指定申請編號'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE applications SET status = 'approved' WHERE id = ?", (app_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': '此筆申請案件已審定核准！隨後可匯出至網銀撥款。'})

@app.route('/api/admin/reject', methods=['POST'])
@admin_required
def api_admin_reject():
    data = request.get_json() or {}
    app_id = data.get('id')
    
    if not app_id:
        return jsonify({'success': False, 'message': '未指定申請編號'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE applications SET status = 'rejected' WHERE id = ?", (app_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': '此筆申請案件已被拒絕。'})

@app.route('/api/admin/destroy', methods=['POST'])
@admin_required
def api_admin_destroy():
    data = request.get_json() or {}
    app_id = data.get('id')
    
    if not app_id:
        return jsonify({'success': False, 'message': '未指定申請編號'}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    # Get details before destruction to delete physical files
    cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
    app_row = cursor.fetchone()
    
    if not app_row:
        conn.close()
        return jsonify({'success': False, 'message': '找不到該筆申請案'}), 404
        
    # Delete uploaded files physically
    files_to_delete = []
    if app_row['file_path'] and app_row['file_path'] != 'mock_report.svg':
        files_to_delete.append(app_row['file_path'])
    if app_row['prev_file_path']:
        files_to_delete.append(app_row['prev_file_path'])
        
    for f in files_to_delete:
        path = os.path.join(app.config['UPLOAD_FOLDER'], f)
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"Error removing file {path}: {e}")
                
    # Anonymize name (masking: "王小明" -> "王*明", "李小華" -> "李*華", etc.)
    original_name = app_row['name'] or '申請人'
    masked_name = original_name
    if len(original_name) >= 3:
        masked_name = original_name[0] + '*' + original_name[2:]
    elif len(original_name) == 2:
        masked_name = original_name[0] + '*'
        
    # Update SQLite database: set status='destroyed', clear sensitive PII, log destruction time
    cursor.execute('''
        UPDATE applications 
        SET status = 'destroyed', 
            name = ?, 
            bank_code = NULL, 
            bank_account = NULL, 
            file_path = NULL, 
            prev_file_path = NULL,
            destruction_time = ? 
        WHERE id = ?
    ''', (masked_name, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), app_id))
    
    conn.commit()
    conn.close()
    
    # Simulated email sending
    email_notification = {
        'to': 'student_registered_email@example.com',
        'subject': '【古哥獎學金】已撥款暨個人隱私資料銷毀通知',
        'body': f"親愛的同學您好：您所申請的【古哥獎學金】已成功匯入您的收款帳戶。為保障個人穩私，您的帳戶資訊、真實姓名與成績單圖檔已依個資銷毀切結，由本系統資料庫與儲存空間中徹底刪除且永久無法復原。系統僅留存去識別化統計數據。祝您學業更上一層樓！"
    }
    
    return jsonify({
        'success': True, 
        'message': '「一鍵個資銷毀」執行完畢！',
        'anonymized_name': masked_name,
        'email_log': email_notification
    })

@app.route('/api/admin/export', methods=['GET'])
@admin_required
def api_admin_export():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM applications WHERE status = 'approved'")
    approved_cases = cursor.fetchall()
    conn.close()
    
    # Generate CSV with UTF-8 BOM so Excel opens it with proper Chinese characters
    output = io.StringIO()
    # Write UTF-8 BOM
    output.write('\ufeff')
    
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    # Headers suitable for wire transfer format
    writer.writerow(['銀行代號', '收款帳戶', '金額', '戶名/備註'])
    
    for c in approved_cases:
        # Prevent export crash if data is null
        bank_code = c['bank_code'] or ''
        bank_account = c['bank_account'] or ''
        amount = c['amount'] or 0
        name = c['name'] or ''
        writer.writerow([bank_code, bank_account, amount, f"{name}-古哥獎學金"])
        
    csv_data = output.getvalue()
    output.close()
    
    response = make_response(csv_data)
    response.headers["Content-Disposition"] = f"attachment; filename=guge_scholarship_export_{datetime.now().strftime('%Y%m%d')}.csv"
    response.headers["Content-type"] = "text/csv; charset=utf-8"
    return response

# Main execution entry
if __name__ == '__main__':
    init_db()
    print("----------------------------------------")
    print("【古哥獎學金審查系統】本地端 Flask 伺服器啟動中...")
    print("前台請訪問: http://127.0.0.1:5000")
    print("後台管理請訪問: http://127.0.0.1:5000/admin")
    print("----------------------------------------")
    app.run(debug=True, port=5000)
