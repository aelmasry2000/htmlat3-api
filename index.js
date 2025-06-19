const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");

const app = express();
const upload = multer();
app.use(cors());

app.post("/extract", upload.single("file"), async (req, res) => {
  try {
    const dataBuffer = req.file.buffer;
    const data = await pdfParse(dataBuffer);
    const text = data.text;
    const metadata = extractMetadata(text);
    const marc = generateMARC(metadata);
    res.json({ mrk: marc, metadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function extractMetadata(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const isArabic = /[\u0600-\u06FF]/.test(text);

  const guessTitle = () => {
    if (!isArabic) {
      const titleLine = lines.find(l => /^title[:\-–]/i.test(l));
      if (titleLine) return titleLine.split(/[:\-–]/)[1]?.trim();
      return lines.find(l => /^[A-Z][A-Za-z0-9\s:;,.'"\-\(\)]{10,80}$/.test(l)) || "Unknown Title";
    }
    return lines.find(l => /^[\u0600-\u06FF\s]{10,}$/.test(l)) || "عنوان غير معروف";
  };

  const guessAuthor = () => {
    if (!isArabic) {
      const authorLine = lines.find(l => /^author[:\-–]/i.test(l));
      if (authorLine) return authorLine.split(/[:\-–]/)[1]?.trim();
      const byLine = lines.find(l => /\bby\b/i.test(l));
      if (byLine) return byLine.replace(/.*\bby\b/i, '').trim();
      return "Unknown Author";
    }
    const authorLine = lines.find(l => /(?:تأليف|بقلم)/.test(l));
    return authorLine ? authorLine.replace(/.*(?:تأليف|بقلم)/, "").trim() : "مؤلف غير معروف";
  };

  const cleanText = (str) => str.replace(/\s+/g, ' ').replace(/[\x00-\x1F\x7F]/g, '').trim();

  const title = cleanText(guessTitle());
  const author = cleanText(guessAuthor());
  const year = (text.match(/\b(1[89]|20)\d{2}\b/) || [])[0] || "Unknown Year";
  const isbn = cleanText((text.match(/isbn[:\s]*([\d\-]+)/i) || [])[1] || "[ISBN not found]");
  const publisher = cleanText((text.match(/(?:publisher|published by|الناشر)[:\-–]?\s*(.+)/i) || [])[1] || "[Publisher not found]");

  const paras = text.split(/\n\s*\n/);
  const summary = cleanText(paras.reduce((a, b) => b.length > a.length ? b : a, "").slice(0, 300));

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

function generateMARC(metadata) {
  const now = new Date();
  const controlDate = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const todayShort = now.toISOString().slice(0, 10).replace(/-/g, '');
  const coauthorFields = metadata.coauthors.map(name => `=700 1# $a${name}, $econtributor.`).join("\n");

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
=520  ##$a${metadata.summary}
=546  ##$aText in Arabic and/or English.
${coauthorFields}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
