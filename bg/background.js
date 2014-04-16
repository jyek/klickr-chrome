/* ------------------------------------------------------------------------------------*/
/* BACKGROUND
/* Overall controller between BgEditor, BgPlayer and BgRecorder
/* ------------------------------------------------------------------------------------*/

console.log('Background initiated...');

/* ------------------------------------------------------------------------------------*/
/* CONFIG
/* ------------------------------------------------------------------------------------*/

var Klickr = {};
window.Klickr = Klickr;

Klickr.hostname = 'klickr.io';
Klickr.server = 'http://www.klickr.io';

  //stephan start
  window.latestLinks = [];
  //stehan send

/* ------------------------------------------------------------------------------------*/
/* RECORDER
/* ------------------------------------------------------------------------------------*/

/* Background -> BgRecorder: Start recording */
window.startRecording = function(){
  // if (window.bgRecorder.getStatus() === 'ready'){
    console.log('Background: Start recording');
    bgPlayer.reset();
    window.bgRecorder = new BgRecorder();
    window.bgRecorder.setStatus('recording');
    helpers.activeTabSendMessage({action: 'showRecordMessage', message: 'Recording Now'});
  // }
};

/* Background -> BgRecorder: Stop recording */
window.stopRecording = function(){
  if (window.bgRecorder.getStatus() === 'recording'){
    console.log('Background: Stop recording');
    window.bgRecorder.setStatus('processing');
    window.bgRecorder.stop();
    window.editor = new Editor();
    helpers.activeTabSendMessage({action: 'removeRecordMessage'});
  }
};

/* Background -> BgRecorder: Save Klick */
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

window.delete = function () {
  window.bgRecorder = undefined;
  window.refreshRecorderStatus(true);
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Sends server to content scripts
  if (request.action === 'getServer') {
    sendResponse({server: Klickr.server});
  }

  // Save recording: staged recording is sent to recorder to be pushed to server
  else if (request.action === 'save') {
    console.log('Background: Save recording');
    window.bgRecorder.addDescription(request.description);
    window.bgRecorder.send();
    window.bgRecorder = undefined;
    bgPlayer.klickQueue = [];
    sendResponse({response: 'Background: Processed save message'});
  }

  // If DOM is ready and window.bgRecorder.getStatus = 'recording', then send message to message.js
  // else if (request.action === 'recorderReady' && window.bgRecorder.getStatus === 'recording') {
  //   helpers.activeTabSendMessage({action: 'showRecordMessage', message: 'Recording Now'});
  // }
});