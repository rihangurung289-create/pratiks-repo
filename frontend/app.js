// Global variables
let map;
let currentUser = null;
let allPins = [];
let markers = [];
let currentPinType = 'need'; // 'need' or 'offer'
let currentLocation = null;

// API Configuration
const API_BASE = 'http://localhost:4000/api';

// Map Configuration
const DEFAULT_CENTER = [27.7172, 85.3240]; // Kathmandu center
const DEFAULT_ZOOM = 12;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    checkAuthStatus();
    loadPins();
});

// Initialize the Leaflet map
function initializeMap() {
    map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add click handler for adding pins
    map.on('click', function(e) {
        if (currentUser && (currentUser.role === 'user' || currentUser.role === 'volunteer')) {
            showAddPinModal(e.latlng);
        }
    });
}

// Setup all event listeners
function setupEventListeners() {
    // Auth buttons
    document.getElementById('login-btn').addEventListener('click', () => showModal('login-modal'));
    document.getElementById('register-btn').addEventListener('click', () => showModal('register-modal'));
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterPins(this.dataset.type);
        });
    });

    // Category filters
    document.querySelectorAll('.category-filters input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', filterPins);
    });

    // Add pin buttons
    document.getElementById('add-need-btn').addEventListener('click', () => {
        if (!currentUser) {
            showNotification('Please login to add needs', 'error');
            return;
        }
        currentPinType = 'need';
        showAddPinModal();
    });

    document.getElementById('add-offer-btn').addEventListener('click', () => {
        if (!currentUser) {
            showNotification('Please login to offer help', 'error');
            return;
        }
        currentPinType = 'offer';
        showAddPinModal();
    });

    // Modal close buttons
    document.querySelectorAll('.close, .modal .close').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            hideModal(modal.id);
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });

    // Forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('add-pin-form').addEventListener('submit', handleAddPin);

    // Role selection in register form
    document.getElementById('register-role').addEventListener('change', function() {
        const volunteerFields = document.querySelector('.volunteer-field');
        if (this.value === 'volunteer') {
            volunteerFields.style.display = 'block';
        } else {
            volunteerFields.style.display = 'none';
        }
    });

    // Location button
    document.getElementById('use-current-location').addEventListener('click', getCurrentLocation);

    // Close pin details
    document.getElementById('close-details').addEventListener('click', hidePinDetails);
}

// Authentication functions
async function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const response = await fetch(`${API_BASE}/auth/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                showUserSection();
            } else {
                localStorage.removeItem('authToken');
                showAuthSection();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            showAuthSection();
        }
    } else {
        showAuthSection();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            hideModal('login-modal');
            showUserSection();
            showNotification('Login successful!', 'success');
        } else {
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showNotification('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;
    const volunteer_radius = document.getElementById('volunteer-radius').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                email, 
                password, 
                role, 
                volunteer_radius: parseInt(volunteer_radius) 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            hideModal('register-modal');
            showUserSection();
            showNotification('Registration successful!', 'success');
        } else {
            showNotification(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showNotification('Registration failed. Please try again.', 'error');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    currentUser = null;
    showAuthSection();
    showNotification('Logged out successfully', 'info');
}

// UI State Management
function showAuthSection() {
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('user-section').style.display = 'none';
}

function showUserSection() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('user-section').style.display = 'flex';
    document.getElementById('user-name').textContent = currentUser.name;
}

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function showAddPinModal(latlng = null) {
    document.getElementById('add-pin-title').textContent = 
        currentPinType === 'need' ? 'Report a Need' : 'Offer Help';
    
    // Update form action
    const form = document.getElementById('add-pin-form');
    form.dataset.type = currentPinType;
    
    if (latlng) {
        currentLocation = latlng;
        document.getElementById('location-status').textContent = 
            `Location: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
        document.getElementById('location-status').className = 'location-status success';
    } else {
        document.getElementById('location-status').textContent = 'Click on map or use current location';
        document.getElementById('location-status').className = 'location-status';
    }
    
    showModal('add-pin-modal');
}

// Location functions
async function getCurrentLocation() {
    const statusElement = document.getElementById('location-status');
    
    if (!navigator.geolocation) {
        statusElement.textContent = 'Geolocation is not supported';
        statusElement.className = 'location-status error';
        return;
    }
    
    statusElement.textContent = 'Getting location...';
    statusElement.className = 'location-status';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            statusElement.textContent = 
                `Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`;
            statusElement.className = 'location-status success';
            
            // Move map to current location
            map.setView([currentLocation.lat, currentLocation.lng], 15);
        },
        function(error) {
            statusElement.textContent = 'Unable to get location';
            statusElement.className = 'location-status error';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

// Pin management functions
async function handleAddPin(e) {
    e.preventDefault();
    
    if (!currentLocation) {
        showNotification('Please select a location first', 'error');
        return;
    }
    
    const category = document.getElementById('pin-category').value;
    const details = document.getElementById('pin-details-input').value;
    const quantity = document.getElementById('pin-quantity').value;
    
    const pinData = {
        type: e.target.dataset.type,
        category,
        details,
        quantity,
        lat: currentLocation.lat,
        lng: currentLocation.lng
    };
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/pins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(pinData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hideModal('add-pin-modal');
            showNotification('Pin added successfully!', 'success');
            loadPins(); // Reload pins
            
            // Check geo-fencing
            checkGeoFencing(data.id);
        } else {
            showNotification(data.error || 'Failed to add pin', 'error');
        }
    } catch (error) {
        showNotification('Failed to add pin. Please try again.', 'error');
    }
}

