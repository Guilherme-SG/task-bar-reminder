const { Tray, Menu, app } = require('electron');
const path = require('path');

class AppTray {
  constructor() {
    this.tray = null;
    this.onAction = null;
    this.onQuit = null;
    this.onRestart = null;
  }

  create() {
    this.tray = new Tray(
      path.join(__dirname, '..', '..', 'assets', 'images', 'icon.png')
    );

    this.tray.setToolTip('Desktop Reminder');
    this.updateMenu([], []);
  }

  setOnAction(callback) {
    this.onAction = callback;
  }

  updateMenu(reminders, activeReminders = []) {
    const items = [];
    const activeById = new Map(activeReminders.map((r) => [r.id, r]));

    for (const r of reminders) {
      const active = activeById.get(r.id);
      if (active) {
        const suffix = active.pending ? ' (pending)' : '';
        items.push({
          label: `Done - "${r.title}"${suffix}`,
          click: () => {
            if (this.onAction) {
              this.onAction(r.id, 'done');
            }
          },
        });
        items.push({
          label: `Snooze - "${r.title}"${suffix}`,
          click: () => {
            if (this.onAction) {
              this.onAction(r.id, 'snooze');
            }
          },
        });
      }
    }

    if (items.length > 0) {
      items.push({ type: 'separator' });
    }

    items.push({
      label: 'Restart',
      click: () => {
        if (this.onRestart) {
          this.onRestart();
        }
      },
    });

    items.push({
      label: 'Exit',
      click: () => {
        if (this.onQuit) {
          this.onQuit();
        } else {
          app.quit();
        }
      },
    });

    const menu = Menu.buildFromTemplate(items);
    this.tray.setContextMenu(menu);
  }
}

module.exports = AppTray;
