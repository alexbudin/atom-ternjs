"use strict";

var TernServer = require('./Server'),
    autocompleteView,
    MessageIds = TernServer.MessageIds;

/**
 * Build an object that can be used as a request to tern.
 *
 * @param {{type: string, name: string, offsetLines: number, text: string}} fileInfo
 * - type of update, name of file, and the text of the update.
 * For "full" updates, the whole text of the file is present. For "part" updates,
 * the changed portion of the text. For "empty" updates, the file has not been modified
 * and the text is empty.
 * @param {string} query - the type of request being made
 * @param {{line: number, ch: number}} offset -
 */
function Request(fileInfo, query, offset) {
    query = {
        type: query
    };
    query.start = offset;
    query.end = offset;
    query.file = (fileInfo.type === MessageIds.TERN_FILE_INFO_TYPE_PART) ? "#0" : fileInfo.name;
    query.filter = true;
    query.sort = false;
    query.depths = true;
    query.guess = atom.config.get("ternjs.guessWhenNoDetailsFound");
    query.origins = true;
    query.types = true;
    query.caseInsensitive = atom.config.get("ternjs.caseInsensitiveHints");
    query.expandWordForward = atom.config.get("ternjs.expandHintsForward");
    query.lineCharPositions = true;

    var request = {
        query: query,
        files: [],
        offset: offset
    };
    if (fileInfo.type !== MessageIds.TERN_FILE_INFO_TYPE_EMPTY) {
        request.files.push(fileInfo);
    }

    return request;
}


module.exports = Request;
