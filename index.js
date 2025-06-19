const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdf = require("pdf-parse");
const app = express();

app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

function clean(text) {
  return text.replace(/\s+/g, " ").replace(/[\x00-\x1F\x7F]/g, "").trim();
}

function extractMetadata(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const topLines = lines.slice(0, 20);

  let title = "";
  let author = "";

  if (isArabic) {
    title = topLines.find(l => /^[\u0600-\u06FF\s]{10,}$/.test(l)) || "عنوان غير معروف";
    const aLine = lines.find(l => /(?:تأليف|بقلم)/.test(l));
    author = aLine ? aLine.replace(/.*(?:تأليف|بقلم)/, "").trim() : "مؤلف غير معروف";
  } else {
    title = topLines.find(l => /^[A-Z][A-Z\s,:;'"&-]{10,80}$/.test(l)) || topLines[0] || "Unknown Title";
    const byLine = topLines.find(l => /\bby\b/i.test(l)) || lines.find(l => /\bby\b/i.test(l));
    author = byLine ? byLine.replace(/.*\bby\b/i, "").trim() : "Unknown Author";
  }

  title = clean(title);
  author = clean(author);

  const year = (text.match(/\b(18|19|20)\d{2}\b/) || [])[0] || "Unknown Year";
  const isbn = clean((text.match(/isbn[:\s]*([\d\-]+)/i) || [])[1] || "[ISBN not found]");
  const publisher = clean((text.match(/(?:publisher|published by|الناشر)[:\-–]?\s*(.+)/i) || [])[1] || "[Publisher not found]");

  const paras = text.split(/\n\s*\n/);
  const summary = clean(paras.reduce((a, b) => b.length > a.length ? b : a, "").slice(0, 300));

  return {
    title,
    author,
    publisher,
    year,
    isbn,
    issn: "",
    summary,
    coauthors: []
  };
}

function buildMARC(metadata) {
  const now = new Date();
  const controlDate = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const todayShort = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `=LDR  00000nam a2200000 a 4500
=001  000000001
=005  ${controlDate}.0
=008  ${todayShort}s${metadata.year}\\xx\\eng\\d
=020  ##$a${metadata.isbn}
=041  0#$aeng
=100  1#$a${metadata.author}
=245  10$a${metadata.title} /$c${metadata.author}
=250  ##$aFirst edition.
=264  _1$a[Place not identified] :$b${metadata.publisher},$c${metadata.year}.
=300  ##$a300 pages :$billustrations ;$c24 cm.
=336  ##$atext$btxt$2rdacontent
=337  ##$aunmediated$bn$2rdamedia
=338  ##$avolume$bnc$2rdacarrier
=500  ##$aCataloged using automated extraction.
=520  ##$a${metadata.summary || '[No summary found]'}
=546  ##$aText in Arabic and/or English.`;
}

app.post("/extract", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const data = await pdf(req.file.buffer);
    const text = data.text;
    const metadata = extractMetadata(text);
    const mrk = buildMARC(metadata);
    res.json({ mrk, metadata });
  } catch (err) {
    res.status(500).json({ error: "Extraction failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
