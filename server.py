from flask import Flask, request, jsonify, make_response, send_from_directory
import os, sqlite3, uuid

app = Flask(__name__, static_folder='.', static_url_path='')

def get_db():
    con = sqlite3.connect(os.path.join(os.path.dirname(__file__), 'data.db'))
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = get_db()
    cur = con.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      image TEXT,
      category TEXT
    )
    """)
    try:
      cur.execute('ALTER TABLE products ADD COLUMN category TEXT')
    except Exception:
      pass
    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buy_order TEXT NOT NULL,
      user_email TEXT,
      total REAL NOT NULL,
      items TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
    """)
    # seed admin and sample products if empty
    cur.execute('SELECT COUNT(1) AS c FROM users')
    if cur.fetchone()['c'] == 0:
      cur.execute('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)',
                  (str(uuid.uuid4()), 'Admin', 'admin', 'admin123', 'admin'))
    cur.execute('SELECT COUNT(1) AS c FROM products')
    if cur.fetchone()['c'] == 0:
      samples = [
        ('Arroz', 2500, 'https://images.unsplash.com/photo-1546500840-ae38253aba9b?q=80&w=800&auto=format&fit=crop', 'productos secos'),
        ('Aceite', 5900, 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?q=80&w=800&auto=format&fit=crop', 'productos secos'),
        ('Leche', 1200, 'https://images.unsplash.com/photo-1582298538104-2910a3894900?q=80&w=800&auto=format&fit=crop', 'lacteos'),
        ('Huevos', 3800, 'https://images.unsplash.com/photo-1517957754645-3f4e0a3f1a9a?q=80&w=800&auto=format&fit=crop', 'productos secos'),
      ]
      for n,p,img,cat in samples:
        cur.execute('INSERT INTO products (id,name,price,image,category) VALUES (?,?,?,?,?)',
                    (str(uuid.uuid4()), n, float(p), img, cat))
    con.commit()
    con.close()

def cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return resp

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/index.html')
def index_html():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/styles.css')
def styles_css():
    return send_from_directory(app.static_folder, 'styles.css')

@app.route('/app.js')
def app_js():
    return send_from_directory(app.static_folder, 'app.js')

@app.route('/api/products', methods=['GET', 'POST', 'OPTIONS'])
def products():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    con = get_db()
    cur = con.cursor()
    if request.method == 'GET':
        cur.execute('SELECT id,name,price,image,category FROM products')
        rows = [dict(r) for r in cur.fetchall()]
        con.close()
        return cors(jsonify(rows))
    data = request.get_json(force=True)
    name = str(data.get('name','')).strip()
    price = float(data.get('price',0))
    image = data.get('image')
    category = str(data.get('category') or '').strip()
    pid = str(uuid.uuid4())
    cur.execute('INSERT INTO products (id,name,price,image,category) VALUES (?,?,?,?,?)', (pid, name, price, image, category))
    con.commit()
    con.close()
    return cors(jsonify({'id': pid, 'name': name, 'price': price, 'image': image, 'category': category}))

@app.route('/api/products/<pid>', methods=['PUT', 'DELETE', 'OPTIONS'])
def product_item(pid):
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    con = get_db()
    cur = con.cursor()
    if request.method == 'DELETE':
        cur.execute('DELETE FROM products WHERE id=?', (pid,))
        con.commit(); con.close()
        return cors(jsonify({'ok': True}))
    data = request.get_json(force=True)
    name = data.get('name'); price = data.get('price'); image = data.get('image'); category = data.get('category')
    cur.execute('UPDATE products SET name=COALESCE(?,name), price=COALESCE(?,price), image=COALESCE(?,image), category=COALESCE(?,category) WHERE id=?', (name, price, image, category, pid))
    con.commit(); con.close()
    return cors(jsonify({'ok': True}))

@app.route('/api/users/register', methods=['POST', 'OPTIONS'])
def users_register():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    data = request.get_json(force=True)
    name = str(data.get('name','')).strip()
    email = str(data.get('email','')).strip().lower()
    password = str(data.get('password',''))
    con = get_db(); cur = con.cursor()
    cur.execute('SELECT 1 FROM users WHERE email=?', (email,))
    if cur.fetchone():
        con.close()
        return cors(jsonify({'error':'email_exists'})), 409
    cur.execute('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)', (str(uuid.uuid4()), name, email, password, 'cliente'))
    con.commit(); con.close()
    return cors(jsonify({'ok': True}))

@app.route('/api/users/login', methods=['POST', 'OPTIONS'])
def users_login():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    data = request.get_json(force=True)
    email = str(data.get('email','')).strip().lower()
    password = str(data.get('password',''))
    con = get_db(); cur = con.cursor()
    cur.execute('SELECT name, role FROM users WHERE email=? AND password=?', (email, password))
    row = cur.fetchone(); con.close()
    if not row:
        return cors(jsonify({'error':'invalid_credentials'})), 401
    return cors(jsonify({'name': row['name'], 'role': row['role']}))

@app.route('/api/users/update_name', methods=['POST', 'OPTIONS'])
def users_update_name():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    data = request.get_json(force=True)
    email = str(data.get('email','')).strip().lower()
    new_name = str(data.get('name','')).strip()
    if not email or not new_name:
        return cors(jsonify({'error':'invalid_request'})), 400
    con = get_db(); cur = con.cursor()
    cur.execute('UPDATE users SET name=? WHERE email=?', (new_name, email))
    con.commit(); con.close()
    return cors(jsonify({'ok': True, 'name': new_name}))

@app.route('/api/pay/create', methods=['POST', 'OPTIONS'])
def create_pay():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    data = request.get_json(force=True)
    amount = int(float(data.get('amount', 0)))
    session_id = str(data.get('session_id') or 'anon')
    buy_order = str(data.get('buy_order') or f'order-{session_id}')

    try:
        from transbank.webpay.webpay_plus.transaction import Transaction
        tx = Transaction()
        return_url = os.getenv('RETURN_URL', 'http://localhost:5000/api/pay/commit')
        resp = tx.create(buy_order, session_id, amount, return_url)
        return cors(jsonify({ 'url': resp['url'], 'token': resp['token'] }))
    except Exception as e:
        return cors(jsonify({ 'error': 'transbank_sdk_missing_or_error', 'detail': str(e) })), 501

@app.route('/api/pay/simulate', methods=['POST', 'OPTIONS'])
def simulate_pay():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    data = request.get_json(force=True)
    amount = int(float(data.get('amount', 0)))
    buy_order = str(data.get('buy_order') or f'order-{uuid.uuid4().hex[:8]}')
    user_email = str(data.get('user_email') or '')
    items = data.get('cart') or []
    oid = str(uuid.uuid4())
    con = get_db(); cur = con.cursor()
    import json, datetime
    cur.execute('INSERT INTO orders (id,buy_order,user_email,total,items,status,created_at) VALUES (?,?,?,?,?,?,?)', (
        oid, buy_order, user_email, amount, json.dumps(items, ensure_ascii=False), 'simulated_paid', datetime.datetime.utcnow().isoformat()))
    con.commit(); con.close()
    url = f'/simulated/pay/{oid}'
    return cors(jsonify({ 'url': url, 'order_id': oid }))

@app.route('/simulated/pay/<oid>', methods=['GET'])
def simulated_pay_page(oid):
    con = get_db(); cur = con.cursor()
    cur.execute('SELECT buy_order,user_email,total,items,status,created_at FROM orders WHERE id=?', (oid,))
    row = cur.fetchone(); con.close()
    if not row:
        return 'Orden no encontrada', 404
    import json
    items = json.loads(row['items'])
    html = f"""
    <html><head><title>Pago simulado</title></head>
    <body style='font-family: system-ui; background:#0f172a; color:#e5e7eb;'>
    <div style='max-width:800px;margin:40px auto;background:#111827;padding:16px;border-radius:12px;'>
    <h1>¡Pago realizado!</h1>
    <p><b>Orden:</b> {row['buy_order']}</p>
    <p><b>Cliente:</b> {row['user_email'] or 'Invitado'}</p>
    <p><b>Total:</b> CLP {int(row['total']):,}</p>
    <h3>Items</h3>
    <ul>
    {''.join([f"<li>{i.get('name')} x{i.get('qty')} — CLP {int(i.get('price')*i.get('qty')):,}</li>" for i in items])}
    </ul>
    <a href='/' style='color:#22c55e'>Volver a la tienda</a>
    </div>
    </body></html>
    """
    resp = make_response(html)
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'
    return resp

@app.route('/api/orders', methods=['GET', 'OPTIONS'])
def orders_list():
    if request.method == 'OPTIONS':
        return cors(make_response('', 204))
    con = get_db(); cur = con.cursor()
    cur.execute('SELECT id,buy_order,user_email,total,status,created_at,items FROM orders ORDER BY created_at DESC')
    rows = cur.fetchall(); con.close()
    import json
    data = []
    for r in rows:
        items = json.loads(r['items'])
        count = sum([int(i.get('qty', 0)) for i in items])
        data.append({
            'id': r['id'], 'buy_order': r['buy_order'], 'user_email': r['user_email'],
            'total': r['total'], 'status': r['status'], 'created_at': r['created_at'],
            'item_count': count, 'items': items
        })
    return cors(jsonify(data))
@app.route('/api/pay/commit', methods=['POST'])
def commit_pay():
    token_ws = request.form.get('token_ws')
    try:
        from transbank.webpay.webpay_plus.transaction import Transaction
        tx = Transaction()
        result = tx.commit(token_ws)
        html = f"""
        <html><head><title>Pago Webpay</title></head>
        <body style='font-family: system-ui; background:#0f172a; color:#e5e7eb;'>
        <div style='max-width:700px;margin:40px auto;background:#111827;padding:16px;border-radius:12px;'>
        <h1>Resultado del pago</h1>
        <pre style='white-space:pre-wrap'>{result}</pre>
        <a href='/' style='color:#22c55e'>Volver</a>
        </div>
        </body></html>
        """
        resp = make_response(html)
        resp.headers['Content-Type'] = 'text/html; charset=utf-8'
        return resp
    except Exception as e:
        return f"Error al confirmar transacción: {e}", 500

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