async function loadPins() {
    try {
        const response = await fetch(`${API_BASE}/pins`);
        const data = await response.json();
        
        if (response.ok) {
            allPins = data.pins;
            displayPins();
        }
    } catch (error) {
        console.error('Failed to load pins:', error);
    }
}

function displayPins() {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Get active filters
    const typeFilter = document.querySelector('.filter-btn.active').dataset.type;
    const categoryFilters = Array.from(document.querySelectorAll('.category-filters input:checked'))
        .map(cb => cb.value);
    
    // Filter pins
    const filteredPins = allPins.filter(pin => {
        const typeMatch = typeFilter === 'all' || pin.type === typeFilter;
        const categoryMatch = categoryFilters.length === 0 || categoryFilters.includes(pin.category);
        return typeMatch && categoryMatch;
    });
    
    // Add markers for filtered pins
    filteredPins.forEach(pin => {
        const marker = createPinMarker(pin);
        marker.addTo(map);
        markers.push(marker);
    });
}

function createPinMarker(pin) {
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="${pin.type}-marker ${pin.status === 'verified' ? 'verified-marker' : ''}">
                ${pin.type === 'need' ? '🔴' : '🟢'}
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    const marker = L.marker([pin.lat, pin.lng], { icon });
    
    // Create popup content
    const popupContent = `
        <div style="max-width: 250px;">
            <h4>${pin.type === 'need' ? 'Need Help' : 'Offer Help'}</h4>
            <p><strong>Category:</strong> ${pin.category}</p>
            <p><strong>Details:</strong> ${pin.details}</p>
            ${pin.quantity ? `<p><strong>Quantity:</strong> ${pin.quantity}</p>` : ''}
            <p><strong>Status:</strong> <span class="status-badge status-${pin.status}">${pin.status}</span></p>
            <button onclick="showPinDetails('${pin.id}')" style="background: #667eea; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                View Details
            </button>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    return marker;
}

function filterPins(filterType) {
    displayPins();
}

// Pin details panel
function showPinDetails(pinId) {
    const pin = allPins.find(p => p.id === pinId);
    if (!pin) return;
    
    const detailsPanel = document.getElementById('pin-details');
    const titleElement = document.getElementById('pin-title');
    const contentElement = document.getElementById('pin-content');
    
    titleElement.textContent = pin.type === 'need' ? 'Need Help' : 'Offer Help';
    
    contentElement.innerHTML = `
        <div class="detail-row">
            <span class="label">Category:</span>
            <span class="value">${pin.category}</span>
        </div>
        <div class="detail-row">
            <span class="label">Details:</span>
            <span class="value">${pin.details}</span>
        </div>
        ${pin.quantity ? `
            <div class="detail-row">
                <span class="label">Quantity:</span>
                <span class="value">${pin.quantity}</span>
            </div>
        ` : ''}
        <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">
                <span class="status-badge status-${pin.status}">${pin.status}</span>
            </span>
        </div>
        <div class="detail-row">
            <span class="label">Location:</span>
            <span class="value">${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}</span>
        </div>
        <div class="detail-row">
            <span class="label">Created:</span>
            <span class="value">${new Date(pin.created_at).toLocaleString()}</span>
        </div>
    `;
    
    detailsPanel.classList.add('show');
}

function hidePinDetails() {
    document.getElementById('pin-details').classList.remove('show');
}

// Geo-fencing functions
function checkGeoFencing(pinId) {
    if (!currentUser || currentUser.role !== 'volunteer') return;
    
    const pin = allPins.find(p => p.id === pinId);
    if (!pin) return;
    
    // Simple geo-fencing check (volunteer center vs pin location)
    if (currentUser.center_lat && currentUser.center_lng) {
        const distance = calculateDistance(
            currentUser.center_lat, currentUser.center_lng,
            pin.lat, pin.lng
        );
        
        if (distance <= currentUser.volunteer_radius * 1000) {
            showNotification(
                `New ${pin.type} detected in your area: ${pin.category}`,
                'info'
            );
        }
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Convert to meters
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Auto-refresh pins every 30 seconds
setInterval(() => {
    loadPins();
}, 30000);