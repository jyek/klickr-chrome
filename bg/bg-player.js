/* ------------------------------------------------------------------------------------*/
/* BACKGROUND PLAYER
/* ------------------------------------------------------------------------------------*/

var BgPlayer = function(){
  console.log('Initiating BgPlayer...');
  this.reset();
  this.listenForKlickUrl();
  this.addPlayerListeners();
  this.id = ''; // klick object id (corresponds to _id in mongodb)
};
window.BgPlayer = BgPlayer;

/* ------------------------------------------------------------------------------------*/
/* PUBLIC FUNCTIONS
/* ------------------------------------------------------------------------------------*/

/* Play from start */
BgPlayer.prototype.play = function(){
  console.log('BgPlayer: Play with klickQueue', this.klickQueue);
  this.setStatus('playing');
  this.stagedKlick = this.klickQueue[0];
  this.klickQueueIndex = 0;
  var that = this;
  chrome.tabs.query({active:true, lastFocusedWindow: true}, function(tabs){
    that.tabId = tabs[0].id;
    if(tabs[0].url !== that.stagedKlick.ticks[0].url){
      that.redirect(that.stagedKlick.ticks[0].url, function(){
        that.playWhenPlayerReady();
      });
    } else {
      that.playStagedKlick();
    }
  });
};

/* Resume playing from tick index
 * @tickIndex: index to resume play from
 */
BgPlayer.prototype.resume = function(resumeIndex){
  console.log('BgPlayer: Resume');
  this.setStatus('playing');
  this.stagedKlick = this.klickQueue[this.klickQueueIndex];
  console.log(this.stagedKlick);
  helpers.activeTabSendMessage({action: 'resume', klick: this.stagedKlick, index: resumeIndex});
};

/* Pause */
BgPlayer.prototype.pause = function(){
  console.log('BgPlayer: Pause');
  this.setStatus('paused');
  helpers.activeTabSendMessage({action: 'pause'});
};

/* Retrieve current status */
BgPlayer.prototype.getStatus = function(){
  return this.status;
};

/* Set current status
 * @status: valid statuses are Empty, Ready, Playing, Paused
 */
BgPlayer.prototype.setStatus = function(status){
  this.status = status;
};

/* ------------------------------------------------------------------------------------*/
/* HELPERS
/* ------------------------------------------------------------------------------------*/

/* Gets chrome tab by id
 * @tabId: chrome tab id
 * @callback: calls callback when completed
 */
BgPlayer.prototype.getTabById = function(tabId, callback){
  chrome.tabs.query({}, function(tabs){
    for (var i = 0; i < tabs.length; i++){
      if (tabs[i].id === tabId) {
        callback(tabs[i]);
        return;
      }
    }
    callback(null);
  });
};

/* Redirect to next URL
 * @nextUrl: url to redirect to
 * @callback: calls callback when completed
 */
BgPlayer.prototype.redirect = function(nextUrl, callback){
  callback = callback || function(){};
  this.getTabById(this.tabId, function(tab){
    if (tab === null) throw new Error('Tab not found');
    chrome.tabs.update(tab.id, {url: nextUrl}, callback);
  });
};

/* Get Klick from server
 * @id: Mongo id for Klick
 */
BgPlayer.prototype.getKlick = function(id){
  var that = this;
  $.ajax({
    url: Klickr.server + '/klicks/' + id,
    type: 'GET',
    contentType: 'application/json',
    success: function(rawKlick){
      that.setStatus('ready');
      that.buildKlickQueue(rawKlick);
    }
  });
};

/* Announce that playback is finished */
BgPlayer.prototype.onPlayFinished = function(){
  chrome.runtime.sendMessage({action:'playerDone'});

  // sends message to listeners in message.js
  helpers.activeTabSendMessage({
    action: 'createMessage',
    message: 'Playback Finished',
    duration: 2000,
    coords: undefined
  });
};

/* Breaks klick up into subklicks and queue them up for playback
 * A subklick contains ticks from a certain url
 */
BgPlayer.prototype.buildKlickQueue = function(rawKlick){
  var ticks = rawKlick.ticks;
  var index = 0;
  this.klickQueue[0] = this.buildSubKlick(rawKlick, ticks[0]);
  for(var i = 1; i < ticks.length; i++){
    if(ticks[i].url === ticks[i-1].url){
      this.klickQueue[index].ticks.push(ticks[i]);
    } else {
      index++;
      this.klickQueue[index] = this.buildSubKlick(rawKlick, ticks[i]);
    }
  }
  this.buildKlickTickLengths(this.klickQueue);
};

