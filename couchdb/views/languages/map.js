function(o) {
  if (o.language) emit(o.language);
  if (o.translations) {
    for (var versionId in o.translations) {
      var t = o.translations[versionId];
      if (t.language) emit(t.language);
    }
  }
}
