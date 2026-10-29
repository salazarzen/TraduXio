$.fn.concordancify = function() {

  default_language=$("table.concordance").data("search-language") || $("html").prop("lang") || currentLanguage;
  default_query=$("body").data("query") || "";

  var search = $("#nav").data("i_search");

  this.append('<input id="query" type="search" name="query" placeholder="' + search + '" value="'
    +  default_query + '" />');
  this.append('<input id="submit" type="submit" value="'+getTranslated("i_search")+'"/>');
  this.append('<select id="language" name="language"/>');

  var form=this;

  getLanguageNames(function() {
    $.getJSON(getPrefix()+"/languages", function(result) {
      $.each(result.rows, function(i, o) {
        $("#language").append("<option value=\""+o.key+"\">" + o.key + " - " + getLanguageName(o.key) + "</option>");
      });
      var oldLanguage=$("#language").val();
      $("#language").val(default_language);
      if (!$("#language").val() && oldLanguage) {
         $("#language").val(oldLanguage);
      }
    });
  });

  var submitForm=function(event) { //TODO jQuery 2
    event.preventDefault();
    var query = form.find('#query').val().toLowerCase();
    var language = $("#language").val();
    var url = getPrefix()+'/works/concordance?' + $.param({
      startkey: '["' + language + '","' + query + '"]',
      endkey: '["' + language + '","' + query + '\\u9999"]',
      query: query,
      language: language
    });
    if ($("body").is("#concordance")) {
      window.location.href=url;
    } else {
      window.open(url, 'concordance');
    }
  };

  this.on("submit",submitForm);
  $(".submit",form).on("click",submitForm);
  $("#language",form).on("keypress",function(e) {
      if(e.which == 13) {
        submitForm(e);
      }
  });
};

var languagesNames;
var currentLanguage='en';

function getLanguageName(id,target) {
  var result=id;
  target=target || default_language;
  if (languagesNames[id]) {
    var list=languagesNames[id];
    if(list[target]) {
      return list[target];
    } else if (list['en']) {
      return list['en'];
    } else if (list[id]) {
      return list[id];
    } else {
      result=list[Object.keys(list)[0]];
    }
  }
  return result;
}

function getLanguageNames(callback) {
  if (!languagesNames) {
    $.getJSON(getPrefix()+"/shared/languages.json",function(result) {
      languagesNames=result;
      callback(true);
    });
  } else {
     callback(true);
  }
}

$.fn.outerHtml = function() {
  return this.clone().wrap("<div>").parent().html();
};

function getPrefix() {
  return $("body").data("prefix");
}

function fixLanguages(container) {
  getLanguageNames(function() {
    if (container) {
      var language=$(container).find(".language").andSelf().filter(".language");
    } else {
      language=$(".language").not("select").not("li");
    }
    language.each(function() {
      var lang=$(this);
      var langID=lang.data("id") || lang.text();
      if (langID) {
        var langName=langID?getLanguageName(langID):"";
        if (langName) {
          lang.data("id",langID);
          if (lang.is(".expand")) {
            lang.text(langName);
            lang.prop('title',langID);
          } else {
            lang.prop('title',langName);
          }
        }
      }
    });
  });
}

function getTranslated(name) {
  var args=Array.slice ? Array.slice(arguments) : Array.prototype.slice.call(arguments);
  args.shift();
  //show function only sends requested i18n elements, so need to modify the
  //js_i18n_elements array to get them here (and load them inside the template)
  var translation=i18n[name] || name;
  args.forEach(function(arg,i) {
    translation=translation.replace("{"+i+"}",arg);
  });
  return translation;
}

function addModal (content,title) {
  function modalClean() {
    modal.remove();
    $("body").css("overflow",body_overflow);
  }
  var modal=$("<div>").addClass("modal").appendTo("body");
  var body_overflow=$("body").css("overflow");
  $("body").css("overflow","hidden");

  var dialog=$("<div>").addClass("dialog").appendTo(modal);
  if (title) {
    $("<div>").addClass("title").text(title).appendTo(dialog);
  }
  var close=$("<span>").addClass("button close").appendTo(dialog).append("X");
  dialog.on("click",function(e) {e.stopPropagation();});
  modal.on("click",modalClean);
  close.on("click",modalClean);

  modal.clean=modalClean;

  var contentPane=$("<div>").addClass("content").appendTo(dialog);
  contentPane.append(content);
  return modal;
}

function autoSize() {
  // Copy textarea contents; browser will calculate correct height of copy,
  // which will make overall container taller, which will make textarea taller.
  var text = stringToHtml($(this).val());
  $(this).parent().find("div.text").html(text);
  if ($(this).parents().is(".box-wrapper")) {
      $(this).css({'width':'100%','height':'100%'});
  }
}

$(document).ready(function() {
  fixLanguages();
  $("form.concordance").concordancify();
  $("#nav li."+$(document.body).attr("id")).addClass("active");
});

Traduxio=$.extend({},{
    version:"1.0",
    getPrefix:getPrefix,
    getLanguagesNames:getLanguageNames,
    getLanguageName:getLanguageName,
    getTranslated:getTranslated,
    addCss:function(name) {
      $("<link/>", {
         rel: "stylesheet",
         type: "text/css",
         href: Traduxio.getPrefix()+"/shared/css/"+name+".css"
      }).appendTo("head");
    },
    getId:function() {
      return $("#hexapla").data("id");
    },
    getSeqNum:function() {
      return $(document.body).data("seq");
    },
    // When the server rendered this page. Used to tell activity already on
    // the page from activity that has arrived since.
    getRenderedAt:function() {
      return new Date($(document.body).data("rendered-at"));
    }
  }
);
