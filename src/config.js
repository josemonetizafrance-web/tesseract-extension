// TESSERACT - Configuración del servidor integrado
// Apunta al backend unificado (Extension/backend)
const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TESSERACT_API };
}
