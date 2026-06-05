// modules/groups.js
// Group-Liste, Group-Detail, Messages laden + senden, Real-time-Empfang.

import { api } from "./apiClient.js";
import {
  setCurrentGroupId, getCurrentGroupId, setCurrentGroup,
} from "./state.js";
import { joinGroup, leaveGroup, getSocket } from "./socket-client.js";
import { escapeHtml, formatTime, showError, spinner } from "./ui.js";

let messageHandlers = new Set();

// === Listen ===

export async function loadGroupList() {
  spinner("groupList");
  try {
    const { groups } = await api("/api/groups");
    renderGroupList(groups);
  } catch (e) {
    document.getElementById("groupList").innerHTML =
      `<div class="error">Fehler: ${escapeHtml(e.message)}</div>`;
  }
}

function renderGroupList(groups) {
  const el = document.getElementById("groupList");
  if (!groups?.length) {
    el.innerHTML = '<div class="empty-state">Noch keine Gruppen. Leg eine an!</div>';
    return;
  }
  el.innerHTML = groups.map(g => `
    <div class="dm-chat-item" onclick="openGroupChat('${g.id}')">
      <div class="avatar">👥</div>
      <div class="dm-chat-info">
        <div class="dm-chat-name">${escapeHtml(g.name)}</div>
        <div class="dm-chat-preview">${g.memberCount} Mitglieder</div>
      </div>
    </div>
  `).join("");
}

// === Create ===

export async function createGroup() {
  const name = document.getElementById("groupNameInput").value.trim();
  const description = document.getElementById("groupDescInput").value.trim();
  if (!name) return showError("createGroupError", "Name erforderlich.");

  try {
    const { group } = await api("/api/groups", {
      method: "POST",
      body: { name, description: description || undefined, memberIds: [] },
    });
    document.getElementById("groupNameInput").value = "";
    document.getElementById("groupDescInput").value = "";
    closeCreateGroup();
    await loadGroupList();
    openGroupChat(group.id);
  } catch (e) {
    showError("createGroupError", e.message || "Erstellen fehlgeschlagen.");
  }
}

export function showCreateGroup() {
  document.getElementById("createGroupModal").classList.remove("hidden");
}
export function closeCreateGroup() {
  document.getElementById("createGroupModal").classList.add("hidden");
}

// === Open / Close ===

export async function openGroupChat(groupId) {
  // Vorherige Gruppe verlassen
  if (getCurrentGroupId()) leaveGroup(getCurrentGroupId());

  setCurrentGroupId(groupId);

  try {
    const { group, myRole } = await api(`/api/groups/${groupId}`);
    setCurrentGroup(group);

    // Join Socket-Room
    try { await joinGroup(groupId); } catch (e) {
      console.warn("socket join failed", e);
    }

    // History laden
    const { messages } = await api(`/api/groups/${groupId}/messages?limit=50`);
    renderGroupHeader(group);
    renderMessages(messages);

    // Live-Listener
    const socket = getSocket();
    if (socket) {
      const onMsg = (msg) => {
        if (msg.groupId !== groupId) return;
        appendMessage(msg);
        scrollToBottom();
      };
      socket.on("message:new", onMsg);
      messageHandlers.add(onMsg);
    }

    document.getElementById("groupListView").classList.add("hidden");
    document.getElementById("groupChatView").classList.remove("hidden");
  } catch (e) {
    showError("groupList", "Chat konnte nicht geöffnet werden: " + e.message);
  }
}

export function closeGroupChat() {
  if (getCurrentGroupId()) leaveGroup(getCurrentGroupId());
  setCurrentGroupId(null);
  setCurrentGroup(null);

  // Listener abhängen
  const socket = getSocket();
  if (socket) {
    for (const h of messageHandlers) socket.off("message:new", h);
    messageHandlers.clear();
  }

  document.getElementById("groupChatView").classList.add("hidden");
  document.getElementById("groupListView").classList.remove("hidden");
  loadGroupList();
}

function renderGroupHeader(group) {
  document.getElementById("groupChatName").textContent = group.name;
  document.getElementById("groupChatMembers").textContent =
    group.members.map(m => "@" + m.user.username).join(", ");
}

// === Messages ===

export async function sendGroupMessage() {
  const input = document.getElementById("groupMessageInput");
  const text = input.value.trim();
  if (!text) return;
  const groupId = getCurrentGroupId();
  if (!groupId) return;
  input.value = "";

  try {
    await api(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: { text },
    });
    // Server broadcastet 'message:new' zurück, das rendert sich selbst
  } catch (e) {
    showError("groupMessages", e.message);
  }
}

function renderMessages(messages) {
  const el = document.getElementById("groupMessages");
  el.innerHTML = messages.map(msgHtml).join("");
  scrollToBottom();
}

function appendMessage(msg) {
  const el = document.getElementById("groupMessages");
  el.insertAdjacentHTML("beforeend", msgHtml(msg));
}

function msgHtml(msg) {
  return `
    <div class="message">
      <div class="message-meta">
        <strong>@${escapeHtml(msg.author.username)}</strong>
        <small>${formatTime(msg.createdAt)}</small>
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
    </div>
  `;
}

function scrollToBottom() {
  const el = document.getElementById("groupMessages");
  if (el) el.scrollTop = el.scrollHeight;
}
