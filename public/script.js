/**
 * Personal Notes Management Application - Client-Side JavaScript
 * Pure Vanilla JavaScript (No external frameworks)
 */

document.addEventListener('DOMContentLoaded', () => {
  // ================= State & Constants =================
  const STORAGE_TOKEN_KEY = 'personal_notes_jwt_token';
  const STORAGE_USER_KEY = 'personal_notes_user_data';

  // API base URLs
  const API_AUTH = '/api/auth';
  const API_NOTES = '/api/notes';

  // ================= DOM Elements =================
  // Notifications
  const notificationEl = document.getElementById('notification');
  const notificationMsgEl = document.getElementById('notification-message');
  const notificationCloseBtn = document.getElementById('notification-close');
  let notificationTimeout = null;

  // Views
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');

  // Auth Tabs & Forms
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const linkToRegister = document.getElementById('link-to-register');
  const authSwitchText = document.getElementById('auth-switch-text');

  // Login inputs & errors
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const loginEmailError = document.getElementById('login-email-error');
  const loginPasswordError = document.getElementById('login-password-error');
  const loginSpinner = document.getElementById('login-spinner');
  const loginSubmitBtn = document.getElementById('login-submit-btn');

  // Register inputs & errors
  const registerNameInput = document.getElementById('register-name');
  const registerEmailInput = document.getElementById('register-email');
  const registerPasswordInput = document.getElementById('register-password');
  const registerNameError = document.getElementById('register-name-error');
  const registerEmailError = document.getElementById('register-email-error');
  const registerPasswordError = document.getElementById('register-password-error');
  const registerSpinner = document.getElementById('register-spinner');
  const registerSubmitBtn = document.getElementById('register-submit-btn');

  // Dashboard elements
  const userDisplayName = document.getElementById('user-display-name');
  const logoutBtn = document.getElementById('logout-btn');
  const openAddNoteBtn = document.getElementById('open-add-note-btn');
  const emptyAddNoteBtn = document.getElementById('empty-add-note-btn');
  const noteFormContainer = document.getElementById('note-form-container');
  const closeNoteFormBtn = document.getElementById('close-note-form-btn');
  const cancelNoteBtn = document.getElementById('cancel-note-btn');
  const noteForm = document.getElementById('note-form');
  const noteTitleInput = document.getElementById('note-title');
  const noteContentInput = document.getElementById('note-content');
  const noteTitleError = document.getElementById('note-title-error');
  const noteContentError = document.getElementById('note-content-error');
  const saveNoteBtn = document.getElementById('save-note-btn');
  const saveSpinner = document.getElementById('save-spinner');

  // Notes containers
  const notesLoading = document.getElementById('notes-loading');
  const notesEmptyState = document.getElementById('notes-empty-state');
  const notesGrid = document.getElementById('notes-grid');

  // ================= Notification System =================
  function showNotification(message, type = 'success') {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }

    notificationEl.className = `notification ${type}`;
    notificationMsgEl.textContent = message;
    notificationEl.classList.remove('hidden');

    notificationTimeout = setTimeout(() => {
      closeNotification();
    }, 4500);
  }

  function closeNotification() {
    notificationEl.classList.add('hidden');
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
  }

  notificationCloseBtn.addEventListener('click', closeNotification);

  // ================= Storage Helpers =================
  function getToken() {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  }

  function setSession(token, user) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }

  function getUser() {
    const data = localStorage.getItem(STORAGE_USER_KEY);
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  }

  // ================= View Switchers =================
  function showDashboard(user) {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    userDisplayName.textContent = user && user.name ? user.name : 'User';
    fetchAndRenderNotes();
  }

  function showAuthScreen() {
    dashboardSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    notesGrid.innerHTML = '';
  }

  function switchToLoginTab() {
    tabLoginBtn.classList.add('active');
    tabLoginBtn.setAttribute('aria-selected', 'true');
    tabRegisterBtn.classList.remove('active');
    tabRegisterBtn.setAttribute('aria-selected', 'false');

    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');

    authSwitchText.innerHTML = `Don't have an account? <a href="#" id="link-to-register">Create one here</a>`;
    document.getElementById('link-to-register').addEventListener('click', (e) => {
      e.preventDefault();
      switchToRegisterTab();
    });

    clearFormErrors();
  }

  function switchToRegisterTab() {
    tabRegisterBtn.classList.add('active');
    tabRegisterBtn.setAttribute('aria-selected', 'true');
    tabLoginBtn.classList.remove('active');
    tabLoginBtn.setAttribute('aria-selected', 'false');

    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');

    authSwitchText.innerHTML = `Already registered? <a href="#" id="link-to-login">Sign in here</a>`;
    document.getElementById('link-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      switchToLoginTab();
    });

    clearFormErrors();
  }

  function clearFormErrors() {
    loginEmailError.textContent = '';
    loginPasswordError.textContent = '';
    registerNameError.textContent = '';
    registerEmailError.textContent = '';
    registerPasswordError.textContent = '';
    noteTitleError.textContent = '';
    noteContentError.textContent = '';
  }

  // Auth Tab Listeners
  tabLoginBtn.addEventListener('click', switchToLoginTab);
  tabRegisterBtn.addEventListener('click', switchToRegisterTab);
  linkToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    switchToRegisterTab();
  });

  // ================= Auth Handlers =================
  // 1. User Registration
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const name = registerNameInput.value.trim();
    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value;

    let hasError = false;
    if (!name) {
      registerNameError.textContent = 'Name is required.';
      hasError = true;
    } else if (name.length < 2) {
      registerNameError.textContent = 'Name must be at least 2 characters.';
      hasError = true;
    }

    if (!email) {
      registerEmailError.textContent = 'Email address is required.';
      hasError = true;
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      registerEmailError.textContent = 'Please enter a valid email address.';
      hasError = true;
    }

    if (!password) {
      registerPasswordError.textContent = 'Password is required.';
      hasError = true;
    } else if (password.length < 6) {
      registerPasswordError.textContent = 'Password must be at least 6 characters.';
      hasError = true;
    }

    if (hasError) return;

    // Trigger loading spinner
    registerSubmitBtn.disabled = true;
    registerSpinner.classList.remove('hidden');

    try {
      const response = await fetch(`${API_AUTH}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.message || 'Registration failed.', 'error');
        if (response.status === 409) {
          registerEmailError.textContent = data.message;
        }
        return;
      }

      showNotification('Registration successful! Please sign in with your credentials.', 'success');
      registerForm.reset();
      switchToLoginTab();
      loginEmailInput.value = email;
      loginPasswordInput.focus();
    } catch (err) {
      console.error('Registration network error:', err);
      showNotification('Network connection error. Please try again.', 'error');
    } finally {
      registerSubmitBtn.disabled = false;
      registerSpinner.classList.add('hidden');
    }
  });

  // 2. User Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    let hasError = false;
    if (!email) {
      loginEmailError.textContent = 'Email address is required.';
      hasError = true;
    }
    if (!password) {
      loginPasswordError.textContent = 'Password is required.';
      hasError = true;
    }

    if (hasError) return;

    loginSubmitBtn.disabled = true;
    loginSpinner.classList.remove('hidden');

    try {
      const response = await fetch(`${API_AUTH}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.message || 'Login failed.', 'error');
        loginPasswordError.textContent = data.message || 'Invalid credentials';
        return;
      }

      // Save token and user details to localStorage
      setSession(data.token, data.user);
      loginForm.reset();
      showNotification(`Welcome back, ${data.user.name}!`, 'success');
      showDashboard(data.user);
    } catch (err) {
      console.error('Login network error:', err);
      showNotification('Network connection error. Please try again.', 'error');
    } finally {
      loginSubmitBtn.disabled = false;
      loginSpinner.classList.add('hidden');
    }
  });

  // 3. Logout
  logoutBtn.addEventListener('click', () => {
    clearSession();
    showNotification('You have logged out securely.', 'success');
    showAuthScreen();
    switchToLoginTab();
  });

  // ================= Note Form Toggles =================
  function openNoteForm() {
    noteFormContainer.classList.remove('hidden');
    noteTitleInput.focus();
    clearFormErrors();
  }

  function hideNoteForm() {
    noteFormContainer.classList.add('hidden');
    noteForm.reset();
    clearFormErrors();
  }

  openAddNoteBtn.addEventListener('click', openNoteForm);
  emptyAddNoteBtn.addEventListener('click', openNoteForm);
  closeNoteFormBtn.addEventListener('click', hideNoteForm);
  cancelNoteBtn.addEventListener('click', hideNoteForm);

  // ================= Notes Management =================
  // 1. Fetch & Render Notes
  async function fetchAndRenderNotes() {
    const token = getToken();
    if (!token) {
      clearSession();
      showAuthScreen();
      return;
    }

    notesLoading.classList.remove('hidden');
    notesEmptyState.classList.add('hidden');
    notesGrid.innerHTML = '';

    try {
      const response = await fetch(API_NOTES, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired or invalid
        clearSession();
        showNotification('Session expired or unauthorized. Please sign in again.', 'error');
        showAuthScreen();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.message || 'Failed to fetch notes.', 'error');
        return;
      }

      const notes = data.notes || [];

      if (notes.length === 0) {
        notesEmptyState.classList.remove('hidden');
      } else {
        notesEmptyState.classList.add('hidden');
        renderNotesList(notes);
      }
    } catch (err) {
      console.error('Fetch notes error:', err);
      showNotification('Failed to load notes due to a network error.', 'error');
    } finally {
      notesLoading.classList.add('hidden');
    }
  }

  // 2. Render Note Cards safely using textContent (Mitigating XSS attacks)
  function renderNotesList(notes) {
    notesGrid.innerHTML = '';

    notes.forEach((note) => {
      const card = document.createElement('article');
      card.className = 'note-card';
      card.dataset.id = note._id;

      // Note Title (safe textContent)
      const titleEl = document.createElement('h3');
      titleEl.className = 'note-card-title';
      titleEl.textContent = note.title;

      // Note Content (safe textContent)
      const contentEl = document.createElement('p');
      contentEl.className = 'note-card-content';
      contentEl.textContent = note.content;

      // Card Footer
      const footerEl = document.createElement('footer');
      footerEl.className = 'note-card-footer';

      // Creation Date
      const dateEl = document.createElement('span');
      dateEl.className = 'note-date';
      const createdDate = new Date(note.createdAt);
      dateEl.textContent = isNaN(createdDate.getTime())
        ? 'Recent'
        : createdDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger-outline';
      deleteBtn.setAttribute('aria-label', `Delete note titled ${note.title}`);
      deleteBtn.textContent = 'Delete';

      deleteBtn.addEventListener('click', () => {
        handleDeleteNote(note._id, note.title);
      });

      footerEl.appendChild(dateEl);
      footerEl.appendChild(deleteBtn);

      card.appendChild(titleEl);
      card.appendChild(contentEl);
      card.appendChild(footerEl);

      notesGrid.appendChild(card);
    });
  }

  // 3. Create Note
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();

    let hasError = false;
    if (!title) {
      noteTitleError.textContent = 'Note title is required.';
      hasError = true;
    }
    if (!content) {
      noteContentError.textContent = 'Note content is required.';
      hasError = true;
    }

    if (hasError) return;

    const token = getToken();
    if (!token) {
      clearSession();
      showAuthScreen();
      return;
    }

    saveNoteBtn.disabled = true;
    saveSpinner.classList.remove('hidden');

    try {
      const response = await fetch(API_NOTES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content })
      });

      if (response.status === 401) {
        clearSession();
        showNotification('Session expired. Please sign in again.', 'error');
        showAuthScreen();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.message || 'Failed to create note.', 'error');
        return;
      }

      showNotification('Note created successfully!', 'success');
      hideNoteForm();
      fetchAndRenderNotes();
    } catch (err) {
      console.error('Create note error:', err);
      showNotification('Network error while saving note.', 'error');
    } finally {
      saveNoteBtn.disabled = false;
      saveSpinner.classList.add('hidden');
    }
  });

  // 4. Delete Note with Confirmation
  async function handleDeleteNote(noteId, noteTitle) {
    const confirmed = window.confirm(`Are you sure you want to delete note "${noteTitle}"? This action cannot be undone.`);
    if (!confirmed) return;

    const token = getToken();
    if (!token) {
      clearSession();
      showAuthScreen();
      return;
    }

    try {
      const response = await fetch(`${API_NOTES}/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        clearSession();
        showNotification('Session expired. Please sign in again.', 'error');
        showAuthScreen();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.message || 'Failed to delete note.', 'error');
        return;
      }

      showNotification('Note deleted successfully.', 'success');

      // Remove card smoothly from DOM
      const card = document.querySelector(`.note-card[data-id="${noteId}"]`);
      if (card) {
        card.remove();
      }

      // Check if grid is now empty
      const remainingCards = document.querySelectorAll('.note-card');
      if (remainingCards.length === 0) {
        notesEmptyState.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Delete note error:', err);
      showNotification('Network error while deleting note.', 'error');
    }
  }

  // ================= App Initialization =================
  const activeToken = getToken();
  const activeUser = getUser();

  if (activeToken && activeUser) {
    showDashboard(activeUser);
  } else {
    showAuthScreen();
    switchToLoginTab();
  }
});

