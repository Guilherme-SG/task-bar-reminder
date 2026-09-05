const { Tray, Menu, app } = require('electron');
const path = require('path');

class AppTray {
  constructor() {
    this.tray = null;
    this.onAction = null;
  }

  create() {
    this.tray = new Tray(
      path.join(__dirname, '..', 'assets', 'images', 'icon.png')
    );

    this.tray.setToolTip('Desktop Reminder');
    this.updateMenu([]);
  }

  setOnAction(callback) {
    this.onAction = callback;
  }

  updateMenu(reminders) {
    const items = reminders.map((r) => ({
      label: `Disparar "${r.title}" agora`,
      click: () => {
        if (this.onAction) {
          this.onAction(r.id, 'fire-now');
        }
      },
    }));

    if (items.length > 0) {
      items.push({ type: 'separator' });
    }

    items.push({
      label: 'Sair',
      click: () => app.quit(),
    });

    const menu = Menu.buildFromTemplate(items);
    this.tray.setContextMenu(menu);
  }
}

module.exports = AppTray;
