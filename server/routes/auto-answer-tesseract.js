/**
 * ROUTES/AUTO-ANSWER-TESSERACT - Plantillas y configuraci├│n de Auto-Answer
 * Nota: Los datos se guardan en chrome.storage.local de la extensi├│n, no en servidor
 */
const { Router } = require('express');
const { validateToken } = require('../middleware/auth-tesseract.js');

const router = Router();
router.use('/api/tess/auto-answer', validateToken);

// GET /api/tess/auto-answer/templates - Datos guardados localmente en extensi├│n
router.get('/api/tess/auto-answer/templates', (req, res) => {
  res.json({ message: 'Configuraci├│n guardada en chrome.storage.local de la extensi├│n' });
});

// POST /api/tess/auto-answer/templates - Datos guardados localmente en extensi├│n
router.post('/api/tess/auto-answer/templates', (req, res) => {
  res.json({ success: true, message: 'Guardado en chrome.storage.local' });
});

// POST /api/tess/auto-answer/config - Datos guardados localmente en extensi├│n
router.post('/api/tess/auto-answer/config', (req, res) => {
  res.json({ success: true, message: 'Guardado en chrome.storage.local' });
});

// POST /api/tess/auto-answer/increment - Datos guardados localmente en extensi├│n
router.post('/api/tess/auto-answer/increment', (req, res) => {
  res.json({ success: true, count: 0 });
});

module.exports = router;
