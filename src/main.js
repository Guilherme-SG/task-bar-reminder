const { app, dialog } = require('electron');
const ConfigLoader = require('./core/ConfigLoader.js');
const Scheduler = require('./core/Scheduler.js');
const AudioPlayer = require('./core/AudioPlayer.js');
const StateStore = require('./core/StateStore.js');
const FocusGuard = require('./core/FocusGuard.js');
const ReminderService = require('./core/ReminderService.js');
const ReminderWindow = require('./ui/ReminderWindow.js');
const AppTray = require('./ui/Tray.js');

app.commandLine.appendSwitch('disable-gpu-cache');

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
      detail: `${err.message}\n\nCheck README.md for the correct config format.`,
    });
    app.quit();
    return;
  }

  const scheduler = new Scheduler();
  const audioPlayer = new AudioPlayer(config.ffplayPath);
  const stateStore = new StateStore();
  const reminderWindow = new ReminderWindow(config);
  const tray = new AppTray();
  const focusGuard = new FocusGuard();

  const needsFocusGuard = config.reminders.some(
    (reminder) => (reminder.blockWhenFocused ?? config.blockWhenFocused).length > 0
  );

  reminderService = new ReminderService({
    scheduler,
    reminderWindow,
    stateStore,
    audioPlayer,
    config,
    focusGuard,
  });

  focusGuard.setOnChange(() => {
    reminderService.releaseDeferredReminders();
  });

  if (needsFocusGuard) {
    focusGuard.start();
  }

  app.on('will-quit', () => {
    focusGuard.stop();
  });

  reminderWindow.setOnAction((reminderId, action) => {
    reminderService.resolveReminder(reminderId, action);
  });

  tray.create();
  tray.updateMenu(config.reminders, []);

  tray.onRestart = () => {
    reminderWindow.quitting = true;
    app.relaunch();
    app.quit();
  };

  tray.onQuit = () => {
    reminderWindow.quitting = true;
    app.quit();
  };

  tray.setOnAction((reminderId, action) => {
    reminderService.resolveReminder(reminderId, action);
  });

  const updateTray = (activeReminders) => {
    tray.updateMenu(config.reminders, activeReminders);
  };

  reminderService.onShow = updateTray;
  reminderService.onDismiss = updateTray;

  reminderService.start();
});
