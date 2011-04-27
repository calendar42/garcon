/*globals require */

var self = this,
    l = {},
    App, File, Framework, sharedHandlers;

require('sys'); // for console.log
File = require('./file').File;
Framework = require('./framework').Framework;
sharedHandlers = require('./handlers').sharedHandlers;
l.fs = require('fs');
l.path = require('path');

self.App = function(options) {
  var key;
    
  this.name = null;
  this.server = null;
  this.buildVersion = new Date().getTime();
  this.buildLanguage = 'english';
  this.combineStylesheets = false;
  this.combineScripts = false;
  this.minifyScripts = false;
  this.minifyStylesheets = false;
  this.validateScripts = false;
  this.htmlHead = null;
  this.htmlStylesheets = null;
  this.htmlBeforeScripts = null;
  this.htmlAfterScripts = null;
  this.urlPrefix = '../';
  this.theme = 'sc-theme';
  this.savePath = 'build';
  
  for (key in options) {
    this[key] = options[key];
  }
};

App = self.App;

App.prototype.nameFor = Framework.prototype.nameFor;
App.prototype.urlFor = Framework.prototype.urlFor;

App.prototype.addFramework = function(framework) {
  if (this.frameworks === undefined) {
    this.frameworks = [];
  }
  
  if (!(framework instanceof Framework)) {
    framework = new Framework(framework);
  }
  
  framework.server = this.server;
  
  if (framework.buildVersion === null) {
    framework.buildVersion = this.buildVersion;
  }
  
  ['combineScripts', 'combineStylesheets', 'validateScripts', 'minifyScripts', 'minifyStylesheets'].forEach(function(key) {
    if (this[key] === true) {
      framework[key] = true;
    }
  }, this);
  
  this.frameworks.push(framework);
  
  return framework;
};

App.prototype.addFrameworks = function() {
  var args = Array.prototype.slice.call(arguments);
  
  if (args[0] instanceof Array) {
    args = args[0];
  }
  
  args.forEach(function(framework) {
    this.addFramework(framework);
  }, this);  
};

App.prototype.addSproutcore = function(options) {
  if (options === undefined) options = {};
  options.server = this.server;
  this.addFrameworks(Framework.sproutcoreFrameworks(options));
};

App.prototype.rootContent = function(htmlStylesheets, htmlScripts) {
  var that = this;
  
  return function(callback) {
    var html = [],
        file, lang;

    lang = that.buildLanguage.toShortLanguage();
    if (!lang) {
      console.log('WARNING: short language code for "' + that.buildLanguage + '" is undefined.');
      lang = '';
    } else {
      lang = ' lang="' + lang + '"';
    }    

    html.push(
      '<!DOCTYPE html>',
      '<html' + lang + '>',
      '<head>',
        '<meta charset="utf-8">',
        '<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">'
    );

    if (that.htmlHead !== null) html.push(that.htmlHead);
    if (that.htmlStylesheets !== null) html.push(that.htmlStylesheets);

    if (htmlStylesheets === undefined) {
      that.frameworks.forEach(function(framework) {
        framework.orderedStylesheets.forEach(function(stylesheet) {
          if (stylesheet.framework === framework) {
            html.push('<link href="' + that.urlPrefix + stylesheet.url() + '" rel="stylesheet" type="text/css">');
          }
        });
      });
    } else {
      html.push(htmlStylesheets);
    }

    html.push(
      '</head>',
      '<body class="' + that.theme + ' focus">'
    );

    if (that.htmlBeforeScripts !== null) html.push(that.htmlBeforeScripts);
    
    html.push('<script type="text/javascript">String.preferredLanguage = "' + that.buildLanguage + '";</script>');
    
    if (htmlScripts === undefined) {
      that.frameworks.forEach(function(framework) {
        framework.orderedScripts.forEach(function(script) {
          html.push('<script type="text/javascript" src="' + that.urlPrefix + script.url() + '"></script>');
        });
      });
    } else {
      html.push(htmlScripts);
    }
    
    if (that.htmlAfterScripts !== null) html.push(that.htmlAfterScripts);

    html.push(
    	  '</body>',
      '</html>'
    );

    html = html.join('\n');

    callback(null, html);
  };
};

App.prototype.buildRoot = function() {
  var handler, file, symlink;
  
  handler = sharedHandlers.build(['cache', 'contentType', 'file']);
  file = new File({ path: this.name, handler: handler, content: this.rootContent(), isHtml: true, framework: this });
  this.server.files[file.url()] = file;
  
  handler = sharedHandlers.build(['symlink']);
  symlink = new File({ handler: handler, isSymlink: true, symlink: file });
  this.server.files[this.name] = symlink;
};

