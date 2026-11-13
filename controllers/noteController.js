const mongoose = require('mongoose');
const Note = require('../models/Note');

/**
 * @desc    Create a new note for the authenticated user
 * @route   POST /api/notes
 * @access  Private (JWT Required)
 */
const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;

    // Validate fields
    if (!title || !content || !title.trim() || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required fields.'
      });
    }

    // Authorization guarantee: Always assign user ID strictly from the verified JWT payload
    const newNote = new Note({
      title: title.trim(),
      content: content.trim(),
      user: req.user.id
    });

    const savedNote = await newNote.save();

    return res.status(201).json({
      success: true,
      message: 'Note created successfully.',
      note: savedNote
    });
  } catch (error) {
    console.error('[Create Note Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating note.'
    });
  }
};

/**
 * @desc    Fetch all notes belonging ONLY to the authenticated user
 * @route   GET /api/notes
 * @access  Private (JWT Required)
 */
const getNotes = async (req, res) => {
  try {
    // Strictly filter notes by the authenticated user's ID
    const notes = await Note.find({ user: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notes.length,
      notes
    });
  } catch (error) {
    console.error('[Get Notes Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching notes.'
    });
  }
};

/**
 * @desc    Delete a note belonging to the authenticated user
 * @route   DELETE /api/notes/:id
 * @access  Private (JWT Required)
 */
const deleteNote = async (req, res) => {
  try {
    const noteId = req.params.id;

    // Validate whether the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Note ID format.'
      });
    }

    // Strict ownership enforcement: Find and delete only if BOTH note ID and user ID match
    const deletedNote = await Note.findOneAndDelete({
      _id: noteId,
      user: req.user.id
    });

    // If no note matched both criteria, it either doesn't exist or belongs to another user
    if (!deletedNote) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or unauthorized to delete.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Note deleted successfully.'
    });
  } catch (error) {
    console.error('[Delete Note Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting note.'
    });
  }
};

module.exports = {
  createNote,
  getNotes,
  deleteNote
};

