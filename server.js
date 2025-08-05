const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET ? new Stripe(process.env.STRIPE_SECRET) : null;
const app = express();
const db = new sqlite3.Database('./store.db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'fino-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS products(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      price INTEGER,
      image TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS orders(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total INTEGER,
      created_at TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS order_items(
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price INTEGER
    )`);

    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
      if (row && row.count === 0) {
        const stmt = db.prepare('INSERT INTO products(name, price, image) VALUES(?,?,?)');
        for (let i = 1; i <= 10; i++) {
          stmt.run(`Bolsa ${i}`, 1000 + i * 100, `/images/bag${i}.svg`);
        }
        stmt.finalize();
      }
    });
  });
}
initDb();

app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

function ensureAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => {
  db.all('SELECT * FROM products', (err, products) => {
    res.render('index', { products, user: req.session.user });
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username=?', [username], (err, user) => {
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.user = { id: user.id, username: user.username };
      res.redirect('/');
    } else {
      res.render('login', { error: 'Credenciales inválidas' });
    }
  });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users(username, password) VALUES(?,?)', [username, hashed], err => {
    if (err) return res.render('register', { error: 'Usuario existente' });
    res.redirect('/login');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/cart/add/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = req.session.cart.find(i => i.id === id);
  if (item) item.qty++;
  else req.session.cart.push({ id, qty: 1 });
  res.redirect('/');
});

app.get('/cart', (req, res) => {
  const ids = req.session.cart.map(i => i.id);
  if (ids.length === 0) return res.render('cart', { items: [] });
  const placeholders = ids.map(() => '?').join(',');
  db.all(`SELECT * FROM products WHERE id IN (${placeholders})`, ids, (err, rows) => {
    const items = rows.map(p => ({
      product: p,
      qty: req.session.cart.find(i => i.id === p.id).qty
    }));
    res.render('cart', { items });
  });
});

app.post('/cart/checkout', ensureAuth, (req, res) => {
  const ids = req.session.cart.map(i => i.id);
  if (ids.length === 0) return res.redirect('/cart');
  const placeholders = ids.map(() => '?').join(',');
  db.all(`SELECT * FROM products WHERE id IN (${placeholders})`, ids, (err, rows) => {
    const total = rows.reduce((sum, p) => {
      const qty = req.session.cart.find(i => i.id === p.id).qty;
      return sum + p.price * qty;
    }, 0);
    db.run('INSERT INTO orders(user_id,total,created_at) VALUES(?,?,datetime(\'now\'))', [req.session.user.id, total], function (err) {
      const orderId = this.lastID;
      const stmt = db.prepare('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(?,?,?,?)');
      rows.forEach(p => {
        const qty = req.session.cart.find(i => i.id === p.id).qty;
        stmt.run(orderId, p.id, qty, p.price);
      });
      stmt.finalize();
      req.session.cart = [];
      if (stripe) {
        stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: rows.map(p => ({
            price_data: {
              currency: 'usd',
              product_data: { name: p.name },
              unit_amount: p.price
            },
            quantity: req.session.cart.find(i => i.id === p.id).qty
          })),
          mode: 'payment',
          success_url: 'http://localhost:3000/success',
          cancel_url: 'http://localhost:3000/cancel'
        }).then(session => {
          res.redirect(session.url);
        }).catch(() => {
          res.render('success', { orderId });
        });
      } else {
        res.render('success', { orderId });
      }
    });
  });
});

app.get('/success', (req, res) => {
  res.render('success', { orderId: null });
});

app.get('/cancel', (req, res) => {
  res.render('cancel');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
