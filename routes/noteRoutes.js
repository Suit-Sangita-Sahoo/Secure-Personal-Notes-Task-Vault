const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createNote,
  getNotes,
  deleteNote
} = require('../controllers/noteController');

// Enforce JWT authentication on all notes routes
router.use(authMiddleware);

// Routes for note operations
router.route('/')
  .post(createNote)
  .get(getNotes);

router.route('/:id')
  .delete(deleteNote);

module.exports = router;

