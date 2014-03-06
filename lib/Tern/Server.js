"use strict";

var cp = require('child_process'),
    ternServer = null,
    randString = function() {return Math.random().toString(36).substring(7);},
    MessageIds = {
        TERN_ADD_FILES_MSG: "AddFiles",
        TERN_UPDATE_FILE_MSG: "UpdateFile",
        TERN_INIT_MSG: "Init",
        TERN_JUMPTODEF_MSG: "JumptoDef",
        TERN_COMPLETIONS_MSG: "Completions",
        TERN_GET_FILE_MSG: "GetFile",
        TERN_CALLED_FUNC_TYPE_MSG: "FunctionType",
        TERN_PRIME_PUMP_MSG: "PrimePump",
        TERN_GET_GUESSES_MSG: "GetGuesses",
        TERN_WORKER_READY: "WorkerReady",
        SET_CONFIG: "SetConfig",

        // Message parameter constants
        TERN_FILE_INFO_TYPE_PART: "part",
        TERN_FILE_INFO_TYPE_FULL: "full",
        TERN_FILE_INFO_TYPE_EMPTY: "empty"
    };

exports.init = function(env) {
    console.log(__dirname + '/Worker.js');
    ternServer = cp.fork(__dirname + '/Worker.js');

    ternServer.send({ method: 'init', env: env, path: atom.project.getPath(), file: undefined});

    ternServer.on('exit', function (code, signal) {
        console.log('Tern server crashed for an unknown reason...');
    });
};

exports.request = function(request, callback) {
    var reqID = randString();
    ternServer.send({ method: 'request', id: reqID, request: request});

    var cb = function (data) {
        if(data.method === 'request' && data.id === reqID) {
            callback(data.error, data.data);
            ternServer.removeListener('message', cb);

        }
    };
    ternServer.on('message', cb);
};
exports.findFile = function(filename, callback) {
    var reqID = randString();
    ternServer.send({ method: 'find-file', id: reqID, file: filename});

    var cb = function (data) {
        if(data.method === 'find-file' && data.id === reqID) {
            callback(data.error, data.data);
            ternServer.removeListener('message', cb);
        }
    };
    ternServer.on('message', cb);
};
exports.addFile = function(path, text) {
    ternServer.send({ method: 'add-file', file: path, text: text});
};
exports.reset = function() {
    ternServer.send({ method: 'reset'});
};
exports.MessageIds = MessageIds;
