/**
 * Script to download Noto Sans fonts for Vietnamese PDF support
 * Run: node download-fonts.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, 'fonts');

// Create fonts directory if it doesn't exist
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
    console.log('Created fonts directory');
}

// Font URLs from Google Fonts CDN
const fonts = {
    'NotoSans-Regular.ttf': 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
    'NotoSans-Bold.ttf': 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Bold.ttf'
};

function downloadFont(url, filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(fontsDir, filename);
        
        // Skip if file already exists
        if (fs.existsSync(filePath)) {
            console.log(`✓ ${filename} already exists, skipping...`);
            resolve();
            return;
        }
        
        console.log(`Downloading ${filename}...`);
        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✓ Downloaded ${filename}`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlinkSync(filePath);
                    reject(err);
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✓ Downloaded ${filename}`);
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlinkSync(filePath);
            reject(err);
        });
    });
}

async function downloadAllFonts() {
    console.log('Downloading Vietnamese fonts for PDF export...\n');
    
    try {
        for (const [filename, url] of Object.entries(fonts)) {
            await downloadFont(url, filename);
        }
        console.log('\n✓ All fonts downloaded successfully!');
        console.log('PDF export should now support Vietnamese text correctly.');
    } catch (error) {
        console.error('\n✗ Error downloading fonts:', error.message);
        console.log('\nAlternative: Manually download fonts from:');
        console.log('https://fonts.google.com/noto/specimen/Noto+Sans');
        console.log('And place them in the ./fonts/ directory');
    }
}

downloadAllFonts();

