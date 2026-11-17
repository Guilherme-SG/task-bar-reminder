const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SOUNDS_DIR = path.join(__dirname, '..', '..', 'sounds');

class AudioPlayer {
  constructor(ffplayPath) {
    this.ffplayPath = ffplayPath;
    this.currentProcess = null;
  }

  setFfplayPath(ffplayPath) {
    this.ffplayPath = ffplayPath;
  }

  play(audioPath) {
    return new Promise((resolve) => {
      this.stop();

      if (!this.ffplayPath || !fs.existsSync(this.ffplayPath)) {
        resolve();
        return;
      }

      if (!fs.existsSync(audioPath)) {
        resolve();
        return;
      }

      this.currentProcess = spawn(this.ffplayPath, [
        '-nodisp',
        '-autoexit',
        '-loglevel', 'quiet',
        audioPath,
      ], {
        detached: false,
        stdio: 'ignore',
      });

      this.currentProcess.on('error', () => {
        this.currentProcess = null;
        resolve();
      });

      this.currentProcess.on('exit', () => {
        this.currentProcess = null;
        resolve();
      });
    });
  }

  stop() {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  pickRandom(id, type, { fallbackToDefault = true } = {}) {
    if (!fs.existsSync(SOUNDS_DIR)) {
      return null;
    }

    const allFiles = fs.readdirSync(SOUNDS_DIR);
    let files = this.#matchSoundFiles(allFiles, id, type);

    if (files.length === 0 && fallbackToDefault && id !== 'default') {
      files = this.#matchSoundFiles(allFiles, 'default', type);
    }

    if (files.length === 0) {
      return null;
    }

    const random = files[Math.floor(Math.random() * files.length)];
    return path.join(SOUNDS_DIR, random);
  }

  #matchSoundFiles(allFiles, prefix, type) {
    const pattern = new RegExp(`^${this.#escapeRegex(prefix)}-${this.#escapeRegex(type)}-\\d+$`);
    return allFiles.filter((file) => {
      if (!file.endsWith('.mp3')) return false;
      const name = file.replace('.mp3', '');
      return pattern.test(name);
    });
  }

  #escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = AudioPlayer;
