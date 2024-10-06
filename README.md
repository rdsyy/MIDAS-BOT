# MIDAS-BOT

## Steps


```
git clone https://github.com/rdsyy/MIDAS-BOT.git
```
```
cd MIDAS-BOT
```
```
sudo apt remove -y chromium-browser
```

```bash
sudo apt autoremove
```
```
sudo apt update && sudo apt upgrade
```
```
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
```
```
sudo dpkg -i google-chrome-stable_current_amd64.deb
```
```
sudo apt --fix-broken install
```
```
npm install axios puppeteer-extra puppeteer-extra-plugin-stealth puppeteer-core
```

 ganti bagian /usr/bin/chromium-browser
 
```
nano index-cf.js
```
```
/usr/bin/google-chrome-stable
```
isi query 
```
nano hash.txt
```
run bot
```
node index-cf.js
