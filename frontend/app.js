// app.js
// Entry point — verkabelt die Module und exponiert Funktionen an window
// (für die inline-onclick-Handler im HTML).

import { register, login, logout, bootstrap } from './modules/auth.js';
import { showCreateGroup, closeCreateGroup, createGroup, loadGroupList, openGroupChat, closeGroupChat, sendGroupMessage } from './modules/groups.js';
import { showScreen } from './modules/ui.js';
import { connectSocket } from './modules/socket-client.js';
import { requestNotificationPermission } from './modules/notifications.js';

// window-exposed (HTML-onclick)
window.showLogin = () => showScreen('loginScreen');
window.showRegister = () => showScreen('registerScreen');
window.register = register;
window.login = login;
window.logout = logout;

window.showCreateGroup = showCreateGroup;
window.closeCreateGroup = closeCreateGroup;
window.createGroup = createGroup;
window.openGroupChat = openGroupChat;
window.closeGroupChat = closeGroupChat;
window.sendGroupMessage = sendGroupMessage;

window.requestNotifications = requestNotificationPermission;
window.loadGroupList = loadGroupList;

// === User-Events ===

window.addEventListener('userLoggedIn', async (e) => {
  connectSocket();
  await loadGroupList();
});

window.addEventListener('auth:expired', () => {
  showScreen('loginScreen');
});

// === Theme Toggle (Dark Mode) ===
window.toggleDarkMode = function () {
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const current = html.getAttribute('data-theme');
  if (current === 'dark') {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    if (btn) btn.textContent = '🌙';
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    if (btn) btn.textContent = '☀️';
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('theme');
  const btn = document.getElementById('themeToggle');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (btn) btn.textContent = '☀️';
  }
});

// === Boot ===
bootstrap();
console.log('✅ Messenger frontend loaded');
