function extractEnglishMetadata(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const getByLabel = (labels) => {
    for (const label of labels) {
      const line = lines.find(l => l.toLowerCase().startsWith(label.toLowerCase()));
      if (line) return line.split(/[:\-–]/).slice(1).join('').trim();
    }
    return '';
  };

  const title = getByLabel(['title']) ||
    lines.find(l => l.length > 5 && /^[A-Z][\w\s\-:,\'"]{5,}$/.test(l)) || 'Unknown Title';

  const author = getByLabel(['author', 'by']) ||
    lines.find(l => /^by\s/i.test(l))?.replace(/^by\s+/i, '') || 'Unknown Author';

  const publisher = getByLabel(['publisher']) || 'Unknown Publisher';

  const year = (text.match(/\b(1[89]|20)\d{2}\b/) || [])[0] || 'Unknown Year';

  const summary = lines.slice(0, 20).filter(l => l.length > 40).join(' ').slice(0, 300) || '[No summary]';

  const isbn = (text.match(/(?:ISBN[-\s]*:?)\s*([\d\-]+)/i) || [])[1] || '';
  const issn = (text.match(/(?:ISSN[-\s]*:?)\s*([\d\-]+)/i) || [])[1] || '';

  const place = (text.match(/(?:published in|place[:\-])\s*([\w\s]+)/i) || [])[1] || '[Place not identified]';

  return {
    title: title.trim(),
    author: author.trim(),
    publisher: publisher.trim(),
    year,
    summary: summary.trim(),
    isbn,
    issn,
    place,
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
=008  ${todayShort}s${metadata.year}\xx\eng\d
=020  ##$a${metadata.isbn || '[ISBN not found]'}
=022  ##$a${metadata.issn || '[ISSN not found]'}
=041  0#$aeng
=100  1#$a${metadata.author}.
=245  10$a${metadata.title} /$c${metadata.author}.
=246  3#$a${metadata.title.split(' ').slice(0, 4).join(' ')}
=250  ##$aFirst edition.
=264  _1$a${metadata.place} :$b${metadata.publisher},$c${metadata.year}.
=300  ##$a300 pages :$billustrations ;$c24 cm.
=336  ##$atext$btxt$2rdacontent
=337  ##$aunmediated$bn$2rdamedia
=338  ##$avolume$bnc$2rdacarrier
=500  ##$aCataloged using automated extraction.
=520  ##$a${metadata.summary}
=546  ##$aText in English.`;
}
