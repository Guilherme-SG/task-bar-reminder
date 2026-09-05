const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SOUNDS_DIR = path.join(__dirname, '..', '..', 'sounds');

class AudioPlayer {
  constructor(ffplayPath) {
    this.ffplayPath = ffplayPath;
    this.currentProcess = null;
  }

  play(audioPath) {
    return new Promise((resolve) => {
      this.stop();

      if (!this.ffplayPath || !fs.existsSync(this.ffplayPath)) {
        console.warn(`ffplay not found at: ${this.ffplayPath}`);
        resolve();
        return;
      }

      if (!fs.existsSync(audioPath)) {
        console.warn(`Audio file not found: ${audioPath}`);
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

      this.currentProcess.on('error', (err) => {
        console.error('Audio playback error:', err.message);
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

  pickRandom(id, type) {
    if (!fs.existsSync(SOUNDS_DIR)) {
      return null;
    }

    const files = fs.readdirSync(SOUNDS_DIR).filter((file) => {
      if (!file.endsWith('.mp3')) return false;
      const name = file.replace('.mp3', '');
      return name === `${id}-${type}-1` || name.match(new RegExp(`^${this.#escapeRegex(id)}-${this.#escapeRegex(type)}-\\d+$`));
    });

    if (files.length === 0) {
      return null;
    }

    const random = files[Math.floor(Math.random() * files.length)];
    return path.join(SOUNDS_DIR, random);
  }

  #escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = AudioPlayer;
