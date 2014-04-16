/* ------------------------------------------------------------------------------------*/
/* BACKGROUND
/* Overall controller between BgEditor, BgPlayer and BgRecorder
/* ------------------------------------------------------------------------------------*/

console.log('Background initiated...');

/* ------------------------------------------------------------------------------------*/
/* KLICKR
/* ------------------------------------------------------------------------------------*/

// TODO: refactor into Klickr and put Klickr into its own file

window.latestLinks = [];

var Klickr = function(){
  this.hostname = 'klickr.io';
  this.server = 'http://www.klickr.io';
};
window.Klickr = Klickr;

/* Initialize app */
Klickr.prototype.init = function(){
  chrome.tabs.onUpdated.addListener(function(){
    self.refreshStatus();
  });
};

/* Retrieve current status */
Klickr.prototype.refreshStatus = function(forced){
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
Klickr.prototype.getStatus = function(){
  return this.status;
};

/* Set current status
 * @status: valid statuses are Loading and Ready
 */
Klickr.prototype.setStatus = function(status){
  this.status = status;
};

/* ------------------------------------------------------------------------------------*/
/* INIT
/* ------------------------------------------------------------------------------------*/

var klickr = new Klickr();
window.klickr = klickr;

var bgRecorder = new BgRecorder();
window.bgRecorder = bgRecorder;

// TODO: Editor and Player should be instantiated here


/* Background -> BgRecorder: Start recording */
// TODO: move to Klickr method
window.startRecording = function(){
  if (klickr.getStatus() === 'ready' && bgRecorder.getStatus() === 'ready'){
    console.log('Background: Start recording');
    bgPlayer.reset();
    bgRecorder.start();
  }
};

/* Background -> BgRecorder: Stop recording */
// TODO: move to Klickr method
window.stopRecording = function(){
  if (bgRecorder.getStatus() === 'recording'){
    console.log('Background: Stop recording');
    window.editor = new Editor();
  }
};

/* Background -> BgRecorder: Save Klick */
// TODO: move to Klickr method
window.saveKlick = function(desc){
  if (window.bgRecorder.getStatus() === 'processing'){
    console.log('Background: Save recording');
    window.editor.updateKlick();
    window.bgRecorder.addDescription(desc);
    window.bgRecorder.send();
    window.bgRecorder = undefined;
    window.refreshRecorderStatus(true);
  }
};

// TODO: move to Klickr method
window.delete = function () {
  window.bgRecorder = undefined;
  window.refreshRecorderStatus(true);
};


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Sends server to content scripts
  // TODO: Klickr method
  if (request.action === 'getServer') {
    sendResponse({server: Klickr.server});
  }

  // Save recording: staged recording is sent to recorder to be pushed to server
  // Klickr method
  else if (request.action === 'save') {
    console.log('Background: Save recording');
    window.bgRecorder.addDescription(request.description);
    window.bgRecorder.send();
    // TODO: bgRecorder should persist like bgPlayer
    window.bgRecorder = undefined;
    bgPlayer.klickQueue = [];
    sendResponse({response: 'Background: Processed save message'});
  }

  // If DOM is ready and window.bgRecorder.getStatus = 'recording', then send message to message.js
  // else if (request.action === 'recorderReady' && window.bgRecorder.getStatus === 'recording') {
  //   helpers.activeTabSendMessage({action: 'showRecordMessage', message: 'Recording Now'});
  // }
});