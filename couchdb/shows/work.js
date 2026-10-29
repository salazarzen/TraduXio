function(o, req) {

  var js_i18n_elements=[
    "i_read","i_edit","i_show","i_copy_from","i_search_concordance",
    "i_confirm_delete","i_delete_version","i_delete_original", "i_no_title", "i_no_author",
    "i_share","i_public","i_shared","i_public","i_private"
    ,"i_activity_","i_chat_"
    ,"i_glossary_"
  ];


  var doc=o;
  // !code lib/traduxio.js
  // !code lib/mustache.js
  // !code lib/hexapla.js

  var i18n=localized();

  function getTextLength() {
    if (o.text)
      return o.text.length;
    for (var versionId in o.translations)
      return o.translations[versionId].text.length;
  }

  var newWork = false;

  if (o===null) {
    o={translations:{},language:getMyLanguage()};
    newWork=true;
    o.privileges={};
    if (Traduxio.getUser().name) {
      o.privileges.owner=Traduxio.getUser().name;
    } else {
      o.privileges.public=true;
    }
  }
  o.privileges=o.privileges||{};
  var data = {
    id: o._id,
    headers: [],
    units: [],
    rows:[],
    lines:1,
    i18n:i18n
  }
  if (Traduxio.canAccess(o) && (!newWork || Traduxio.canEdit(o))) {
    data.seq=req.info.update_seq;
    data.work_title=o.title;
    data.display_work_title=o.title?o.title:i18n["i_no_title"];
    data.work_creator=o.creator;
    data.display_work_creator=o.creator?o.creator:i18n["i_no_author"];
    data.work_language=o.language;
    data.original=o.text ? true : false;
    data.date=o.date;
    data.lines=getTextLength();
    data.canEdit=Traduxio.canEdit(o);
    data.canAccess=true;
    data.canDelete=Traduxio.canDelete(o);
    data.canTranslate=Traduxio.canTranslate(o);
    data.hasSharedAccess=Traduxio.isOwner(o) || Traduxio.hasSharedAccess(o);

    if (!newWork) {
      var hexapla = new Hexapla();
      var edited_versions=req.query.edit ? req.query.edit.split("|") : [];
      var opened_versions=req.query.open ? req.query.open.split("|") : [];
      var public=o.privileges.public;
      var shared=o.privileges.sharedTo && o.privileges.sharedTo.length;
      var shareValue=public ? "public" : (shared ? "shared" : "private");
      if (o.text) {
        hexapla.addVersion({
          id: "original",
          text: o.text
        });
        data.headers.push({
          version: "original",
          is_original: true,
          title: o.title,
          language: o.language,
          date: o.date,
          raw:o.text,
          creativeCommons: o.creativeCommons,
          edited: (edited_versions.indexOf("original")!=-1) && Traduxio.canEdit(o),
          opened: (opened_versions.indexOf("original")!=-1),
          owner:o.privileges.owner,
          shareValue:shareValue,
          sharedTo:o.privileges.sharedTo,
          public:o.privileges.public,
          private:!o.privileges.public && (!o.privileges.sharedTo || !o.privileges.sharedTo.length),
          shared:!o.privileges.public && o.privileges.sharedTo && o.privileges.sharedTo.length
        });
      }

      for (var t in o.translations) {
        var translation = o.translations[t];
        translation.privileges=translation.privileges || {};
        if (Traduxio.canAccess(translation)) {
          hexapla.addVersion({
            id: t,
            text: Traduxio.canAccess(translation) ? translation.text : [""],
          });
          var public=translation.privileges.public;
          var shared=translation.privileges.sharedTo && translation.privileges.sharedTo.length;
          var shareValue=public ? "public" : (shared ? "shared" : "private");
          data.headers.push({
            version:t,
            title: translation.title,
            work_creator: translation.creator || "",
            creator: t,
            language: translation.language || "",
            date: translation.date,
            raw:Traduxio.canAccess(translation) ? translation.text : [],
            creativeCommons: translation.creativeCommons,
            canAccess: Traduxio.canAccess(translation),
            opened: Traduxio.canAccess(translation) && (opened_versions.indexOf(t)!== -1),
            canEdit: Traduxio.canEdit(translation),
            canDelete: Traduxio.canDelete(translation),
            hasSharedAccess: Traduxio.isOwner(translation) || Traduxio.hasSharedAccess(translation),
            edited: Traduxio.canEdit(translation) && (edited_versions.indexOf(t)!== -1),
            owner:translation.privileges.owner,
            shareValue:shareValue,
            sharedTo:translation.privileges.sharedTo,
            public:translation.privileges.public,
            private:!translation.privileges.public && (!translation.privileges.sharedTo || !translation.privileges.sharedTo.length),
            shared:!translation.privileges.public && translation.privileges.sharedTo && translation.privileges.sharedTo.length
          });
        }
      }
      data.rows=hexapla.getRows();
    }

    data.page_title=data.work_creator+" : "+data.work_title;
    data.language=data.work_language;
    if (o.glossary) {
      var glossary=o.glossary;
    } else {
      glossary={};
    }
    delete glossary.edits;
    data.glossary=JSON.stringify(glossary);
    data.notext=o.text ? false : true;
    data.original=o.text ? true : (newWork ? true : false);
    if (data.headers.length==1) {
      data.justOneText=true;
      data.version=data.headers[0].version
    }

    if (Traduxio.config.canUnShare) data.canUnShare=Traduxio.config.canUnShare;
  }

  data.prefix="..";
  data.name="work";
  data.css=true;
  data.script=true;
  data.scripts=["jquery.selection","jquery.ajax-retry","activity","jquery.highlight","jquery-ui"];
  data.extraCss=["jquery-ui"];
  if (this.couchapp.traduxio.chat) data.scripts.push("chat");
  if (this.couchapp.traduxio.sessions) data.scripts.push("sessions");

  return Mustache.to_html(this.templates.work, data, this.templates.partials);
}
