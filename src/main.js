const { app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ConfigLoader = require('./core/ConfigLoader.js');
const Scheduler = require('./core/Scheduler.js');
const AudioPlayer = require('./core/AudioPlayer.js');
const StateStore = require('./core/StateStore.js');
const FocusGuard = require('./core/FocusGuard.js');
const ProcessList = require('./core/ProcessList.js');
const ReminderService = require('./core/ReminderService.js');
const ReminderWindow = require('./ui/ReminderWindow.js');
const ManageRemindersWindow = require('./ui/ManageRemindersWindow.js');
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

  ProcessList.startBackgroundScan();

  const scheduler = new Scheduler();
  const audioPlayer = new AudioPlayer(config.ffplayPath);
  const stateStore = new StateStore();
  const reminderWindow = new ReminderWindow(config);
  const manageRemindersWindow = new ManageRemindersWindow();
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

  const soundsDir = path.join(__dirname, '..', 'sounds');
  const openSoundsFolder = async () => {
    if (!fs.existsSync(soundsDir)) {
      await fs.promises.mkdir(soundsDir, { recursive: true });
    }
    await shell.openPath(soundsDir);
  };

  tray.onOpenSounds = openSoundsFolder;
  manageRemindersWindow.setOnOpenSounds(openSoundsFolder);
  manageRemindersWindow.setOnGetReminders(() => config.reminders);

  manageRemindersWindow.setOnSave(async (reminderData) => {
    const savedReminder = ConfigLoader.saveReminder(reminderData);
    await reminderService.addReminder(savedReminder);
    updateTray(reminderService.getActiveReminders());
  });

  manageRemindersWindow.setOnUpdate(async (id, reminderData) => {
    const updatedReminder = ConfigLoader.updateReminder(id, reminderData);
    await reminderService.updateReminder(id, updatedReminder);
    updateTray(reminderService.getActiveReminders());
  });

  manageRemindersWindow.setOnDelete(async (id) => {
    ConfigLoader.deleteReminder(id);
    await reminderService.deleteReminder(id);
    updateTray(reminderService.getActiveReminders());
  });

  tray.onAddReminder = () => {
    manageRemindersWindow.show('add');
  };

  tray.onManageReminders = () => {
    manageRemindersWindow.show('list');
  };

  tray.onRestart = () => {
    reminderWindow.quitting = true;
    manageRemindersWindow.quitting = true;
    app.relaunch();
    app.quit();
  };

  tray.onQuit = () => {
    reminderWindow.quitting = true;
    manageRemindersWindow.quitting = true;
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
