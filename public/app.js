const { useState, useEffect } = React;

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('products');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
    refreshCart();
    fetch('/api/me').then(res => res.json()).then(data => setUser(data.user));
  }, []);

  function refreshCart() {
    fetch('/api/cart').then(res => res.json()).then(setCart);
  }

  function addToCart(id) {
    fetch(`/api/cart/add/${id}`, { method: 'POST' }).then(() => refreshCart());
  }

  function login(e) {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(res => res.json()).then(data => {
      if (data.user) {
        setUser(data.user);
        setView('products');
        setMessage('');
      } else {
        setMessage(data.error);
      }
    });
  }

  function register(e) {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        setView('login');
        setMessage('Registrado, ahora inicia sesión.');
      } else {
        setMessage(data.error);
      }
    });
  }

  function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => {
      setUser(null);
      setView('products');
    });
  }

  function checkout() {
    fetch('/api/cart/checkout', { method: 'POST' }).then(res => res.json()).then(data => {
      if (data.url) {
        window.location = data.url;
      } else if (data.orderId) {
        setCart([]);
        setMessage('Pedido completado #' + data.orderId);
        setView('products');
      } else if (data.error) {
        setMessage(data.error);
      }
    });
  }

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return React.createElement(
    'div',
    null,
    React.createElement(
      'header',
      null,
      React.createElement('h1', null, 'Fino'),
      React.createElement(
        'div',
        null,
        user
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement('span', null, 'Hola ', user.username),
              React.createElement('button', { onClick: logout }, 'Salir')
            )
          : React.createElement(
              React.Fragment,
              null,
              React.createElement('button', { onClick: () => setView('login') }, 'Login'),
              React.createElement('button', { onClick: () => setView('register') }, 'Registro')
            ),
        React.createElement(
          'button',
          { onClick: () => setView('cart') },
          `Carrito (${cartCount})`
        )
      )
    ),
    message && React.createElement('p', null, message),
    view === 'products' &&
      React.createElement(
        'ul',
        { className: 'products' },
        products.map(p =>
          React.createElement(
            'li',
            { key: p.id },
            React.createElement('img', { src: p.image, alt: p.name }),
            React.createElement('div', null, p.name),
            React.createElement('div', null, `$${(p.price / 100).toFixed(2)}`),
            React.createElement(
              'button',
              { onClick: () => addToCart(p.id) },
              'Agregar'
            )
          )
        )
      ),
    view === 'cart' &&
      React.createElement(
        'div',
        null,
        React.createElement('h2', null, 'Carrito'),
        cart.length === 0
          ? React.createElement('p', null, 'Vacío')
          : React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'ul',
                { className: 'products' },
                cart.map(item =>
                  React.createElement(
                    'li',
                    { key: item.product.id },
                    React.createElement('img', { src: item.product.image, alt: item.product.name }),
                    React.createElement('div', null, `${item.product.name} x ${item.qty}`)
                  )
                )
              ),
              React.createElement('button', { onClick: checkout }, 'Pagar')
            )
      ),
    view === 'login' &&
      React.createElement(
        'form',
        { onSubmit: login },
        React.createElement('h2', null, 'Iniciar sesión'),
        React.createElement('input', { name: 'username', placeholder: 'Usuario' }),
        React.createElement('input', { type: 'password', name: 'password', placeholder: 'Contraseña' }),
        React.createElement('button', { type: 'submit' }, 'Entrar')
      ),
    view === 'register' &&
      React.createElement(
        'form',
        { onSubmit: register },
        React.createElement('h2', null, 'Registrarse'),
        React.createElement('input', { name: 'username', placeholder: 'Usuario' }),
        React.createElement('input', { type: 'password', name: 'password', placeholder: 'Contraseña' }),
        React.createElement('button', { type: 'submit' }, 'Crear')
      )
  );
}

ReactDOM.render(React.createElement(App), document.getElementById('app'));
