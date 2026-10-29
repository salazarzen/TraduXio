
(function($,Traduxio){

  var current="";
  var callbacks={};
  var activityTimeout=null;
  var sessionLength=600000;
  var initialWaitTime=500;
  var maxWaitTime=60000;
  var showPresence=false;

  function resetTimeout(time) {
    time=time||sessionLength;
    if (activityTimeout) clearTimeout(activityTimeout);
    activityTimeout=setTimeout(presence,time);
  };

  var presenceWaitTime=initialWaitTime;

  function presence (callback) {
    if (showPresence) {
    return $.ajax({
      url:Traduxio.getId()+"/presence",
      type:"POST",
      dataType:"json"
    }).done(function(result) {
      if (result.user) {
        me=result.user;
        if (result.ok) {
          receivedActivity({
            type:"session",
            author:result.user,
            anonymous:result.anonymous,
            isMe:true,
            entered:true
          });
        }
      }
      if (result.users) {
        for (var user in result.users) {
          receivedActivity({
            type:"session",
            author:user,
            anonymous:result.users[user].anonymous,
            entered:true
          });
        }
        var names=Object.keys(result.users);
        for (var user in result.users) {
          if (names.indexOf(user)==-1) {
            receivedActivity({
              type:"session",
              author:user,
              anonymous:result.users[user].anonymous,
              left:true
            });
          }
        }
      }
      if (result.sessionLength) {
        sessionLength=result.sessionLength;
      }
      presenceWaitTime=initialWaitTime;
      resetTimeout();
      if (typeof callback=="function") callback();
    }).fail(function(result) {
      presenceWaitTime*=2;
      presenceWaitTime=Math.min(presenceWaitTime,maxWaitTime);
      resetTimeout(presenceWaitTime);
    });
    } else {
      if (typeof callback=="function") callback();
    }
  };

  var leaving=false;
  function leave() {
    leaving=true;
    $.ajax({
      url:Traduxio.getId()+"/presence",
      type:"DELETE"
    });
  };

  $.extend(Traduxio,{
    activity:{
      register:function (type,callback) {
        callbacks[type]=callback;
      },
      wasActive:function() {
        resetTimeout();
      },
      getColor:function(activity) {
        return getUser(activity).color;
      },
      presence:presence
    }
  });

  var changeWaitTime=initialWaitTime;

  function listenChanges(id,seq) {
    $.ajax({
      url:id+"/changes/"+seq,
      dataType:"json"
    })
    .done(function(result) {
      if(result.last_seq!=seq) {
        seq=result.last_seq;
      }
      if (result.results && result.results.length>0) {
        checkActivity(id);
      }
      if (changeWaitTime==maxWaitTime) {
        Traduxio.chat.addMessage({message:"problème de connexion résolu",author:"Traduxio"});
      }
      changeWaitTime=initialWaitTime;
    })
    .fail(function() {
      if (changeWaitTime<maxWaitTime) {
        changeWaitTime*=2;
      }
      if (changeWaitTime>maxWaitTime) {
        changeWaitTime=maxWaitTime;
        Traduxio.chat.addMessage({message:"problème de connexion",author:"Traduxio"});
      }
    })
    .always(function() {
      setTimeout(listenChanges,changeWaitTime,id,seq);
    });
  };

  function checkActivity(id,delay,max,callback) {
    var url=window.location.pathname+"/activity";
    if (delay) url+="?delay="+delay;
    else if (current) url+="?since="+current;
    else {
      return {done:function(){}};
    }
    if (max > 0) url+="&max="+max;
    var s=initialWaitTime;
    function go(){
      $.ajax({
        cache:delay?false:true,
        url:url,
        dataType:"json"})
      .done(function(result) {
        if (result.now) current=result.now;
        if (result.activity) {
          try {
            result.activity.forEach(receivedActivity);
          } catch (E) {
            console.log(E);
          }
        }
        if (typeof callback =="function") callback();
      }).fail(function() {
        if (typeof callback =="function") {
          if (s>maxWaitTime) {
            alert("problème de connexion apparemment, essayez plus tard");
          } else {
            setTimeout(go,s);
            s*=2;
          }
        }
      });
    }
    go();
  };

  function receivedActivity(activity) {
    // Compare timestamps, not sequences: update_seq is an opaque string on
    // CouchDB 2.0+ and cannot be ordered. Both sides come from the server
    // clock, so client skew does not matter.
    var renderedAt=Traduxio.getRenderedAt();
    if (activity.when && !isNaN(renderedAt)
        && new Date(activity.when) < renderedAt) {
      activity.isPast=true;
    }
    var user;
    if (activity.type=="session") {
      user=sessionInfo(activity);
    } else {
      user=getUser(activity);
    }
    if (activity.author==me) {
      activity.isMe=true;
    }
    if (user) {
      activity.anonymous=activity.anonymous || user.anonymous;
      activity.color=user.color;
    }

    if (activity.type && callbacks[activity.type]) {
      callbacks[activity.type](activity);
    }
  };

  function sessionInfo(activity) {
    if (activity.author)
      if (activity.entered) {
        activity.message=getTranslated("i_activity_entered");
      }
    if (activity.left) {
      activity.message=getTranslated("i_activity_exited");
      if (!activity.isPast) {
        if (activity.isMe) {
          leaving ? null : presence();
        }
      }
    }
    var user;
    user=getUser(activity);
    if (Traduxio.chat && Traduxio.chat.addMessage && showPresence) {
      Traduxio.chat.addMessage(activity);
    }
    return user;
  }

  var users={};
  var offlineUsers={};
  var me="";
  var offset=0;
  var colors=["blue","peru","green","red","orangered","lightskyblue","purple","seagreen","tomato"];

  function currentColor() {
    return colors[offset++ % colors.length];
  }

  function getUser(activity) {
    var username=activity.author;
    if (!username) {
      username="anonym";
      if (activity.anonymous && (typeof activity.anonymous == "string")) {
        username+="-"+activity.anonymous.substr(0,3);
      }
    }
    var user=users[username] || {};
    if (!user.color) {
      user.color=currentColor();
    }
    user.name=username;
    users[username]=user;
    return user;
  }
  var defaultShowTime=5000;

  $.fn.showPane=function (after) {
    var hideBack=this.is(":hidden");
    var self=this;
    this.slideDown(function() {
      if (typeof after=="function") after(function(showtime) {
        if (typeof showtime == "undefined") showTime=defaultShowTime;
        if (hideBack && showtime) {
          self.show().delay(showtime).slideUp();
        }
      });
    });
  };

  $(document).ready(function(){
    var id = Traduxio.getId();
    if (id) {
      var p=initialWaitTime;
      presence(function() {
        checkActivity(id,60*24*3600/*2 months*/,300,function() {
          listenChanges(id,Traduxio.getSeqNum());
        });
      });
      $(window).on("beforeunload",leave);
    }
  });

})(jQuery,Traduxio);
