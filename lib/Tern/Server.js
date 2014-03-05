"use strict";

var Tern = require('tern'),
    fs = require('fs'),
    ternServer = null,
    MAX_HINTS = 30, // how often to reset the tern server
    LARGE_LINE_CHANGE = 100,
    LARGE_LINE_COUNT = 2000,
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

function init(env) {
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

    if (atom.project.getPath()) {
        atom.project.scan("/^.+\.((?:[jJ][sS]))$/", {}, function(data) {
            ternServer.addFile(data.filePath);
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

/**
 * Our logging method...
 *
 * @param {string} msg - the log message
 */
function _log(msg) {
    throw msg;
}

exports.init = init;
exports.request = function() { ternServer.request.apply(ternServer, arguments) };
exports.findFile = function() { ternServer.findFile.apply(ternServer, arguments) };
exports.addFile = function() { ternServer.addFile.apply(ternServer, arguments) };
exports.reset = function() { ternServer.reset.apply(ternServer, arguments) };
exports.MessageIds = MessageIds;
