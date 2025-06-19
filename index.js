
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());

app.post('/extract', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const text = fs.readFileSync(filePath, 'utf-8');
    const mrk = `=245  10$a${text.slice(0, 30).replace(/\s+/g, ' ')} /$cExtracted.`;
    fs.unlinkSync(filePath);
    res.json({ mrk });
});

app.get('/', (req, res) => res.send('API running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
