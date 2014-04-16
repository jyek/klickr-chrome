/* ------------------------------------------------------------------------------------*/
/* Player Class
/*
/* ------------------------------------------------------------------------------------*/

var Player = function(){
  console.log('Initializing player...');

  this.pause = false;

  var that = this;

  // Listens to messages from background
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'play'){
      that.newPlayController(request.klick);
      console.log('Playing Klick');
      sendResponse({response: 'Player: Playing Klick...'});
    }

    else if (request.action === 'pause'){
      that.pause = true;
      console.log('paused');
    }

    else if (request.action === 'resume'){
      console.log('Player: Resume', request.index, request.klick);
      that.resumePlayController(request.klick, request.index);
      console.log('Resuming Klick Play');
      sendResponse({response: "Player: Resuming Klick Play"});
    }

    else if (request.action === 'ready'){
      sendResponse({response: 'ready'});
    }

  });

};

window.Player = Player;

/* ------------------------------------------------------------------------------------*/
/* Klick Formatting Methods
/* ------------------------------------------------------------------------------------*/

  Player.prototype.formatKlick = function(klick) {
    var movement = klick.ticks;
    this.scaleXY(klick);
    this.setMoveIntervals(movement);
    this.setMessages(movement);
  };

  //scales clientX, clientY, pageX, and pageY so different screen sizes will have the same display.
  Player.prototype.scaleXY = function(klick){
    var xScale = $(window).width() / klick.width || 1;
    var yScale = $(window).height() / klick.height || 1;
    klick.width = $(window).width();
    klick.height = $(window).height();
    for(var i = 0; i < klick.ticks.length; i++){
      klick.ticks[i].clientX = klick.ticks[i].clientX*xScale;
      klick.ticks[i].clientY = klick.ticks[i].clientY*yScale;
      klick.ticks[i].pageX = klick.ticks[i].pageX*xScale;
      klick.ticks[i].pageY = klick.ticks[i].pageY*yScale;
    }
  };

  //uses Date.parse to turn the timestamp value from a date to an integer.  Also establishes the t value of the movement array.
  // put movement[0].t === undefined so for multiple recordings, there would not be a lag between recordings
  Player.prototype.setMoveIntervals = function(movement){
    if(movement[0].t === undefined){
      if(typeof movement[0].timestamp !== 'number'){
        this.parseDate(movement);
      }
      movement[0].t = 0;
      for (var i = 1; i < movement.length-1; i++){
        movement[i].t = movement[i].timestamp - movement[i-1].timestamp;
      }
    }
    console.log('Player: Setting move intervals..');
  };

  //changes the iso date object in timestamp to an integer of the Date.now() format
  Player.prototype.parseDate = function(movement){
    for(var i = 0; i < movement.length; i++){
      movement[i].timestamp = Date.parse(movement[i].timestamp);
    }
  };

  Player.prototype.setMessages = function(movement){
    for(var i = 0; i < movement.length; i++){
      if(movement[i].annotation !== '' && movement[i].annotation !== undefined){
        movement[i].message = new Message(movement[i].annotation, 3000, {'top':movement[i].pageY, 'left':movement[i].pageX });
      }
    }
    console.log('Player: Setting messages..');
  };

/* ------------------------------------------------------------------------------------*/
/* Play Recording Methods
/* ------------------------------------------------------------------------------------*/

  // chains mouse moves together. also adds the scrolling logic. the pageX and pageY values of the movement object at index are passed to move.
  // function operates recursively, waiting the duration of the prior move in a setTimeout before calling the next move.
  Player.prototype.playRecording = function(movement, index){
    if ( index === movement.length ) {
      this.endPlay();
    } else if (this.pause){
      this.pausePlay(index);
    } else {
      if(index === 0){
        this.placeMouse(movement);
      } else {
        this.showPlay(movement, index);
      }
      var that = this;
      setTimeout(function(){
        that.playRecording(movement, index+1);
      }, movement[index].t);
    }
  };

  // this function is very similar to Recorder.sendToBackground.  sends the nextKlick message to background, passing data over as the klick.
  Player.prototype.endPlay = function(){
    console.log('Player: Sending to background');
    chrome.runtime.sendMessage({action : "klickFinished"});
    $('.mouse').detach();
  };


  Player.prototype.pausePlay = function(index){
    chrome.runtime.sendMessage({action : "klickPaused", index:index});
    console.log('Player: paused');
  };

  //places the mouse in the dom and gives the mouse's initial position and characteristics
  Player.prototype.placeMouse = function(movement){
    var cursor = chrome.extension.getURL("img/klickr-pointer.png");
    console.log(cursor);
    $('body').append('<div class="mouse" style="position:absolute; background: url('+cursor+'); width: 40px; z-index: 9999; height:40px; top: '+movement[0].pageY+'px; left:'+movement[0].pageX+'px;"></div>');
  };


  Player.prototype.showPlay = function(movement, index){
    if (movement[index].action === 'move'){
      this.move(movement, index);
    } else if (movement[index].action === 'keypress'){
      this.keypress(movement, index);
    } else if (movement[index].action === 'click'){
      this.click(movement, index);
    }
    if (!!movement[index].message){
      movement[index].message.showMessageOnScreen();
    }
  };

// moves mouse to given destination with duration
  Player.prototype.move = function (movement, index){
    $(window).scrollLeft(movement[index].pageX-movement[index].clientX);
    $(window).scrollTop(movement[index].pageY-movement[index].clientY);
    d3.select('.mouse')
      .transition()
      .duration(movement[index].t)
      .style({'top': movement[index].pageY + 'px', 'left': movement[index].pageX + 'px'});
  };

  Player.prototype.keypress =function(movement, index) {
    var $element = $($(movement[index].target.tagName)[movement[index].target.index]);
    var key = String.fromCharCode(movement[index].charCode);
    var text = $element.val();
    $element.val(text + key);
  };

  Player.prototype.click = function(movement, index) {
    var $clickElement = $($(movement[index].target.tagName)[movement[index].target.index]);
    $clickElement.trigger('click');
  };


/* ------------------------------------------------------------------------------------*/
/* Play Controllers
/* ------------------------------------------------------------------------------------*/

  Player.prototype.newPlayController = function(klick){
    this.formatKlick(klick);
    this.playRecording(klick.ticks, 0);
  };

  Player.prototype.resumePlayController = function(klick, index){
    this.formatKlick(klick);
    this.pause = false;
    this.playRecording(klick.ticks, index);
  };


/* ------------------------------------------------------------------------------------*/
/* Init
/* ------------------------------------------------------------------------------------*/

$(function(){

  //helper for playing back mouse actions
  var player = new Player();

});
