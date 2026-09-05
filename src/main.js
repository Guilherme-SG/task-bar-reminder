const { app, dialog } = require('electron');
const ConfigLoader = require('./core/ConfigLoader.js');
const Scheduler = require('./core/Scheduler.js');
const AudioPlayer = require('./core/AudioPlayer.js');
const StateStore = require('./core/StateStore.js');
const ReminderService = require('./core/ReminderService.js');
const ReminderWindow = require('./ui/ReminderWindow.js');
const AppTray = require('./ui/Tray.js');

let reminderService;

app.whenReady().then(async () => {
  let config;
  try {
    config = ConfigLoader.load();
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Configuration Error',
      message: 'Failed to load config.json',
      detail: err.message,
    });
    app.quit();
    return;
  }

  const scheduler = new Scheduler();
  const audioPlayer = new AudioPlayer(config.ffplayPath);
  const stateStore = new StateStore();
  const reminderWindow = new ReminderWindow(config);
  const tray = new AppTray();

  reminderService = new ReminderService({
    scheduler,
    reminderWindow,
    stateStore,
    audioPlayer,
    config,
  });

  reminderWindow.setOnAction((reminderId, action) => {
    if (action === 'fire-now') {
      const reminder = config.reminders.find((r) => r.id === reminderId);
      if (reminder) {
        reminderService.resolveReminder(reminderId, 'done');
        reminderService.resolveReminder(reminderId, 'snooze');
      }
      return;
    }
    reminderService.resolveReminder(reminderId, action);
  });

  tray.create();
  tray.updateMenu(config.reminders);

  tray.setOnAction((reminderId, action) => {
    if (action === 'fire-now') {
      const reminder = config.reminders.find((r) => r.id === reminderId);
      if (reminder) {
        reminderWindow.showReminder(reminder, 0);
      }
    }
  });

  reminderService.start();
});
