/* ------------------------------------------------------------------------------------*/
/* BACKGROUND RECORDER
/* Consolidates ticks streamed from content script recorders into Klick object
/* ------------------------------------------------------------------------------------*/

var BgRecorder = function(){
  console.log('Initiating BgRecorder...');

  // bind listeners so they can be removed later
  this.bindUpdateActiveTab = helpers.bind(this.updateActiveTab, this);
  this.bindMsgHandler = helpers.bind(this.msgHandler, this);

  // init
  this.isRecording = true;
  this.createKlick();
  this.bindUpdateActiveTab();
  this.onTabsUpdated();
  this.addListeners();
  this.msgStart();
  helpers.activeTabSendMessage({action: 'startRecording'});
  this.setStatus('loading');
};

window.BgRecorder = BgRecorder;

/* Listener on tab updated */
BgRecorder.prototype.onTabsUpdated = function(){
  var self = this;
  chrome.tabs.onUpdated.addListener(function(){
    self.refreshStatus();
  });
};

/* Retrieve current status */
BgRecorder.prototype.refreshStatus = function(forced){
  var self = this;
  if (forced === undefined) forced = false;
  if (forced || (self.status === 'loading' || self.status === 'ready') ){
    chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
      console.log('Background: Tab updated', tabs[0].url, tabs[0].status);
      if (tabs[0].status === 'loading'){
        self.setStatus('loading');
      } else if (tabs[0].status === 'complete') {
        self.setStatus('ready');
      }
    });
  }
};

/* Retrieve current status */
BgRecorder.prototype.getStatus = function(){
  return this.status;
};

/* Set current status
 * @status: valid statuses are loading -> ready -> recording -> processing -> saving
 */
BgRecorder.prototype.setStatus = function(status){
  this.status = status;
};

/* Return Klick object */
BgRecorder.prototype.getKlick = function(){
  return this.klick;
};

/* Update Klick object
 * @klick: KLick object to replace existing one
 */
BgRecorder.prototype.updateKlick = function(klick){
  this.klick = klick;
};

/* Display start recording message */
BgRecorder.prototype.msgStart = function(){
  helpers.activeTabSendMessage({
    action: 'createMessage',
    message: 'Start Recording Now',
    duration: 2000,
    coords: undefined
  });
};

/* Display stop recording message */
BgRecorder.prototype.msgStop = function(){
  helpers.activeTabSendMessage({
    action: 'createMessage',
    message: 'Stop Recording Now',
    duration: 2000,
    coords: undefined
  });
};

/* Creates a new Klick object */
BgRecorder.prototype.createKlick = function(){
  this.klick = {
    url: document.URL,
    description: '',
    ticks: []
  };
  this.getWindowSize();
};

/* Add description to Klick
 * @desc: description of Klick
 */
BgRecorder.prototype.addDescription = function(desc){
  this.klick.description = desc;
};

/* Update active tab url */
BgRecorder.prototype.updateActiveTab = function(){
  if (this.isRecording){
    var self = this;

    // update active tab and start its recording
    chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
      self.activeUrl = tabs[0].url;
      self.activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(self.activeTabId, {action: 'startRecording'});
      console.log('BgRecorder: Url changed on tab', self.activeTabId, 'with url', self.activeUrl);
    });

    // stop other tabs from recording
    chrome.tabs.query({'lastFocusedWindow': false}, function(tabs){
      for (var i = 0; i < tabs.length; i++){
        chrome.tabs.sendMessage(tabs[i].id, {action: 'stopRecording'});
      }
    });
  }
};

/* Handles messages from content scripts
 * @request: message sent
 * @sender: chrome tab that sent message
 * @res: response
 */
BgRecorder.prototype.msgHandler = function(req, sender, res){
  var self = this;
  // appends tick to Klick
  if (req.action === 'appendTick') {
    self.appendTick(req.tick, sender.tab);
  }
  // when any recorder script is loaded, refresh the active tab
  else if (req.action === 'recorderReady') {
    self.bindUpdateActiveTab();
  }
};

/* Add listeners */
BgRecorder.prototype.addListeners = function(){
  chrome.tabs.onUpdated.addListener(this.bindUpdateActiveTab);
  chrome.runtime.onMessage.addListener(this.bindMsgHandler);
};

/* Remove listeners */
BgRecorder.prototype.removeListeners = function(){
  chrome.tabs.onUpdated.removeListener(this.bindUpdateActiveTab);
  chrome.runtime.onMessage.removeListener(this.bindMsgHandler);
};

/* Gets inner width and height from active tab */
BgRecorder.prototype.getWindowSize = function(){
  var self = this;
  helpers.activeTabSendMessage({action: 'getWindowSize'}, function(response){
    if (response && response.innerWidth && response.innerHeight){
      self.klick.width = response.innerWidth;
      self.klick.height = response.innerHeight;
    }
  });
};

/* Append tick to Klick object
 * @tick: single tick object
 * @fromTab: chrome tab that sent tick
 */
BgRecorder.prototype.appendTick = function(tick, fromTab){
  // if sent from active tab
  if (this.isRecording && this.activeTabId === fromTab.id){
    console.log('BgRecorder: Add', this.activeUrl, tick.url, tick.pageX, tick.pageY);
    this.klick.ticks.push(tick);
  } else {
    // for debugging
    console.log('BgRecorder: Reject', this.activeUrl, tick.url, tick.pageX, tick.pageY);
  }
};

/* Append tick to Klick object */
BgRecorder.prototype.stop = function(){
  this.isRecording = false;
  helpers.sendMessage({action: 'stopRecording'});
  this.removeListeners();
  this.msgStop();
};

/* Background -> Server: Send current klick object to the server to save */
BgRecorder.prototype.send = function(){
  console.log('BgRecorder -> Server: Push to server...', JSON.stringify(this.klick));
  $.ajax({
    type: 'POST',
    url: Klickr.server + '/klicks',
    data: JSON.stringify(this.klick),
    contentType: 'application/json',
    success: function(data) {
      console.log('BgRecorder -> Server: Klick sent', data);
      // stephan start
      var newLink = window.Klickr.server + data.linkUrl;
      window.latestLinks.push({description: data.description, url: newLink});
      // stephan end
    },
    error: function(data){
      console.log('BgRecorder -> Server: Klick send failed', data);
    }
  });
};