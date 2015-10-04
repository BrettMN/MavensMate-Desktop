var Promise         = require('bluebird');
var path            = require('path');
var app             = require('app');
var autoUpdater     = require('auto-updater');
var Menu            = require('menu');
var BrowserWindow   = require('browser-window'); 
var shell           = require('shell');
var mavensmate      = require('mavensmate');
var ipc             = require('ipc');
var GitHubReleases  = require('./github');
var gh_releases     = require('electron-gh-releases');
// TODO: (issue #8)
// autoUpdater.setFeedUrl('http://mycompany.com/myapp/latest?version=' + app.getVersion());

// Report crashes to our server.
// require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is GCed.
var mainWindow = null;
var mavensMateServer = null;

// attaches menu to application (edit, view, window, help, etc)
var attachAppMenu = function() {
  if (!Menu.getApplicationMenu()) {
    var template;
    if (process.platform == 'darwin') {
      template = [
        {
          label: 'MavensMate',
          submenu: [
            {
              label: 'MavensMate-app v'+require('./package.json').version
            },
            {
              type: 'separator'
            },
            {
              label: 'Services',
              submenu: []
            },
            {
              type: 'separator'
            },
            {
              label: 'Hide MavensMate',
              accelerator: 'Command+H',
              selector: 'hide:'
            },
            {
              label: 'Hide Others',
              accelerator: 'Command+Shift+H',
              selector: 'hideOtherApplications:'
            },
            {
              label: 'Show All',
              selector: 'unhideAllApplications:'
            },
            {
              type: 'separator'
            },
            {
              label: 'Quit',
              accelerator: 'Command+Q',
              click: function() { app.quit(); }
            },
          ]
        },
        {
          label: 'Edit',
          submenu: [
            {
              label: 'Undo',
              accelerator: 'Command+Z',
              selector: 'undo:'
            },
            {
              label: 'Redo',
              accelerator: 'Shift+Command+Z',
              selector: 'redo:'
            },
            {
              type: 'separator'
            },
            {
              label: 'Cut',
              accelerator: 'Command+X',
              selector: 'cut:'
            },
            {
              label: 'Copy',
              accelerator: 'Command+C',
              selector: 'copy:'
            },
            {
              label: 'Paste',
              accelerator: 'Command+V',
              selector: 'paste:'
            },
            {
              label: 'Select All',
              accelerator: 'Command+A',
              selector: 'selectAll:'
            },
          ]
        },
        {
          label: 'Window',
          submenu: [
            {
              label: 'New Window',
              accelerator: 'Command+N',
              click: function() {
                if (!mainWindow) {
                  attachMainWindow(false, 'http://localhost:56248/app/home/index');
                }
              }
            },
            {
              label: 'Minimize',
              accelerator: 'Command+M',
              selector: 'performMiniaturize:'
            },
            {
              label: 'Close',
              accelerator: 'Command+W',
              selector: 'performClose:'
            },
            {
              type: 'separator'
            },
            {
              label: 'Bring All to Front',
              selector: 'arrangeInFront:'
            },
          ]
        },
        {
          label: 'Advanced',
          submenu: [
            {
              label: 'Toggle Core Developer Tools',
              accelerator: (function() {
                if (process.platform === 'darwin')
                  return 'Alt+Command+K';
                else
                  return 'Ctrl+Shift+K';
              })(),
              click: function(item, focusedWindow) {
                if (focusedWindow) {
                  console.log(item);
                  console.log(focusedWindow);
                  // focusedWindow.toggleDevTools();
                  focusedWindow.webContents.send('webviewDevTools');
                }
              }
            },
            {
              label: 'Toggle Mavensmate-App Developer Tools',
              accelerator: (function() {
                if (process.platform === 'darwin')
                  return 'Alt+Command+I';
                else
                  return 'Ctrl+Shift+I';
              })(),
              click: function(item, focusedWindow) {
                if (focusedWindow) {
                  focusedWindow.toggleDevTools();
                }
              }
            }
          ]
        },
        {
          label: 'Help',
          submenu: [
            {
              label: 'MavensMate-app v'+require('./package.json').version
            },
            {
              label: 'Learn More',
              click: function() { require('shell').openExternal('http://mavensmate.com') }
            },
            {
              label: 'Submit a GitHub Issue',
              click: function() { require('shell').openExternal('https://github.com/joeferraro/MavensMate/issues') }
            }
          ]
        }
      ];
    } else {
      template = [
        {
          label: '&File',
          submenu: [
            {
              label: '&Close',
              accelerator: 'Ctrl+W',
              click: function() {
                var focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow)
                  focusedWindow.close();
              }
            },
          ]
        },
        {
          label: 'Advanced',
          submenu: [
            {
              label: 'Toggle Core Developer Tools',
              accelerator: (function() {
                if (process.platform === 'darwin')
                  return 'Alt+Command+K';
                else
                  return 'Ctrl+Shift+K';
              })(),
              click: function(item, focusedWindow) {
                if (focusedWindow) {
                  console.log(item);
                  console.log(focusedWindow);
                  // focusedWindow.toggleDevTools();
                  focusedWindow.webContents.send('webviewDevTools');
                }
              }
            },
            {
              label: 'Toggle Mavensmate-App Developer Tools',
              accelerator: (function() {
                if (process.platform === 'darwin')
                  return 'Alt+Command+I';
                else
                  return 'Ctrl+Shift+I';
              })(),
              click: function(item, focusedWindow) {
                if (focusedWindow) {
                  focusedWindow.toggleDevTools();
                }
              }
            }
          ]
        },
        {
          label: 'Help',
          submenu: [
            {
              label: 'MavensMate-app v'+require('./package.json').version
            },
            {
              label: 'Learn More',
              click: function() { require('shell').openExternal('http://mavensmate.com') }
            },
            {
              label: 'Submit a GitHub Issue',
              click: function() { require('shell').openExternal('https://github.com/joeferraro/MavensMate/issues') }
            }
          ]
        }
      ];
    }

    var menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
};

