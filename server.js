const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const outputDir = 'downloads';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/youtube', (req, res) => {
    const url = req.body.url;
    const pitch = parseFloat(req.body.pitch || 0);
    if (!url) return res.status(400).send('YouTube URL is required.');

    const pitchRatio = Math.pow(2, pitch / 12); // เปลี่ยนจาก semitone เป็น ratio
    const filenameBase = `yt_${Date.now()}`;
    const rawOutput = path.join(outputDir, `${filenameBase}.mp3`);
    const processedOutput = path.join(outputDir, `${filenameBase}_shifted.mp3`);

    const ytdlpCmd = `yt-dlp -x --audio-format mp3 -o "${rawOutput}" "${url}"`;

    exec(ytdlpCmd, (err, stdout, stderr) => {
        if (err) {
            console.error('[yt-dlp error]', stderr);
            return res.status(500).send('Download failed.');
        }


        const ffmpegCmd = `ffmpeg -i "${rawOutput}" -filter:a "rubberband=pitch=${pitchRatio}" -y "${processedOutput}"`;

        exec(ffmpegCmd, (err2, stdout2, stderr2) => {
            if (err2) {
                console.error('[ffmpeg error]', stderr2);
                return res.status(500).send('Pitch shifting failed.');
            }
            res.download(processedOutput, 'output.mp3', err3 => {
                if (err3) console.error('[Download error]', err3);
                try {
                    fs.unlinkSync(rawOutput);
                    fs.unlinkSync(processedOutput);
                } catch (cleanupErr) {
                    console.warn('[Cleanup warning]', cleanupErr.message);
                }
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
});
