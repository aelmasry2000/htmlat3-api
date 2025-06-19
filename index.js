const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

function clean(text) {
  return text.replace(/\s+/g, " ").replace(/[\x00-\x1F\x7F]/g, "").trim();
}

function extractMetadata(text) {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  const fullText = lines.join(" ");
  const title = clean((text.match(/title[:\-\s]+(.+)/i) || [])[1] || lines[0] || "Unknown Title");
  const author = clean((text.match(/author[:\-\s]+(.+)/i) || [])[1] || "Unknown Author");
  const year = (text.match(/\b(18|19|20)\d{2}\b/) || [])[0] || "Unknown Year";
  const publisher = clean((text.match(/publisher[:\-\s]+(.+)/i) || [])[1] || "[Publisher not found]");
  const isbn = (text.match(/isbn[\s\-:]*(\d{10,13})/i) || [])[1] || "";
  const summary = clean(fullText.split(". ").slice(1, 3).join(". ").slice(0, 500)) || "Cataloged using basic automated extraction.";

  return { title, author, year, publisher, isbn, summary };
}

function buildMARC(metadata) {
  const {
    title,
    author,
    year,
    publisher,
    isbn,
    summary
  } = metadata;

  const now = new Date();
  const controlDate = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const shortDate = now.toISOString().split("T")[0].replace(/-/g, "");

  return `=LDR  00000nam a2200000 a 4500
=001  000000001
=005  ${controlDate}.0
=008  ${shortDate}s${year}\\xx\\\\\\\\\\\\eng\\\\\\\\\\\\d
=020  ##$a${isbn || '[ISBN not found]'}
=041  0#$aara
=100  1#$a${author}.
=245  10$a${title} /$c${author}.
=250  ##$aFirst edition.
=264  _1$a[Place not identified] :$b${publisher},$c${year}.
=300  ##$a300 pages :$billustrations ;$c24 cm.
=336  ##$atext$btxt$2rdacontent
=337  ##$aunmediated$bn$2rdamedia
=338  ##$avolume$bnc$2rdacarrier
=500  ##$aRecord generated using automated extraction tool.
=520  ##$a${summary}
=546  ##$aText in Arabic and/or English.`;
}

app.post("/extract", upload.single("file"), async (req, res) => {
  try {
    const { path, originalname } = req.file;
    let text = "";

    if (originalname.endsWith(".pdf")) {
      const dataBuffer = fs.readFileSync(path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      text = fs.readFileSync(path, "utf8");
    }

    const metadata = extractMetadata(text);
    const mrk = buildMARC(metadata);
    fs.unlinkSync(path); // delete uploaded temp file

    res.json({ mrk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process file." });
  }
});

app.get("/", (req, res) => {
  res.send("MARC21 Cataloging API is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
