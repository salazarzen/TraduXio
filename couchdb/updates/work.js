function(work, req) {
  var doc=work;
  //!code lib/traduxio.js

  if (["PUT","POST","DELETE"].indexOf(req.method)==-1) {
    return [null,{code:405,body:"Method "+req.method+" not allowed"}];
  }
  if (["PUT","POST"].indexOf(req.method)!=-1) {
    var args;
    try {
      args = JSON.parse(req.body);
    } catch (e) {
      return [null,{code:400,body:"Couldn't parse JSON body"}];
    }
  }
  var actions=[];
  var result={};
  var version_name = req.query.version;
  if (["PUT","DELETE"].indexOf(req.method)!=-1) {

    if (work===null) {
      return [null,{code:404,body:"Not found"}];
    }
    var original=false,
        created=false;

    if(!version_name || version_name == "original") {
      original=true;
    } else {
      if(!work.translations[version_name]) {
        return [null,{code:404,body:version_name+" not found"}];
      }
      doc = work.translations[version_name];
    }
  } else { //req.method==POST
    if (work!==null) {
      if (args.creator) {
        version_name=args.creator.trim();
        if (version_name=="original") {
          return [null,{code:400,body:"reserved name 'original'"}];
        }
        delete args.creator;
      } else {
        original=true;
      }

      work.edits=work.edits||[];

    } else {
      created=true;
      original=true;
      version_name="original";
      Traduxio.doc=doc=work={};
      doc.privileges={};
      if (!Traduxio.getUser().anonymous) {
        doc.privileges.owner=Traduxio.getUser().name;
      } else {
        doc.privileges.public=true;
      }
      work._id=work.id || req.uuid;
      delete work.id;
      work.edits=[];
      actions.push("created new doc "+work._id);
      work.translations={};
      result.id=work._id;
      doc=work;
      Traduxio.addActivity(work.edits,{action:"created"});
    }

    if (original) {
      if (args.hasOwnProperty("original") && args.original) {
        doc=work;
        doc.text=emptyText(work);
        actions.push("created original version");
        Traduxio.addActivity(work.edits,{action:"created",version:"original"});
        result.version="original";
        created=true;
      }
      delete args.original;
    } else if (version_name) {
      if (!work.translations[version_name]) {
        var date=new Date().toISOString().substring(0, 10);
        work.translations[version_name] = {
          title: "",
          language: "",
          creator:"",
          text: emptyText(work),
          date:date
        };
        doc=work.translations[version_name];
        if (Traduxio.getUser().name) {
          doc.privileges ={ owner: Traduxio.getUser().name};
        }
        if (Traduxio.config.autoShareToOwner && work.privileges && work.privileges.owner) {
          doc.privileges=doc.privileges || {};
          doc.privileges.sharedTo=[work.privileges.owner];
          Traduxio.addActivity(work.edits,{action:"shared",version:version_name,to:work.privileges.owner});
        }
        if (Traduxio.config.autoShareToAll) {
          doc.privileges=doc.privileges || {};
          doc.privileges.sharedTo=doc.privileges.sharedTo || [];
          doc.privileges.sharedTo.push("*");
          Traduxio.addActivity(work.edits,{action:"shared",version:version_name,to:work.privileges.owner});
        }
        actions.push("created "+version_name+" version");
        Traduxio.addActivity(work.edits,{action:"created",version:version_name});
        created=true;
      } else {
        log("Version "+version_name+" already exists");
        return [null,{code:403,body:"Version "+version_name+" already exists"}];
      }
    }
  }

  work.edits=work.edits||[];

  work.privileges=work.privileges || {};

  if (req.method=="DELETE") {
    if (!version_name && original) {
      work._deleted = true;
      actions.push("document removed");
      Traduxio.addActivity(work.edits,{action:"deleted"});
    } else if (version_name=="original") {
      if (work.text) {
        delete work.text;
        actions.push("original version removed");
        Traduxio.addActivity(work.edits,{action:"deleted",version:"original"});
      }
    } else {
      delete work.translations[version_name];
      actions.push("Translation "+version_name+" removed");
      Traduxio.addActivity(work.edits,{action:"deleted",version:version_name});
    }
    result._deleted=true;
  } else {
    if(!original) {
      if (args.hasOwnProperty("work-creator")) {
        if (doc.creator != args["work-creator"]) {
          actions.push("changed translated author from "+doc.creator+" to "+args["work-creator"]);
          doc.creator = args["work-creator"];
          result["work-creator"]=doc.creator;
        }
        delete args["work-creator"];
      }
      if(args.hasOwnProperty("creator")) {
        var new_name = args["creator"].trim();
        delete args["creator"];
        if(!new_name || typeof new_name != "string" || new_name.length == 0) {
          new_name = version_name;
        }
        if(new_name != version_name) {
          new_name=Traduxio.unique_version_name(new_name);
          work.translations[new_name] = doc;
          delete work.translations[version_name];
          actions.push("changed version name from "+version_name+" to "+new_name);
          Traduxio.addActivity(work.edits,{action:"edited",version:version_name,key:"creator",value:new_name});
          version_name=new_name;
        }
        result.creator=version_name;
      }
    } else {
      if (args.hasOwnProperty("original")) {
        delete args.original;
        if (args.original) {
          if (!work.text) {
            work.text=[""];
            actions.push("created original version");
          }
        }
      }
      if (args.hasOwnProperty("creator")) {
        args["work-creator"]=args["creator"];
        delete args["creator"];
      }
      if (args.hasOwnProperty("work-creator")) {
        actions.push("changed original creator from "+doc["creator"]+" to "+args["work-creator"]);
        Traduxio.addActivity(work.edits,{action:"edited",version:"original",key:"work-creator",value:new_name});
        result["work-creator"]=args["work-creator"];
        doc["creator"]=args["work-creator"];
        delete args["work-creator"];
      }
    }
    var keysOK=["date","language","title","text","creativeCommons","shareTo","public"];
    if (Traduxio.config.canUnShare) {
      keysOK.push("unshare");
    }
    for (var key in args) {
      if (keysOK.indexOf(key)!=-1) {
        if (key=="text") {
          if (!Array.isArray(args[key])) {
            return [null,{code:400,body:"text must be an array"}];
          } else {
            actions.push("set text for "+version_name);
            doc[key]=args[key];
          }
        } else if (key == "public") {
          doc.privileges=doc.privileges || {};
          if (args[key]=="true" || args[key]==true) {
            if (!doc.creativeCommons && !args.creativeCommons)  {
              return [null,{code:403,body:"Can't set the document public without setting a Creative Commons license"}];
            }
            doc.privileges.public=true;
            var name=version_name || "original";
            actions.push(name+" becomes public");
          } else {
            return [null,{code:400,body:"Can't set value "+args[key]+" to public"}];
          }
          continue;
        } else if (key == "creativeCommons") {
          if (!args[key] && doc.privileges) {
            delete doc.privileges.public;
          }
        } else if (key == "shareTo") {
          var shared=validateArray(args[key]);
          if (shared === null) {
            return [null,{code:400,body:key+" must be a string or array"}];
          }
          doc.privileges=doc.privileges || {};
          doc.privileges.sharedTo=doc.privileges.sharedTo || [];
          shared.forEach(function(user) {
            if (doc.privileges.sharedTo.indexOf(user)==-1) {
              doc.privileges.sharedTo.push(user);
              actions.push("shared "+version_name+" to "+user);
            } else {
              actions.push(version_name+" already shared to "+user);
            }
          });
          continue;
        } else if (key == "unshare") {
          var unshared=validateArray(args[key]);
          if (unshared === null) {
            return [null,{code:400,body:key+" must be a string or array"}];
          }
          doc.privileges=doc.privileges || {};
          doc.privileges.sharedTo=doc.privileges.sharedTo || [];
          doc.privileges.sharedTo=doc.privileges.sharedTo.filter(function(user) {
            if (unshared.indexOf(user)!=-1) {
              actions.push("unshared "+version_name+" to "+user);
              return false;
            }
            return true;
          });
          continue;
        } else if (!typeof args[key] == "string") {
          return [null,{code:400,body:key+" must be a string"}];
        }
        if (doc[key] && doc[key] != args[key]) {
          result[key]=args[key];
          actions.push("change "+key+" from "+doc[key]+" to "+args[key]+" for "+version_name);
          doc[key]=args[key];
          Traduxio.addActivity(work.edits,{action:"edited",version:version_name,key:key,value:args[key]});
        } else if (!doc[key]) {
          result[key]=args[key];
          actions.push("set "+key+" to "+args[key]+" for "+version_name);
          doc[key]=args[key];
          Traduxio.addActivity(work.edits,{action:"edited",version:version_name,key:key,value:args[key]});
        }
      } else {
        return [null,{code:400,body:"can't set value for "+key}];
      }
    }
  }
  result.actions=actions;
  adjustLength(work);
  var code;
  if (actions.length) {
    code=req.query=="POST"?201:200;
  } else {
    code=204;
  }
  return [work, {code:code,body:JSON.stringify(result)}];

  // NOTE: the helper functions below are declared inside this handler, not
  // at the top level of the file. CouchDB evaluates the stored source
  // wrapped in parentheses, so trailing top-level declarations turned the
  // whole handler into a syntax error on modern SpiderMonkey ("function
  // statement requires a name"). SpiderMonkey 1.8.5, shipped with CouchDB
  // 1.x, accepted it, so this only surfaced on 3.x.

function adjustLength(work) {
  var l=textLength(work);
  if (work.text) expandText(work.text,l);
  if (work.translations) {
    for (var t in work.translations) {
      var translation=work.translations[t];
      if (!Array.isArray(translation.text)) translation.text=[];
      expandText(translation.text,l);
    }
  }
}

function textLength(work) {
  var l = 1;
  if (work.text) l=work.text.length;
  if (work.translations) {
    for (var t in work.translations) {
      if (work.translations[t].text) {
        l=Math.max(l,work.translations[t].text.length);
      }
    }
  }
  return l;
}

function validateArray(value) {
  if (typeof value=="string") {
    value=[value];
  }
  if (typeof value.indexOf !="function") {
    return null;
  }
  return value;
}

function emptyText(work) {
  return expandText([],textLength(work));
}

function expandText(text,l) {
  for(var i=text.length ; i<l ; i++) {
    text.push("");
  }
  return text;
}
}
