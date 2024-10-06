const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const os = require('os');  // Tambahkan modul os untuk deteksi sistem operasi
const readline = require('readline');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

puppeteer.use(StealthPlugin());

plus = "[\x1b[32m+\x1b[0m]";
mins = "[\x1b[31m-\x1b[0m]";
skip = "[\x1b[33m>\x1b[0m]";
seru = "[\x1b[34m!\x1b[0m]";

// Deteksi sistem operasi dan tentukan path ke Chromium
function getChromiumExecutablePath() {
    const platform = os.platform();
    if (platform === 'win32') {
        // Path untuk Windows
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else if (platform === 'linux') {
        // Path untuk Linux (VPS)
        return '/usr/bin/chromium-browser';  // Sesuaikan dengan lokasi Chromium di VPS kamu
    } else {
        throw new Error(`Sistem operasi ${platform} tidak didukung.`);
    }
}

async function processAccount(authPayload, index) {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: getChromiumExecutablePath(),  // Gunakan fungsi untuk mendeteksi path Chromium
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=100,50'
        ],
    });
    const page = await browser.newPage();

    try {
        await page.goto('https://api-tg-app.midas.app', { waitUntil: 'networkidle2' });

        const token = await page.evaluate(async (authPayload) => {
            const response = await fetch('https://api-tg-app.midas.app/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: authPayload })
            });
            const responseBody = await response.text();
            return responseBody;
        }, authPayload);

        if (!token || token.startsWith('<!DOCTYPE html>')) {
            console.error(`\x1b[31m[!] Failed to login Akun ke-${index}. Invalid response: ${token}\x1b[0m`);
            return;
        }

        const infoUser = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/user', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        console.log(`\n${seru} \x1b[34m${new Date().toLocaleTimeString()} - Login Akun ke-${index} - ${infoUser.username}\x1b[0m`);
        console.log(`    ${plus} Point         : \x1b[33m${infoUser.points}\x1b[0m`);

        const infoCheckin = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/streak', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        await delay(1000);

        if (infoCheckin.claimable) {
            const claimCheckin = await page.evaluate(async (token) => {
                const response = await fetch('https://api-tg-app.midas.app/api/streak', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                return response.json();
            }, token);

            console.log(`    ${plus} Checkin       : \x1b[32mSukses\x1b[0m - Reward: \x1b[32m${claimCheckin.nextRewards.points} Point & ${claimCheckin.nextRewards.tickets} Tiket\x1b[0m`);
            console.log(`    ${plus} Day           : \x1b[33m${claimCheckin.streakDaysCount}\x1b[0m`);
        } else {
            console.log(`    ${mins} Checkin       : \x1b[31mSudah Pernah\x1b[0m`);
        }

        const listTask = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/tasks/available', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        await delay(2000);

        for (const task of listTask) {
            if (task.state === 'WAITING' && task.mechanic === 'START_WAIT_CLAIM') {
                try {
                    await page.evaluate(async (token, task) => {
                        await fetch(`https://api-tg-app.midas.app/api/tasks/start/${task.id}`, {
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'User-Agent': 'Mozilla/5.0'
                            }
                        });
                    }, token, task);
                    console.log(`    ${plus} Start Task    : \x1b[33m${task.name}\x1b[0m`);
                } catch (error) {
                    console.error(`    ${mins} Start Task  : \x1b[31mGagal - ${task.name} - ${error.message}\x1b[0m`);
                }
            }
        }

        await delay(2000);

        const updatedTasks = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/tasks/available', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        for (const task of updatedTasks) {
            if (task.state === 'CLAIMABLE') {
                try {
                    const claimTask = await page.evaluate(async (token, task) => {
                        const response = await fetch(`https://api-tg-app.midas.app/api/tasks/claim/${task.id}`, {
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'User-Agent': 'Mozilla/5.0'
                            }
                        });
                        return response.json();
                    }, token, task);
                    console.log(`    ${plus} Claim Task    : \x1b[32m${task.name}\x1b[0m - Reward: \x1b[32m${task.points} Points\x1b[0m`);
                } catch (error) {
                    if (error.response && error.response.data.message.includes('cannot be claimed before')) {
                        console.log(`    ${skip} Claim Task    : \x1b[33mSkip - ${task.name} (Belum waktunya klaim)\x1b[0m`);
                    } else {
                        console.error(`    ${mins} Claim Task    : \x1b[31mGagal - ${task.name} - ${error.message}\x1b[0m`);
                    }
                }
            }
        }

        const infoReff = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/referral/status', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        if (infoReff.canClaim) {
            const claimReff = await page.evaluate(async (token) => {
                const response = await fetch('https://api-tg-app.midas.app/api/referral/claim', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                return response.json();
            }, token);
            console.log(`    ${plus} Farming Reff  : \x1b[32mSukses\x1b[0m - Reward: \x1b[32m${claimReff.totalPoints} Points\x1b[0m`);
        } else {
            console.log(`    ${mins} Farming Reff  : \x1b[31mBelum saatnya\x1b[0m`);
        }

        const userInfo = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/user', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        console.log(`    ${plus} Tiket         : \x1b[33m${userInfo.tickets}\x1b[0m`);

        if (userInfo.tickets > 0) {
            for (let i = 0; i < userInfo.tickets; i++) {
                const prosesTaps = await page.evaluate(async (token) => {
                    const response = await fetch('https://api-tg-app.midas.app/api/game/play', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'User-Agent': 'Mozilla/5.0'
                        }
                    });
                    return response.json();
                }, token);

                console.log(`    ${plus} Taps          : \x1b[32m${prosesTaps.points}\x1b[0m`);
                await delay(2000);
            }
        }

        const finalInfoUser = await page.evaluate(async (token) => {
            const response = await fetch('https://api-tg-app.midas.app/api/user', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            return response.json();
        }, token);

        console.log(`    ${plus} Now Point     : \x1b[33m${finalInfoUser.points}\x1b[0m`);

    } catch (error) {
        console.error(`[!] Error processing account ${index}:`, error.message);
    } finally {
        await browser.close();
    }
}

const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
    }));
};

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

async function countdown(duration) {
    let remaining = duration;
    const animationChars = ['B', 'O', 'T', 'E', 'R', 'D', 'R', 'O', 'P'];
    let animationIndex = 0;

    while (remaining > 0) {
        process.stdout.write(`\r${seru}  \x1b[34m${animationChars[animationIndex]}\x1b[0m  Countdown     : ${formatTime(remaining)}`);
        await delay(300);
        remaining -= 300;
        animationIndex = (animationIndex + 1) % animationChars.length;
    }
    process.stdout.write(`\r${seru} Countdown       : Selesai        `);

    console.log('');
}

const asciiArt = `
  __  __ _     _           
 |  \\/  (_) __| | __ _ ___ 
 | |\\/| | |/ _\` |/ _\` / __|
 | |  | | | (_| | (_| \\__ \\
 |_|  |_|_|\\__,_|\\__,_|___/
       \x1b[33mBOTEDROP - v1.0\x1b[0m
     `;

async function main() {
    const accounts = fs.readFileSync('hash.txt', 'utf-8').split('\n').map(account => account.trim()).filter(Boolean);

    console.log(asciiArt);

    while (true) {
        for (let i = 0; i < accounts.length; i++) {
            const authPayload = accounts[i];
            await processAccount(authPayload, i + 1);
            await delay(3000);
        }

        console.log('');
        await countdown(2 * 60 * 60 * 1000);
    }
}

main();
