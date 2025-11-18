const { useState, useEffect, useRef } = React;

const API_BASE = 'http://localhost:4000/api';
const DEFAULT_CENTER = [27.7172, 85.3240];
const DEFAULT_ZOOM = 12;

function Notification({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [notification, onClose]);
  if (!notification) return null;
  const type = notification.type || 'info';
  return React.createElement(
    'div',
    { className: 'notification ' + type + ' show' },
    notification.message
  );
}

function Modal({ title, children, onClose }) {
  function handleBackground(e) {
    if (e.target === e.currentTarget) onClose();
  }
  return React.createElement(
    'div',
    { className: 'modal show', onClick: handleBackground },
    React.createElement(
      'div',
      { className: 'modal-content' },
      React.createElement(
        'div',
        { className: 'modal-header' },
        React.createElement('h2', null, title),
        React.createElement('span', { className: 'close', onClick: onClose }, '\u00d7')
      ),
      children
    )
  );
}

function App() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [pins, setPins] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [categoryFilters, setCategoryFilters] = useState({
    Water: true,
    Food: true,
    Shelter: true,
    Medical: true,
    Transport: true
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showAddPin, setShowAddPin] = useState(false);
  const [addPinType, setAddPinType] = useState('need');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [notification, setNotification] = useState(null);
  const [loadingPins, setLoadingPins] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    volunteer_radius: 5
  });
  const [addPinForm, setAddPinForm] = useState({
    category: '',
    details: '',
    quantity: ''
  });

  function showToast(message, type) {
    setNotification({ message, type: type || 'info' });
  }

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;
    const map = L.map(mapElementRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\u00a9 OpenStreetMap contributors'
    }).addTo(map);
    map.on('click', function (e) {
      if (!currentUser || (currentUser.role !== 'user' && currentUser.role !== 'volunteer')) return;
      setCurrentLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowAddPin(true);
    });
    mapRef.current = map;
  }, [currentUser]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(function (marker) { mapRef.current.removeLayer(marker); });
    markersRef.current = [];
    const activeCategories = Object.keys(categoryFilters).filter(function (key) { return categoryFilters[key]; });
    const filtered = pins.filter(function (pin) {
      const typeMatch = filterType === 'all' || pin.type === filterType;
      const categoryMatch = activeCategories.length === 0 || activeCategories.indexOf(pin.category) !== -1;
      return typeMatch && categoryMatch;
    });
    filtered.forEach(function (pin) {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="' + pin.type + '-marker ' + (pin.status === 'verified' ? 'verified-marker' : '') + '">' + (pin.type === 'need' ? '\ud83d\udd34' : '\ud83d\udfe2') + '</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const marker = L.marker([pin.lat, pin.lng], { icon: icon });
      marker.on('click', function () { setSelectedPin(pin); });
      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });
  }, [pins, filterType, categoryFilters]);

  async function fetchPins() {
    try {
      setLoadingPins(true);
      const res = await fetch(API_BASE + '/pins');
      const data = await res.json();
      if (res.ok) {
        setPins(data.pins || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPins(false);
    }
  }

  useEffect(() => {
    fetchPins();
    const interval = setInterval(fetchPins, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    fetchProfile(token);
  }, []);

  async function fetchProfile(token) {
    try {
      const res = await fetch(API_BASE + '/auth/profile', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        localStorage.removeItem('authToken');
      }
    } catch (e) {
      localStorage.removeItem('authToken');
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('authToken', data.token);
        setCurrentUser(data.user);
        setShowLogin(false);
        showToast('Login successful', 'success');
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch (e) {
      showToast('Login failed', 'error');
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
        volunteer_radius: registerForm.role === 'volunteer' ? parseInt(registerForm.volunteer_radius || 0, 10) : 0
      };
      const res = await fetch(API_BASE + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('authToken', data.token);
        setCurrentUser(data.user);
        setShowRegister(false);
        showToast('Registration successful', 'success');
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch (e) {
      showToast('Registration failed', 'error');
    }
  }

  function logout() {
    localStorage.removeItem('authToken');
    setCurrentUser(null);
    showToast('Logged out', 'info');
  }

  function handleCategoryToggle(name) {
    setCategoryFilters(function (prev) {
      const next = Object.assign({}, prev);
      next[name] = !prev[name];
      return next;
    });
  }

  function openAddPin(type) {
    if (!currentUser) {
      showToast(type === 'need' ? 'Please login to report a need' : 'Please login to offer help', 'error');
      return;
    }
    setAddPinType(type);
    setShowAddPin(true);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        if (mapRef.current) {
          mapRef.current.setView([loc.lat, loc.lng], 15);
        }
      },
      function () {
        showToast('Unable to get location', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function handleAddPinSubmit(e) {
    e.preventDefault();
    if (!currentLocation) {
      showToast('Select a location first', 'error');
      return;
    }
    const token = localStorage.getItem('authToken');
    if (!token) {
      showToast('You must be logged in', 'error');
      return;
    }
    const payload = {
      type: addPinType,
      category: addPinForm.category,
      details: addPinForm.details,
      quantity: addPinForm.quantity,
      lat: currentLocation.lat,
      lng: currentLocation.lng
    };
    try {
      const res = await fetch(API_BASE + '/pins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddPin(false);
        setAddPinForm({ category: '', details: '', quantity: '' });
        showToast('Pin added successfully', 'success');
        fetchPins();
      } else {
        showToast(data.error || 'Failed to add pin', 'error');
      }
    } catch (e) {
      showToast('Failed to add pin', 'error');
    }
  }

  async function setVolunteerCenter() {
    if (!currentUser || currentUser.role !== 'volunteer') return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const center = mapRef.current ? mapRef.current.getCenter() : null;
    if (!center) return;
    try {
      const res = await fetch(API_BASE + '/pins/volunteer-center', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ lat: center.lat, lng: center.lng })
      });
      if (res.ok) {
        showToast('Volunteer area updated', 'success');
        setCurrentUser(function (prev) {
          if (!prev) return prev;
          const next = Object.assign({}, prev);
          next.center_lat = center.lat;
          next.center_lng = center.lng;
          return next;
        });
      } else {
        showToast('Unable to update volunteer center', 'error');
      }
    } catch (e) {
      showToast('Unable to update volunteer center', 'error');
    }
  }

  function closeDetails() {
    setSelectedPin(null);
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'header',
      { className: 'header' },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'div',
          { className: 'logo' },
          React.createElement('i', { className: 'fas fa-hands-helping' }),
          React.createElement('span', null, 'Aaphat-Sathi')
        ),
        React.createElement(
          'nav',
          { className: 'nav' },
          !currentUser && React.createElement(
            'div',
            { className: 'auth-section' },
            React.createElement(
              'button',
              { className: 'btn btn-outline', onClick: function () { setShowLogin(true); } },
              'Login'
            ),
            React.createElement(
              'button',
              { className: 'btn btn-primary', onClick: function () { setShowRegister(true); } },
              'Register'
            )
          ),
          currentUser && React.createElement(
            'div',
            { className: 'user-section' },
            React.createElement(
              'span',
              null,
              currentUser.name,
              currentUser.role ? ' (' + currentUser.role + ')' : ''
            ),
            currentUser.role === 'volunteer' && React.createElement(
              'button',
              { className: 'btn btn-outline', onClick: setVolunteerCenter },
              'Set My Area'
            ),
            React.createElement(
              'button',
              { className: 'btn btn-outline', onClick: logout },
              'Logout'
            )
          )
        )
      )
    ),
    React.createElement(
      'main',
      { className: 'main' },
      React.createElement(
        'div',
        { className: 'control-panel' },
        React.createElement(
          'div',
          { className: 'filter-section' },
          React.createElement('h3', null, 'Filter by Type'),
          React.createElement(
            'div',
            { className: 'filter-buttons' },
            React.createElement(
              'button',
              {
                className: 'filter-btn' + (filterType === 'all' ? ' active' : ''),
                onClick: function () { setFilterType('all'); }
              },
              'All'
            ),
            React.createElement(
              'button',
              {
                className: 'filter-btn' + (filterType === 'need' ? ' active' : ''),
                onClick: function () { setFilterType('need'); }
              },
              '\ud83d\udd34 Need Help'
            ),
            React.createElement(
              'button',
              {
                className: 'filter-btn' + (filterType === 'offer' ? ' active' : ''),
                onClick: function () { setFilterType('offer'); }
              },
              '\ud83d\udfe2 Offer Help'
            )
          ),
          React.createElement('h4', null, 'Categories'),
          React.createElement(
            'div',
            { className: 'category-filters' },
            ['Water', 'Food', 'Shelter', 'Medical', 'Transport'].map(function (cat) {
              return React.createElement(
                'label',
                { key: cat },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: !!categoryFilters[cat],
                  onChange: function () { handleCategoryToggle(cat); }
                }),
                cat
              );
            })
          )
        ),
        React.createElement(
          'div',
          { className: 'action-section' },
          React.createElement(
            'button',
            { className: 'btn btn-need', onClick: function () { openAddPin('need'); } },
            'Add Need Help'
          ),
          React.createElement(
            'button',
            { className: 'btn btn-offer', onClick: function () { openAddPin('offer'); } },
            'Offer Help'
          ),
          currentUser && currentUser.role === 'volunteer' && React.createElement(
            'div',
            { style: { marginTop: '1rem', fontSize: '0.9rem' } },
            React.createElement(
              'div',
              null,
              'Volunteer Hours: ',
              currentUser.hours || 0
            ),
            React.createElement(
              'div',
              null,
              'Supplies Provided: ',
              currentUser.supplies || 0
            )
          ),
          loadingPins && React.createElement(
            'div',
            { style: { marginTop: '1rem', fontSize: '0.85rem', color: '#666' } },
            'Loading pins...'
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'map-container' },
        React.createElement('div', { id: 'map', ref: mapElementRef })
      ),
      selectedPin && React.createElement(
        'div',
        { className: 'pin-details show' },
        React.createElement(
          'div',
          { className: 'pin-details-content' },
          React.createElement(
            'button',
            { className: 'close-btn', onClick: closeDetails },
            '\u00d7'
          ),
          React.createElement(
            'h3',
            null,
            selectedPin.type === 'need' ? 'Need Help' : 'Offer Help'
          ),
          React.createElement(
            'div',
            { className: 'detail-row' },
            React.createElement('span', { className: 'label' }, 'Category:'),
            React.createElement('span', { className: 'value' }, selectedPin.category)
          ),
          React.createElement(
            'div',
            { className: 'detail-row' },
            React.createElement('span', { className: 'label' }, 'Details:'),
            React.createElement('span', { className: 'value' }, selectedPin.details)
          ),
          selectedPin.quantity && React.createElement(
            'div',
            { className: 'detail-row' },
            React.createElement('span', { className: 'label' }, 'Quantity:'),
            React.createElement('span', { className: 'value' }, selectedPin.quantity)
          ),
          React.createElement(
            'div',
            { className: 'detail-row' },
            React.createElement('span', { className: 'label' }, 'Status:'),
            React.createElement(
              'span',
              { className: 'value' },
              React.createElement(
                'span',
                { className: 'status-badge status-' + selectedPin.status },
                selectedPin.status
              )
            )
          ),
          React.createElement(
            'div',
            { className: 'detail-row' },
            React.createElement('span', { className: 'label' }, 'Location:'),
            React.createElement(
              'span',
              { className: 'value' },
              selectedPin.lat.toFixed(6),
              ', ',
              selectedPin.lng.toFixed(6)
            )
          ),
          React.createElement(
            'div',
            { className: 'detail-row' },
            React.createElement('span', { className: 'label' }, 'Created:'),
            React.createElement(
              'span',
              { className: 'value' },
              selectedPin.created_at ? new Date(selectedPin.created_at).toLocaleString() : ''
            )
          )
        )
      )
    ),
    showLogin && React.createElement(
      Modal,
      { title: 'Login', onClose: function () { setShowLogin(false); } },
      React.createElement(
        'form',
        { onSubmit: handleLoginSubmit },
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Email'),
          React.createElement('input', {
            type: 'email',
            value: loginForm.email,
            onChange: function (e) { setLoginForm({ email: e.target.value, password: loginForm.password }); },
            required: true
          })
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Password'),
          React.createElement('input', {
            type: 'password',
            value: loginForm.password,
            onChange: function (e) { setLoginForm({ email: loginForm.email, password: e.target.value }); },
            required: true
          })
        ),
        React.createElement(
          'button',
          { type: 'submit', className: 'btn btn-primary' },
          'Login'
        )
      )
    ),
    showRegister && React.createElement(
      Modal,
      { title: 'Register', onClose: function () { setShowRegister(false); } },
      React.createElement(
        'form',
        { onSubmit: handleRegisterSubmit },
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Name'),
          React.createElement('input', {
            type: 'text',
            value: registerForm.name,
            onChange: function (e) { setRegisterForm(Object.assign({}, registerForm, { name: e.target.value })); },
            required: true
          })
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Email'),
          React.createElement('input', {
            type: 'email',
            value: registerForm.email,
            onChange: function (e) { setRegisterForm(Object.assign({}, registerForm, { email: e.target.value })); },
            required: true
          })
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Password'),
          React.createElement('input', {
            type: 'password',
            value: registerForm.password,
            onChange: function (e) { setRegisterForm(Object.assign({}, registerForm, { password: e.target.value })); },
            required: true
          })
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'I am a:'),
          React.createElement(
            'select',
            {
              value: registerForm.role,
              onChange: function (e) { setRegisterForm(Object.assign({}, registerForm, { role: e.target.value })); }
            },
            React.createElement('option', { value: 'user' }, 'User/Person in need'),
            React.createElement('option', { value: 'volunteer' }, 'Volunteer')
          )
        ),
        registerForm.role === 'volunteer' && React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Volunteer Radius (km)'),
          React.createElement('input', {
            type: 'number',
            min: 1,
            max: 50,
            value: registerForm.volunteer_radius,
            onChange: function (e) { setRegisterForm(Object.assign({}, registerForm, { volunteer_radius: e.target.value })); }
          })
        ),
        React.createElement(
          'button',
          { type: 'submit', className: 'btn btn-primary' },
          'Register'
        )
      )
    ),
    showAddPin && React.createElement(
      Modal,
      {
        title: addPinType === 'need' ? 'Report a Need' : 'Offer Help',
        onClose: function () { setShowAddPin(false); }
      },
      React.createElement(
        'form',
        { onSubmit: handleAddPinSubmit },
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Category'),
          React.createElement(
            'select',
            {
              value: addPinForm.category,
              onChange: function (e) { setAddPinForm(Object.assign({}, addPinForm, { category: e.target.value })); },
              required: true
            },
            React.createElement('option', { value: '' }, 'Select Category'),
            React.createElement('option', { value: 'Water' }, 'Water'),
            React.createElement('option', { value: 'Food' }, 'Food'),
            React.createElement('option', { value: 'Shelter' }, 'Shelter'),
            React.createElement('option', { value: 'Medical' }, 'Medical'),
            React.createElement('option', { value: 'Transport' }, 'Transport')
          )
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Details'),
          React.createElement('textarea', {
            value: addPinForm.details,
            onChange: function (e) { setAddPinForm(Object.assign({}, addPinForm, { details: e.target.value })); },
            required: true
          })
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Quantity/Details'),
          React.createElement('input', {
            type: 'text',
            value: addPinForm.quantity,
            onChange: function (e) { setAddPinForm(Object.assign({}, addPinForm, { quantity: e.target.value })); }
          })
        ),
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', null, 'Location'),
          React.createElement(
            'div',
            { className: 'location-input' },
            React.createElement(
              'button',
              { type: 'button', className: 'btn btn-outline', onClick: handleUseCurrentLocation },
              'Use Current Location'
            ),
            React.createElement(
              'span',
              { className: 'location-status' + (currentLocation ? ' success' : '') },
              currentLocation
                ? 'Location: ' + currentLocation.lat.toFixed(6) + ', ' + currentLocation.lng.toFixed(6)
                : 'Click on the map or use current location'
            )
          )
        ),
        React.createElement(
          'button',
          { type: 'submit', className: 'btn btn-primary' },
          'Add Pin'
        )
      )
    ),
    React.createElement(Notification, {
      notification: notification,
      onClose: function () { setNotification(null); }
    })
  );
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(React.createElement(App));
