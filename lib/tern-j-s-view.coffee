{View} = require 'atom'

module.exports =
class TernJSView extends View
  @content: ->
    @div class: 'tern-j-s overlay from-top', =>
      @div "The TernJS package is Alive! It's ALIVE!", class: "message"

  initialize: (serializeState) ->
    atom.workspaceView.command "tern-j-s:toggle", => @toggle()

  # Returns an object that can be retrieved when package is activated
  serialize: ->

  # Tear down any state and detach
  destroy: ->
    @detach()

  toggle: ->
    console.log "TernJSView was toggled!"
    if @hasParent()
      @detach()
    else
      atom.workspaceView.append(this)
