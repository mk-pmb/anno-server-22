'use strict';
/* globals window, document */

(function namespace() {
  const frm = document.forms.quicklogin;
  const qlu = window.quickLoginUsers || false;

  function addOneUser(user, caption) {
    frm.innerHTML += ('<label><input type="radio" name="user" value="'
      + user + '"><p>' + (caption || user) + '</p></label>');
  }
  Object.entries(qlu).forEach(userAndCaption => addOneUser(...userAndCaption));

  let cookieUser = ((';' + document.cookie + ';').split(/; *user=/)[1]
    || '').split(';')[0];
  (function checkInitialUser() {
    const ckb = frm.querySelector('input[value="' + cookieUser + '"]');
    if (ckb) { ckb.checked = true; }
    console.debug('QuickLogin checkInitialUser:', { cookieUser, ckb, qlu });
  }());

  function setUser(evt) {
    const tgt = evt.target;
    if (tgt.type !== 'radio') { return; }
    if (tgt.name !== 'user') { return; }
    if (tgt.value === cookieUser) { return; }
    const setCookie = 'user=' + tgt.value + '; path=/';
    console.debug({ tgt, setCookie });
    document.cookie = setCookie;
    cookieUser = tgt.value;
  }

  frm.onclick = setUser;
  frm.onchange = setUser;
}());
