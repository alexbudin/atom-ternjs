'use strict';

var Tern = require('tern'),
    fs = require('fs'),
    dir = require('node-dir'),
    ternServer = null,
    MessageIds = {
        TERN_ADD_FILES_MSG: 'AddFiles',
        TERN_UPDATE_FILE_MSG: 'UpdateFile',
        TERN_INIT_MSG: 'Init',
        TERN_JUMPTODEF_MSG: 'JumptoDef',
        TERN_COMPLETIONS_MSG: 'Completions',
        TERN_GET_FILE_MSG: 'GetFile',
        TERN_CALLED_FUNC_TYPE_MSG: 'FunctionType',
        TERN_PRIME_PUMP_MSG: 'PrimePump',
        TERN_GET_GUESSES_MSG: 'GetGuesses',
        TERN_WORKER_READY: 'WorkerReady',
        SET_CONFIG: 'SetConfig',

        // Message parameter constants
        TERN_FILE_INFO_TYPE_PART: 'part',
        TERN_FILE_INFO_TYPE_FULL: 'full',
        TERN_FILE_INFO_TYPE_EMPTY: 'empty'
    };

function init(env, path, file) {
    var ternOptions = {
        //defs: env,
        async: false,
        getFile: getFile,
        plugins: {
            requirejs: {},
            doc_comment: true,
            angular: true
        }
    };
    ternServer = new Tern.Server(ternOptions);
    if (path) {
        dir.files(path, function(err, files) {
            if (err) throw err;

            var fileLength = files.length;
            for(var i=0; i<fileLength; i++) {
                if(/.js$/.test(files[i])) {
                    files[i]
                    ternServer.addFile(files[i]);
                }
            }
        });
    } else {
        // do something with the single file...
    }
}

/**
 * Provide the contents of the requested file to tern
 * @param {string} name - the name of the file
 * @param {Function} next - the function to call with the text of the file
 *  once it has been read in.
 */
function getFile(name) {
    return fs.readFileSync(name);
}

var request = function() {
    ternServer.request.apply(ternServer, arguments);
};
var findFile = function() {
    ternServer.findFile.apply(ternServer, arguments);
};
var addFile = function() {
    ternServer.addFile.apply(ternServer, arguments);
};
var reset = function() {
    ternServer.reset.apply(ternServer, arguments);
};
exports.MessageIds = MessageIds;


process.on('message', function(m) {
    switch (m.method) {
        case 'find-file':
            request(m.request, function(error, data) {
                process.send({
                    id: m.id,
                    method: m.method,
                    data: data
                });
            });
            break;
        case 'add-file':
            addFile(m.file, m.text);
            break;
        case 'request':
            request(m.request,  function(error, data) {
                process.send({
                    id: m.id,
                    error: error,
                    method: m.method,
                    data: data
                });
            });
            break;
        case 'init':
            init(m.env, m.path, m.file);
            break;
        case 'reset':
            reset();
            break;
    }
});