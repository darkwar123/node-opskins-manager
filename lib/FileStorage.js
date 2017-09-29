const fs = require('fs');
const path = require('path');

/**
 * Creates a new FileStorage object
 * @param {string} directory - The local directory where files will be saved if events aren't listened to. No trailing slash. No nesting.
 * @constructor
 */
function FileStorage (directory) {
    this.directory = directory;
}

/**
 * Saves a file
 * @param {string} filename - The name of the file
 * @param {*} contents - The contents of the file
 * @return {undefined}
 */
FileStorage.prototype.save = function (filename, contents) {
    contents = new Buffer(JSON.stringify(contents), 'utf8');

    const dir = path.join(this.directory, filename);

    checkDirExists(this.directory);

    return fs.writeFileSync(dir, contents);
};

/**
 * Reads the contents of a single file
 * @param {string} filename - The name of the file to read
 * @return {Object|null}
 */
FileStorage.prototype.read = function (filename) {
    const dir = path.join(this.directory, filename);

    if(fs.existsSync(dir)){
        const data = fs.readFileSync(dir);

        try{
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    }else{
        return null;
    }
};

function checkDirExists (dir) {
    if(!dir) {
        return;
    }

    let pathDir = '';
    dir.replace(/\\/g, '/').split('/').forEach(function (dir, index) {
        if(index === 0 && !dir) {
            pathDir = '/';
        } else {
            pathDir += (pathDir ? '/' : '') + dir;
        }

        if(!fs.existsSync(pathDir)) {
            fs.mkdirSync(pathDir, 0o750);
        }
    });
}

module.exports = FileStorage;