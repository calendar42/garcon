var g = require('./lib/garçon'),
    server, myApp;
    
// create a server which will listen on port 8000 by default
server = new g.Server();

// adding an application named 'myapp' tells the server to respond to
// the /myapp url and to create a myapp.html file when saving
myApp = server.addApp({
  name: 'myapp',
  theme: 'sc-theme',
  buildLanguage: 'english'
});

// myApp needs SproutCore to run
myApp.addSproutcore();

// add other dependencies
myApp.addFrameworks(
  
  // a third party framework
  // { path: 'frameworks/calendar' },
  
  // the default 1.4 theme
  // { path:'frameworks/sproutcore/themes/standard_theme', combineScripts: true },
  
  // or, the default 1.5 theme
  { path:'frameworks/sproutcore/themes/empty_theme', combineScripts: true },
  { path:'frameworks/sproutcore/themes/ace', combineScripts: true },
  
  // finally, the sources for myApp must be added as well
  { path: 'apps/' + myApp.name }
);

// add some html for inside the <head> tag
myApp.htmlHead = '<title>My App</title>';

// add some html for inside the <body> tag
myApp.htmlBody = [
  '<p id="loading">',
    'Loading…',
  '</p>'
].join('\n');

// build the app
myApp.build(function() {
  
  // run the server
  server.run();
  
});