App.prototype.build = function(callback) {
  var Builder = function(app, callback) {
    var that = this;
    
    that.count = app.frameworks.length;
    
    that.callbackIfDone = function() {
      if (callback && that.count <= 0) callback();
    };
    
    that.build = function() {
      app.files = {};

      app.buildRoot();

      app.frameworks.forEach(function(framework) {
        framework.build(function() {
          that.count -= 1;
          that.callbackIfDone();
        });
      });
    };
  };
  
  return new Builder(this, callback).build();
};

App.prototype.save = function() {
  var that = this,
      stylesheets = [],
      scripts = [],
      stylesheet, script, html, savr;
  
  var Saver = function(app, file) {
    var that = this;
    
    that.save = function() {
      file.handler.handle(file, null, function(r) {
        var path;
        
        if (r.data.length > 0) {
          path = l.path.join(app.savePath, file.savePath());

          File.createDirectory(l.path.dirname(path));
          l.fs.writeFile(path, r.data, function(err) {
            if (err) throw err;
          });
        }
      });
    };
  };
  
  sharedHandlers.urlPrefix = that.urlPrefix;
  
  that.frameworks.forEach(function(framework) {
    var file, url;
    
    for (url in that.server.files) {
      file = that.server.files[url];
      if (file.framework === framework) {
        if (file.isStylesheet()) stylesheets.push(file);
        if (file.isScript()) scripts.push(file);
        if (file.isResource()) new Saver(that, file).save();
      }
      if (file.isHtml) html = file;
    }
  });
  
  stylesheet = new File({
    path: that.name + '.css',
    framework: that,
    handler: sharedHandlers.build(['join']),
    children: stylesheets
  });
  
  savr = new Saver(that, stylesheet);
  savr.save();
  
  script = new File({
    path: that.name + '.js',
    framework: that,
    handler: sharedHandlers.build(['join']),
    children: scripts
  });
  
  savr = new Saver(that, script);
  savr.save();
  
  html = new File({
    path: this.name + '/index',
    isHtml: true,
    framework: that,
    handler: {
      handle: function(file, unused, callback) {
        file.content(function(err, html) {
          callback({ data: html.length === 0 ? '' : html });
        });
      }
    }
  });
  
  html.content = this.rootContent(
    '<link href="' + that.urlPrefix + stylesheet.url() + '" rel="stylesheet" type="text/css">',
    '<script type="text/javascript" src="' + that.urlPrefix + script.url() + '"></script>'
  );
  
  savr = new Saver(that, html);
  savr.save();
};

App.prototype.manifest = function() {
  console.log('Creating Manifest file');
  var that = this;

  var Scanner = function(app, callback) {
    var that = this;
    that.count = 0;
    that.files = [];
        
    that.callbackIfDone = function() {
      if (that.count <= 0) callback(that.files, app.rootDir);
    };

    that.scan = function(path) {      
      that.count += 1;
      
      l.fs.stat(path, function(err, stats) {
        that.count -= 1;
        
        if (err) throw err;
        
        if (stats.isDirectory()) {
          that.count += 1;
          l.fs.readdir(path, function(err, subpaths) {
            that.count -= 1;
            
            if (err) throw err;
            
            subpaths.forEach(function(subpath) {
              if (subpath[0] !== '.') {
                that.scan(l.path.join(path, subpath));
              }
            });
            
            that.callbackIfDone();
          });
          
        } else {
          that.files.push(path.replace(app.rootDir, ''));
        }

        that.callbackIfDone();
      });
    };
  };
  

  this.rootDir = l.path.join(this.savePath, this.buildVersion);

  var scanner = new Scanner(this, function (files, rootDir) {
    var cacheFiles = 'CACHE MANIFEST \n' +
                     '# List of all resources required by this project \n' +
                     '# Explicitly cached entries (only the "CACHE" needs to be added) \n'+ 
                     'CACHE:\n';

    for (var i = 0; i < files.length; i++) {
      cacheFiles += '/' + that.buildVersion + files[i] + '\n'
    }

    cacheFiles += 'NETWORK:\n'+
      '*';

    var manifestPath = l.path.join(rootDir, "app.manifest");
    console.info('ManifestPath', manifestPath);
    l.fs.writeFile(manifestPath, cacheFiles, function(err) {
      if(err) {
         throw err;
      } else {
        console.info("The file was saved!");
      }
    }); 

  }).scan(this.rootDir);

};