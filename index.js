// index.js (complete)
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

function extractMetadata(text) {
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
  const joined = text.replace(/\s+/g, ' ');
  const title = lines.find(l => /title/i.test(l)) || 'Unknown Title';
  const author = lines.find(l => /author/i.test(l)) || 'Unknown Author';
  const yearMatch = joined.match(/\b(1[89]|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : 'Unknown Year';
  const publisher = lines.find(l => /publisher/i.test(l)) || '[Publisher not found]';
  const summary = lines.slice(0, 10).join(' ').slice(0, 300);
  return { title, author, year, publisher, summary };
}

function buildMARC({ title, author, year, publisher, summary }) {
  return `=LDR  00000nam a2200000 a 4500
=001  000000001
=005  ${new Date().toISOString().replace(/[-:.TZ]/g, '')}.0
=008  ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}s${year}\\xx\\eng\\d
=020  ##$a[ISBN not found]
=041  0#$aeng
=100  1#$a${author}
=245  10$a${title} /$c${author}.
=250  ##$aFirst edition.
=264  _1$a[Place not identified] :$b${publisher},$c${year}.
=300  ##$a300 pages :$billustrations ;$c24 cm.
=336  ##$atext$btxt$2rdacontent
=337  ##$aunmediated$bn$2rdamedia
=338  ##$avolume$bnc$2rdacarrier
=500  ##$aCataloged using automated extraction.
=520  ##$a${summary || 'Cataloged using basic automated extraction.'}
=546  ##$aText in Arabic and/or English.`;
}

function buildJSON(metadata) {
  return {
    leader: '00000nam a2200000 a 4500',
    control: {
      id: '000000001',
      date: new Date().toISOString(),
    },
    fields: {
      title: metadata.title,
      author: metadata.author,
      year: metadata.year,
      publisher: metadata.publisher,
      summary: metadata.summary,
    }
  };
}

function buildXML(metadata) {
  return `<?xml version="1.0"?>
<record>
  <leader>00000nam a2200000 a 4500</leader>
  <controlfield tag="001">000000001</controlfield>
  <controlfield tag="005">${new Date().toISOString()}</controlfield>
  <datafield tag="100" ind1="1" ind2="#">
    <subfield code="a">${metadata.author}</subfield>
  </datafield>
  <datafield tag="245" ind1="1" ind2="0">
    <subfield code="a">${metadata.title}</subfield>
  </datafield>
  <datafield tag="264" ind1="_" ind2="1">
    <subfield code="b">${metadata.publisher}</subfield>
    <subfield code="c">${metadata.year}</subfield>
  </datafield>
  <datafield tag="520" ind1="#" ind2="#">
    <subfield code="a">${metadata.summary}</subfield>
  </datafield>
</record>`;
}

app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const data = await pdfParse(buffer);
    const metadata = extractMetadata(data.text);
    const mrk = buildMARC(metadata);
    const json = buildJSON(metadata);
    const xml = buildXML(metadata);
    res.json({ mrk, json, xml });
  } catch (err) {
    res.status(500).json({ error: 'Extraction failed', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ MARC21 Extraction API is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
