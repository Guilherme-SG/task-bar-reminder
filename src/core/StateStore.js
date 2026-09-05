const fs = require('fs/promises');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'state.json');

class StateStore {
  async get() {
    try {
      const content = await fs.readFile(STATE_FILE, 'utf8');
      const data = JSON.parse(content || '{}');
      return typeof data === 'object' && data !== null ? data : {};
    } catch {
      return {};
    }
  }

  async getNextFireTime(reminderId) {
    const state = await this.get();
    return state[reminderId] || null;
  }

  async setNextFireTime(reminderId, isoDate) {
    const state = await this.get();
    state[reminderId] = isoDate;
    await this.#write(state);
  }

  async clearNextFireTime(reminderId) {
    const state = await this.get();
    delete state[reminderId];
    await this.#write(state);
  }

  async #write(data) {
    const dir = path.dirname(STATE_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(data, null, 4));
  }
}

module.exports = StateStore;
