const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

function isArabic(text) {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicCount > text.length / 10;
}

function extractEnglishMetadata(text) {
  const lines = text.split('\n').map(l => l.trim());
  const titleLine = lines.find(l => l.toLowerCase().includes("title")) || '';
  const authorLine = lines.find(l => l.toLowerCase().includes("author")) || '';
  const publisherLine = lines.find(l => l.toLowerCase().includes("publisher")) || '';
  const yearMatch = text.match(/\b(1[89]|20)\d{2}\b/);

  const title = titleLine.replace(/.*title[:\-–]*/i, '').trim() || 'Unknown Title';
  const author = authorLine.replace(/.*author[:\-–]*/i, '').trim() || 'Unknown Author';
  const publisher = publisherLine.replace(/.*publisher[:\-–]*/i, '').trim() || 'Unknown Publisher';
  const year = yearMatch ? yearMatch[0] : 'Unknown Year';

  const paras = text.split(/\n\n+/);
  const summary = paras.reduce((a, b) => b.length > a.length ? b : a, "").slice(0, 300);

  return {
    title,
    author,
    publisher,
    year,
    summary: summary || '[No summary]',
    isbn: '',
    issn: '',
    coauthors: []
  };
}

function extractArabicMetadata(text) {
  const lines = text.split('\n').map(l => l.trim());
  const getByLabel = (labels) => {
    for (const label of labels) {
      const line = lines.find(l => l.includes(label));
      if (line) return line.replace(label, '').replace(/[:\-–]/g, '').trim();
    }
    return '';
  };

  const title = getByLabel(['العنوان', 'عنوان الكتاب', 'عنوان']) || lines.find(l => /^[\u0600-\u06FF ]{10,}$/.test(l)) || 'Unknown Title';
  const author = getByLabel(['المؤلف', 'تأليف', 'بقلم', 'إعداد']) || 'Unknown Author';
  const publisher = getByLabel(['الناشر', 'دار النشر']) || 'Unknown Publisher';
  const year = (text.match(/\b(13|14|19|20)\d{2}\b/) || [])[0] || 'Unknown Year';
  const summary = lines.slice(0, 10).filter(l => l.length > 30).join(' ').slice(0, 300) || '[No summary]';

  return {
    title: title.trim(),
    author: author.trim(),
    publisher: publisher.trim(),
    year,
    summary: summary.trim(),
    isbn: '',
    issn: '',
    coauthors: []
  };
}

function buildMARC(metadata, isArabicLang) {
  const now = new Date();
  const controlDate = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const todayShort = now.toISOString().slice(0, 10).replace(/-/g, '');

  const marc = `=LDR  00000nam a2200000 a 4500
=001  000000001
=005  ${controlDate}.0
=008  ${todayShort}s${metadata.year}\\xx\\${isArabicLang ? 'ara' : 'eng'}\\d
=020  ##$a${metadata.isbn || '[ISBN not found]'}
=041  0#$a${isArabicLang ? 'ara' : 'eng'}
=100  1#$a${metadata.author}.
=245  10$a${metadata.title} /$c${metadata.author}.
=250  ##$aFirst edition.
=264  _1$a[Place not identified] :$b${metadata.publisher},$c${metadata.year}.
=300  ##$a300 pages :$billustrations ;$c24 cm.
=336  ##$atext$btxt$2rdacontent
=337  ##$aunmediated$bn$2rdamedia
=338  ##$avolume$bnc$2rdacarrier
=500  ##$aCataloged using automated extraction.
=520  ##$a${metadata.summary}
=546  ##$aText in ${isArabicLang ? 'Arabic' : 'English'}.`;

  return marc;
}

app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const data = await pdfParse(buffer);
    const text = data.text;

    const isArabicLang = isArabic(text);
    const metadata = isArabicLang
      ? extractArabicMetadata(text)
      : extractEnglishMetadata(text);

    const mrk = buildMARC(metadata, isArabicLang);
    res.json({ mrk, metadata });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Extraction failed.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
