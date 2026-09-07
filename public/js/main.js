// ── 3D Tilt Effect ──
document.querySelectorAll('.card, .stat-card, .guild-card').forEach(el => {
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (y - 0.5) * -15;
    const rotateY = (x - 0.5) * 15;
    el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    el.style.setProperty('--mouse-x', `${x * 100}%`);
    el.style.setProperty('--mouse-y', `${y * 100}%`);
  });

  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
});

// ── Scroll Animations ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// ── Live Stats ──
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    document.querySelectorAll('[data-stat]').forEach(el => {
      const key = el.dataset.stat;
      if (data[key] !== undefined) {
        animateNumber(el, data[key]);
      }
    });

    document.querySelectorAll('[data-stat-uptime]').forEach(el => {
      el.textContent = formatUptime(data.uptime);
    });

    document.querySelectorAll('[data-stat-ping]').forEach(el => {
      el.textContent = data.ping + 'ms';
    });

    document.querySelectorAll('[data-stat-memory]').forEach(el => {
      el.textContent = data.memory + 'MB';
    });
  } catch (e) {
    console.error('Stats fetch error:', e);
  }
}

function animateNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const diff = target - current;
  const steps = 30;
  const increment = diff / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    el.textContent = Math.round(current + increment * step).toLocaleString();
    if (step >= steps) {
      clearInterval(timer);
      el.textContent = target.toLocaleString();
    }
  }, 20);
}

function formatUptime(ms) {
  if (!ms) return '0m';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Live Stats via WebSocket ──
function connectWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'stats') {
          document.querySelectorAll('[data-stat]').forEach(el => {
            const key = el.dataset.stat;
            if (data[key] !== undefined) animateNumber(el, data[key]);
          });
          document.querySelectorAll('[data-stat-uptime]').forEach(el => { el.textContent = formatUptime(data.uptime); });
          document.querySelectorAll('[data-stat-ping]').forEach(el => { el.textContent = data.ping + 'ms'; });
          document.querySelectorAll('[data-stat-memory]').forEach(el => { el.textContent = data.memory + 'MB'; });
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(connectWebSocket, 5000);
    ws.onerror = () => {};
  } catch {}
}
connectWebSocket();

// Also fallback polling every 10 seconds
setInterval(fetchStats, 10000);

// ── Toggle Switch ──
document.querySelectorAll('.toggle-switch').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    // Find the hidden input next to this toggle
    const hiddenInput = toggle.parentElement.querySelector('input[type="hidden"]');
    if (hiddenInput) {
      hiddenInput.value = toggle.classList.contains('active') ? '1' : '0';
    }
  });
});

// ── Save Settings ──
document.querySelectorAll('.settings-form').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const guildId = form.dataset.guildId;

    // Show saving state
    const btn = form.querySelector('.btn-save');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const res = await fetch(`/api/guild/${guildId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        showToast('Settings saved successfully!');
      } else {
        showToast('Failed to save settings.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
});

// ── Toast Notification ──
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Particles ──
function createParticles() {
  const container = document.querySelector('.particles');
  if (!container) return;

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
    particle.style.animationDelay = Math.random() * 10 + 's';
    particle.style.width = (Math.random() * 3 + 1) + 'px';
    particle.style.height = particle.style.width;
    container.appendChild(particle);
  }
}

createParticles();

// ── Smooth Reveal on Load ──
window.addEventListener('load', () => {
  document.body.classList.add('loaded');
});

// ── Navbar Scroll Effect ──
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  const scrollTop = window.pageYOffset;

  if (scrollTop > lastScroll && scrollTop > 100) {
    navbar.style.transform = 'translateY(-100%)';
  } else {
    navbar.style.transform = 'translateY(0)';
  }
  lastScroll = scrollTop;
});
