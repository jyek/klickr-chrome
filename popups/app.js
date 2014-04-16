angular.module('KlickrChromeApp', [])

  .controller('PopupCtrl', function ($scope, $interval) {

    var bg = chrome.extension.getBackgroundPage();

    /* Status update loop */
    $scope.refreshStatus = function(){
      $scope.recorderStatus = bg.bgRecorder === undefined ? 'ready' : bg.bgRecorder.getStatus();
      $scope.editorStatus = bg.editor === undefined ? 'inactive' : bg.editor.getStatus();
    };

    $scope.refreshStatus();
    $interval(function() {
      $scope.refreshStatus();
      $scope.Links = bg.latestLinks;  //stephan add
      if ($scope.Links.length>0) {$scope.showRecentLinks = true;}  //stephan add
    }, 500);

    $scope.showMessage = false;
    $scope.message = '';
    $scope.showRecentLinks = false;

    /* ------------------------------------------------------------------------------------*/
    /* TOP NAV
    /* ------------------------------------------------------------------------------------*/

    $scope.canRecord = function(){
      return $scope.recorderStatus === 'ready' && bg.bgPlayer.getStatus() !== 'playing';
    };

    $scope.canStop = function(){
      return $scope.recorderStatus === 'recording';
    };

    $scope.canPlay = function(){
      return bg.bgPlayer.getStatus() === 'ready';
    };

    $scope.showSaver = function(){
      return $scope.recorderStatus === 'processing';
    };

    // on click handlers
    $scope.startRecording = function(){
      window.close();
      $scope.recorderStatus = 'recording';
      bg.startRecording();
    };

    $scope.stopRecording = function(){
      $scope.recorderStatus = 'processing';
      bg.stopRecording();
      $scope.isPaused = true;
    };

    $scope.playRecording = function(){
      window.close();
      bg.bgPlayer.play();
    };

    $scope.toHome = function(){
      chrome.tabs.create({url: 'http://www.klickr.io'});
    };

    /* ------------------------------------------------------------------------------------*/
    /* POST-RECORDING PROCESSING
    /* ------------------------------------------------------------------------------------*/

    $scope.replay = function(){
      console.log('Popup: replay');
      if (bg.editor === undefined) throw new Error('Popup: BgEditor should be defined when replay is clicked');
      bg.editor.replay();
      $scope.refreshStatus();
    };

    $scope.pause = function(){
      // $scope.isPaused = !$scope.isPaused;
      console.log('Popup: pause');
      if (bg.editor === undefined) throw new Error('Popup: BgEditor should be defined when pause is clicked');
      bg.editor.pausePlayback();
      $scope.refreshStatus();
    };

    $scope.save = function(){
      console.log('Save', $scope.desc);
      if ($scope.desc === undefined || $scope.desc === ''){
        $scope.errorMsg = 'Give your Klick a name that packs punch';
      } else {
        $scope.recorderStatus = 'saving';
        $scope.message = 'All\'s Good';
        $scope.showMessage = true;
        bg.saveKlick($scope.desc);
      }
    };

    $scope.delete = function(){
      bg.delete();
      window.close();
    };

    $scope.encodedUrl = function(url){
      return encodeURIComponent(url);
    };

    // chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    //   if (request.action === 'sendPauseMessage') {
    //     $scope.isPaused = request.isPaused;
    //     console.log("In Popup and $scope.isPaused is", $scope.isPaused);
    //   }
    // });

  });