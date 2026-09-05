const { Tray, Menu, app } = require('electron');
const path = require('path');

class AppTray {
  constructor() {
    this.tray = null;
    this.onAction = null;
    this.onQuit = null;
  }

  create() {
    this.tray = new Tray(
      path.join(__dirname, '..', 'assets', 'images', 'icon.png')
    );

    this.tray.setToolTip('Desktop Reminder');
    this.updateMenu([], []);
  }

  setOnAction(callback) {
    this.onAction = callback;
  }

  updateMenu(reminders, activeIds = []) {
    const items = [];

    for (const r of reminders) {
      if (activeIds.includes(r.id)) {
        items.push({
          label: `Feito - "${r.title}"`,
          click: () => {
            if (this.onAction) {
              this.onAction(r.id, 'done');
            }
          },
        });
        items.push({
          label: `Adiar - "${r.title}"`,
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
      label: 'Sair',
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
