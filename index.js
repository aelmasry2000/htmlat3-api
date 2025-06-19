const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());

app.post('/extract', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let text = '';
    const ext = file.originalname.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else {
      text = fs.readFileSync(file.path, 'utf8');
    }

    const mrk = buildMARC(text);
    res.json({ mrk });

  } catch (err) {
    res.status(500).json({ error: 'Extraction failed', details: err.message });
  } finally {
    fs.unlinkSync(file.path);
  }
});

function buildMARC(text) {
  const title = text.split('\n')[0].slice(0, 80).trim() || 'Unknown Title';
  const author = (text.match(/author[:\-–]\s*(.+)/i) || [])[1] || 'Unknown Author';
  const year = (text.match(/\b(1[89]|20)\d{2}\b/) || [])[0] || 'Unknown Year';
  const publisher = (text.match(/publisher[:\-–]?\s*(.+)/i) || [])[1] || '[Publisher not found]';

  return `=LDR  00000nam a2200000 a 4500
=001  000000001
=100  1#$a${author}.
=245  10$a${title} /$c${author}.
=264  _1$a[Place not identified] :$b${publisher},$c${year}.
=520  ##$aCataloged using basic automated extraction.
=546  ##$aText in Arabic and/or English.`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
