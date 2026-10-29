var defaultConfig = {
  chat:true
}

this.couchapp=this.couchapp || {};
this.couchapp.traduxio=this.couchapp.traduxio || defaultConfig;

var js_i18n_elements=js_i18n_elements || [];
js_i18n_elements.push("i_username");
js_i18n_elements.push("i_password");
js_i18n_elements.push("i_login");
js_i18n_elements.push("i_logged_out");
js_i18n_elements.push("i_logout");
js_i18n_elements.push("i_search");
js_i18n_elements.push("i_signup");
js_i18n_elements.push("i_confirm");
js_i18n_elements.push("i_password");
js_i18n_elements.push("i_fullname");
js_i18n_elements.push("i_email");
js_i18n_elements.push("i_save");
js_i18n_elements.push("i_register_");

// !code lib/path.js
// !code lib/localization.js

Traduxio= {

  config:this.couchapp.traduxio,

  sessionLength:30 * 60 * 1000, //1/2 hour

  req:{},

  doc:{},

  compareActivities:function(a1,a2) {
    var time1=new Date(a1.when).getTime() || 0;
    var time2=new Date(a2.when).getTime() || 0;
    return time1-time2;
  },

  canAccessActivity:function(activity,index) {
    if (activity.version && activity.version!="original") {
      Traduxio.config.debug && log("check if "+Traduxio.getUser().name+" can access "+activity.version);
      if (Traduxio.doc && Traduxio.doc.translations) {
        if (Traduxio.doc.translations[activity.version]) {
          Traduxio.config.debug && log("FOUND VERSION IN TRANSLATIONS");
          var ok=Traduxio.canAccess(Traduxio.doc.translations[activity.version]);
          if (ok) {
            Traduxio.config.debug && log("access granted");
          } else {
            Traduxio.config.debug && log("access denied");
          }
          return ok;
        }
      } else {
        Traduxio.config.debug && log("NO DOC TO CHECK");
      }
      return false;
    } else {
      return true;
    }
  },

  unique_version_name:function(version) {
    var i=2;
    version=version.trim();
    var newname=version;
    while (this.doc.translations && newname in this.doc.translations || newname == "original" || newname.length == 0) {
      newname=version+" ("+i+")";
      i++;
    }
    return newname;
  },

  age:function(activity,r) {
    r=r||new Date();
    return r.getTime()-this.time(activity);
  },

  time:function(activity) {
    return new Date(activity.when).getTime();
  },

  isFreeWork:function (work) {
    if (work && work.creativeCommons) {
      return true;
    }
    return false;
  },

  isPublic:function (work) {
    work=work || this.doc;
    if (work) {
      if (work.text || work.hasOwnProperty("original")) {  //comes from works view
        work.privileges=work.privileges || {};
        if (work.privileges.public) {
          return true
        }
        Traduxio.debug && log("work is not public");
        return false;
      } else {
        Traduxio.debug && log("no original version, checking translations");
        if (this.isOriginalWork(work)) {
          Traduxio.debug && log("checking translations");
          for (var t in work.translations) {
            if (this.isPublic(work.translations[t])) {
              Traduxio.debug && log("translation "+t+" is public");
              return true;
            }
          }
          Traduxio.debug && log("no public translation, denying access");
        }
      }
      Traduxio.debug && log("work is not public");
      return false;
    }
    return false;
  },

  isOriginalWork:function (work) {
    work=work || this.doc;
    if (work) {
      if (work.hasOwnProperty("translations")) {
        return true;
      }
      Traduxio.debug && log("no translations, is not original");
      return false;
    }
    return false;
  },

  isOwner:function (work) {
    work=work || this.doc;
    if (work) {
      var privileges=work.privileges || {};
      var user=this.getUser();
      if ((!user.anonymous || Traduxio.config.anonymous_edit) && privileges.owner==user.name) return true;
    } else {
      if (Traduxio.config.anonymous_edit) return true;
    }
    return false;
  },

  isObserver:function (work) {
    var user=this.getUser();
    work=work || this.doc;
    if (work) {
      this.config.debug && log(user.name+" isObserver on "+work.title+" "+work.creator);
      var privileges=work.privileges || {public:true};
      this.config.debug && log(privileges);
      if (privileges.observers && privileges.observers.indexOf(user.name)!=-1) return true;
    }
    return false;
  },

  hasSharedAccess:function (work) {
    var user=this.getUser();
    work=work || this.doc;
    if (work) {
      if (work.text || work.hasOwnProperty("original")) {
        this.config.debug && log(user.name+" hasSharedAccess to "+work.title+" "+work.creator);
        var privileges=work.privileges || {};
        this.config.debug && log(privileges);
        if (privileges.sharedTo && privileges.sharedTo.indexOf(user.name)!=-1) return true;
      } else {
        if (this.isOriginalWork(work)) {
          for (var t in work.translations) {
            if (this.hasSharedAccess(work.translations[t])) return true;
          }
        }
      }
    }
    return false;
  },

  canAccess:function(work) {
    if (work==null) {
      this.config.debug && log ("can access absent work");
      return true;
    } else {
      this.config.debug && log (this.getUser().name + " can access ?");
      if (this.isAdmin()) return true;
      if (this.isOwner(work)) return true;
      if (this.hasSharedAccess(work)) return true;
      if (this.isObserver(work)) return true;
      if (this.isPublic(work)) return true;
      this.config.debug && log("no access");
      return false;
    }
  },

  canEdit:function(work) {
    if (this.isAdmin()) return true;
    if (this.isOwner(work)) return true;
    if (!this.isOriginalWork(work)) {
      if (this.hasSharedAccess(work,true)) return true;
      if (this.hasSharedAccess(work) && this.config.allEdit) return true;
    }
    if (work) {
      var privileges=work.privileges || {};
      if (Traduxio.config.anonymous_edit && !privileges.owner) {
        Traduxio.config.debug && log("can anonymously edit work");
        return true;
      }
      Traduxio.config.debug && log("no edit access to "+work.title+" "+work.creator);
    } else {
      var user=this.getUser();
      if (user.anonymous && !Traduxio.config.anonymous_edit) {
        Traduxio.config.debug && log("Can't add work");
        return false;
      } else {
        Traduxio.config.debug && log("Can add work");
        return true;
      }
    }
    return false;
  },

  canTranslate:function(work) {
    Traduxio.config.debug && log("can translate ?");
    if (this.isAdmin()) return true;
    work=work||this.doc;
    if (this.isOriginalWork(work) &&
      (
        this.isPublic(work) || this.isOwner(work) || this.hasSharedAccess(work)
      )
      && (!this.getUser().anonymous || Traduxio.config.anonymous_edit)
    ) {
      return true;
    }
    Traduxio.config.debug && log("no, cannot translate");
    return false;
  },

  canDelete:function (work) {
    return this.isAdmin() || this.isOwner(work);
  },

  checkActiveUsers:function() {
    var toQuit=[];
    for (var user in this.doc.users) {
      var activeDate=new Date(this.doc.users[user].active);
      var expirationDate=new Date(activeDate.getTime()+this.sessionLength);
      if (expirationDate=="Invalid Date" || expirationDate < new Date()) {
        toQuit.push(user);
      }
    }
    toQuit.forEach(function(user){
      Traduxio.config.debug && log(user+" leaves for inactivity");
      Traduxio.userQuit(user);
    });
  },

  userQuit:function(username) {
    if (this.doc.users && this.doc.users[username]) {
      this.doc.session=this.doc.session || [];
      this.addActivity(this.doc.session,{left:true,author:username},false);
      delete this.doc.users[username];
      this.config.debug && log("removing "+username+" from active users of "+this.doc._id);
      return true;
    }
    return false;
  },

  userActivity:function(username) {
    this.doc.users=this.doc.users || {};

    var washere=false;
    var user;
    if (username) {
      user=this.doc.users[username];
      //conversion from old format
      if (!user.name) user.name=username;
      //TODO remove when data is conform
    } else {
      user=this.getUser();
      username=user.name;
      if (this.doc.users[username] && this.doc.users[username].active) {
        user.active=this.doc.users[username].active;
      } else {
        delete user.active;
      }
      this.config.debug && log(user);
    }
    if (!user) return false;
    var alreadyActive=false;
    if(this.doc.users[username]) {
      alreadyActive=true;
    }
    this.doc.users[username]=user;
    this.config.debug && log(this.doc.users);
    var update=false;
    if (this.doc.users[username].active) {
      var activeDate=new Date(this.doc.users[username].active);
      var expirationDate=new Date(activeDate.getTime()+this.sessionLength/2);
      if (expirationDate < new Date()) {
        update=true;
      }
    } else {
      update=true;
    }
    if (update) {
      this.doc.users[username].active=new Date();
      if (username==this.getUser().name) this.checkActiveUsers();
    }
    if (!alreadyActive) {
      this.doc.session=this.doc.session || [];
      this.addActivity(this.doc.session,{entered:true,author:username,anonymous:user.anonymous},false);
    }
    return update;
  },

  clearActivity:function (activityList,delay) {
    delay=delay || this.sessionLength;
    if (activityList && activityList.length) {
      this.doc.activity.sort(this.compareActivities);
      var now=new Date();
      for (var i=0;i<activityList.length && this.age(activityList[i],now)>delay;i++);
      this.config.debug && log("splicing activity for "+i);
      activityList.splice(0,i);
    }
  },

  _isConfirmed:function (userCtx,secObj) {
    if (userCtx.roles.indexOf('confirmed') != -1) return true;
  },

  isAdmin:function () {
    return this.getUser().isAdmin;
  },

  _isAdmin:function (userCtx,secObj) {
    if (userCtx.roles.indexOf('_admin') != -1) return true;
    if (secObj.admins) {
      if (userCtx.name && isArray(secObj.admins.names) && secObj.admins.names.indexOf(userCtx.name) != -1) return true;
      var ok=false;
      if (isArray(secObj.admins.roles) && isArray(userCtx.roles)) {
        userCtx.roles.forEach(function(role) {
          if (secObj.admins.roles.indexOf(role) != -1) {
            ok=true;
          };
        });
      }
      if (ok) return true;
    }
    return false;
  },

  getUser:function() {
    var user={};

    if (this.req.userCtx.name) {
      user.name=this.req.userCtx.name;
      if (!this._isConfirmed(this.req.userCtx)) user.anonymous=true;
    } else {

      hashCode = function(string) {
        var hash = 0, i, chr;
        if (string.length === 0) return hash;
        for (i = 0; i < string.length; i++) {
          chr   = string.charCodeAt(i);
          hash  = ((hash << 5) - hash) + chr;
          hash |= 0; // Convert to 32bit integer
        }
        return hash.toString(16);
      };

      user.anonymous=true;
      user.name=null;

      if (this.req.peer && this.req.headers) {
        var footprint=this.req.peer+"|"+this.req.headers["User-Agent"]+"|"+this.req.headers.Host;
        user.anonymous=hashCode(footprint);
      }

    }
    user.roles=this.req.userCtx.roles;
    user.isAdmin=this._isAdmin(this.req.userCtx,this.req.secObj);
    Traduxio.debug && log("user is currently "+user.name);
    return user;
  },

  addActivity: function(activityList,data,active) {
    if (typeof active == "undefined") active=true;
    var activity=data || {};
    activity.when = activity.when || new Date();
    // No seq is recorded. On CouchDB 2.0+ req.info.update_seq is an opaque
    // string, so it can neither be ordered nor decremented. Ordering is by
    // `when` (see compareActivities); the client tells new activity from old
    // by comparing `when` against the page's data-rendered-at.
    if (!activity.author) {
      var user=this.getUser();
      activity.author=user.name;
      if (user.anonymous) activity.anonymous=user.anonymous;
    }
    activityList.push(activity);
    if (active) this.userActivity();
    this.fixActivity(activityList);
    activityList.sort(this.compareActivities);
  },

  fixActivity: function(activityList) {
    for (var i in activityList) {
      var activity=activityList[i];
      activity.when=new Date(activity.when);
    }
  },

  getActivity: function(activityList,since,data,activity) {
    data=data || {};
    var activity=activity || [];
    for (var i=activityList.length-1;i>=0 && this.age(activityList[i],since)<=0;i--) {
      var a={};
      for (var t in activityList[i]) {
        a[t]=activityList[i][t];
      }
      for (var t in data) {
        a[t]=data[t];
      }
      activity.unshift(a);
    }
    return activity;
  }

};

if (typeof doc != "undefined" && doc!=null) Traduxio.doc=doc;
if (typeof req != "undefined" && req!=null) Traduxio.req=req;