// attaches the main window
var attachMainWindow = function(restartServer, url) {
  return new Promise(function(resolve, reject) {
    try {
      console.log('attaching main application window');

      // Create the browser window.
      mainWindow = new BrowserWindow({
        width: 1000, 
        height: 750,
        'min-width': 850,
        'min-height': 670,
        icon: path.join(__dirname, 'resources', 'icon.png')
      });

      // and load the index.html of the app.
      mainWindow.loadUrl('file://' + __dirname + '/index.html');

      mainWindow.webContents.on('did-finish-load', function() {
        if (mavensMateServer && restartServer && mavensMateServer.stop) { // happens when app is restarted
          mavensMateServer.stop();
          mavensMateServer = null;
        }
        if (!mavensMateServer) {
          // we start the mm server, bc app was just started or was reloaded (typically during dev)
          mavensmate
            .startServer({
              name: 'mavensmate-app',
              port: 56248,
              windowOpener: openUrlInNewTab
            })
            .then(function(server) {
              mavensMateServer = server;
              mainWindow.webContents.send('openTab', 'http://localhost:56248/app/home/index');
              return checkForUpdates();
            })
            .then(function() {
              resolve();
            })
            .catch(function(err) {
              console.error(err);
              mainWindow.webContents.send('openTab', 'http://localhost:56248/app/home/index');
              resolve();
            });
        } else {
          // app window was closed, now it's being opened again
          if (url) {
            mainWindow.webContents.send('openTab', url);
          }
          resolve();
        }
      });

      // Open the devtools.
      // mainWindow.openDevTools();

      // Emitted when the window is closed.
      mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
      });
    } catch(e) {
      reject(e);
    }
  });
};

// adds tab to the main window (typically called from the core via windowOpener function passed to client)
var openUrlInNewTab = function(url) {
  var waitFor = !mainWindow ? attachMainWindow() : Promise.resolve();

  waitFor
    .then(function() {
      if (url.indexOf('localhost') >= 0) {
        // opens mavensmate ui in mavensmate-app chrome
        mainWindow.webContents.send('openTab', url);
        mainWindow.show();
      } else {
        // open external url in local browser
        shell.openExternal(url);
      }
    })
    .catch(function(err) {
      console.error('COuld not open url in new tab ...', err);
    });
};

var checkForUpdates = function() {
  return new Promise(function(resolve, reject) {
    console.log('checking for updates ...');
    var options = {
      repo: 'joeferraro/MavensMate-app/tree/auto-update',
      //currentVersion: app.getVersion()
      currentVersion: 'v0.0.1'
    }

    var update = new gh_releases(options, function (auto_updater) {
      // Auto updater event listener
      auto_updater.on('update-downloaded', function (e, rNotes, rName, rDate, uUrl, quitAndUpdate) {
        // Install the update
        // quitAndUpdate()
        console.log('UPDATED!!!');
        console.log(e);
        console.log(rNotes);
        console.log(rDate);
        console.log(uUrl);
        console.log(quitAndUpdate);
      });

      auto_updater.on('checking-for-update', function(e) {
        console.log('checking-for-update', e);
      });

      auto_updater.on('update-available', function(e) {
        console.log('update-available', e);
      });

      auto_updater.on('update-not-available', function(e) {
        console.log('update-not-available', e);
      });
    });

    // Check for updates
    update.check(function (err, status) {
      if (!err && status) {
        update.download()
      } else {
        console.log(err);
        console.log(status);
      }
    });
    // var options = {
    //   repo: 'joeferraro/mavensmate-app',
    //   currentVersion: app.getVersion()
    // };
    // var updateChecker = new GitHubReleases(options);
    // updateChecker.check()
    //   .then(function(updateCheckResult) {
    //     console.log('update check result: ', updateCheckResult);
    //     if (updateCheckResult && updateCheckResult.needsUpdate) {
    //       mainWindow.webContents.send('needsUpdate', updateCheckResult);
    //     }
    //     resolve();
    //   })
    //   .catch(function(err) {
    //     console.error(err);
    //     reject(err);
    //   });
  });
};

// when the last tab is closed, we close the entire browser window
ipc.on('last-tab-closed', function() {
  mainWindow.close();
});

// Quit when all windows are closed on platforms other than OSX, as per platform guidelines
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// will check for updates against github releases and pass the result to setup
app.on('ready', function() {  
  attachAppMenu();
  attachMainWindow()
    .catch(function(err) {
      console.error('Error attaching main window...', err);
    });
});