/* Watches tab and plays next subklick when player ready */
BgPlayer.prototype.playWhenPlayerReady = function(){
  var that = this;
  chrome.tabs.onUpdated.addListener(function nextSubKlickListener(){
    // after redirect, find tab by ID
    that.getTabById(that.tabId, function(tab){
      if (tab === null) throw new Error('BgPlayer: Tab does not exist');
      if (tab.status === 'complete'){
        console.log('BgPlayer: Status complete', tab);
        that.playStagedKlick();
        chrome.tabs.onUpdated.removeListener(nextSubKlickListener);
      }
    });
  });
};

/* Plays next subclick. If no more subclicks, player is reset */
BgPlayer.prototype.nextSubKlick = function(){
  var that = this;
  that.klickQueueIndex++;
  console.log(that.klickQueueIndex);
  console.log(that.klickQueue[that.klickQueueIndex]);
  if (that.klickQueueIndex < that.klickQueue.length){
    that.stagedKlick = that.klickQueue[that.klickQueueIndex];
    that.redirect(that.stagedKlick.ticks[0].url, function(){
      that.playWhenPlayerReady();
    });
  } else {
    that.onPlayFinished();
    that.reset();
  }
};

/* Breaks Klick up into subklicks which are played on a single url
 */
BgPlayer.prototype.buildSubKlick = function(rawKlick, tickObj){
  var subKlick = {};
  for(var key in rawKlick){
    if(key !== 'ticks'){
      subKlick[key] = rawKlick[key];
    } else {
      subKlick[key] = [tickObj];
    }
  }
  return subKlick;
};

/* Store lengths of each subklick in array
 */
BgPlayer.prototype.buildKlickTickLengths = function(subKlicks){
  for(var i = 0; i < subKlicks.length; i++){
    this.klickTickLengths.push(subKlicks[i].ticks.length);
  }
};

/* Returns index of current tick being paused at
 */
BgPlayer.prototype.getRawKlickIndex = function(queueIndex, playerIndex){
  for(var i = 0; i < queueIndex; i++){
    playerIndex += this.klickTickLengths[i]+1;
  }
  return playerIndex;
};

/* Tell player to play klick */
BgPlayer.prototype.playStagedKlick = function(){
  console.log('BgPlayer: playStagedKlick', this.stagedKlick, this.tabId);
  var that = this;
  chrome.tabs.sendMessage(this.tabId, {action:'play', klick: this.stagedKlick}, function(res){
    if (res === undefined || res.response === undefined) {
      // if no response, try again
      that.playStagedKlick();
      return;
    }
    this.stagedKlick = undefined;
  });
};

/* Reset BgPlayer variables to initial state */
BgPlayer.prototype.reset = function(){
  this.setStatus('empty');
  this.klickQueue = [];
  this.klickTickLengths = [];
  this.stagedKlick = undefined;
  this.klickQueueIndex = -1;
  this.tabId = '';
};

/* Listener for www.klickr.io/?url=xxx&id=xxx type URLs */
BgPlayer.prototype.listenForKlickUrl = function(){
  var that = this;
  chrome.tabs.onUpdated.addListener(function(){
    chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
      // console.log('Background: Tab update detected', tabs[0].url);
      var url = tabs[0].url;
      var params = window.helpers.parseUrl(url);
      if ( params.host.match(Klickr.hostname) && params.query.hasOwnProperty('url') && params.query.hasOwnProperty('id') ){
        console.log('Background: Play recording with url', decodeURIComponent(params.query.url), 'and id', params.query.id);
        chrome.tabs.update(tabs[0].id, {url: decodeURIComponent(params.query.url)});
        that.id = params.query.id;
        that.getKlick(that.id);
      }
    });
  });
};

/* Listeners from player content script */
BgPlayer.prototype.addPlayerListeners = function(){
  var that = this;
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Player --> BgPlayer: Sends message when subklick has finished playing
    if (request.action === 'klickFinished') {
      that.nextSubKlick();
    }
    // Player --> BgPlayer: Returns index that is paused at upon pause
    else if (request.action === 'klickPaused') {
      var rawKlickIndex = that.getRawKlickIndex(that.klickQueueIndex, request.index);
      chrome.runtime.sendMessage({action:'pauseIndex', rawIndex: rawKlickIndex, resumeIndex: request.index});
    }
  });
};

/* ------------------------------------------------------------------------------------*/
/* INIT
/* ------------------------------------------------------------------------------------*/

var bgPlayer = new BgPlayer();
window.bgPlayer = bgPlayer;
