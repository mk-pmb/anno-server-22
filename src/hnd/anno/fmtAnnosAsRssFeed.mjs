// -*- coding: utf-8, tab-width: 2 -*-

import arrayOfTruths from 'array-of-truths';
import dateFmtRfc822 from 'rfc822-date';
import mapValues from 'lodash.mapvalues';
import mustBe from 'typechecks-pmb/must-be';
import xmlenc from 'xmlunidefuse';

import fmtAnnoRssLink from '../rss/fmtAnnoRssLink.mjs';
import prettyJson from '../util/prettyJson.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';


function orf(x) { return x || false; }
function xmlStrTag(t, c) { return `    <${t}>${xmlenc(c)}</${t}>\n`; }


function fmtAnnoRssDate(x, a) {
  let d = x;
  if ((!d) && (d !== 10)) {
    console.warn('W: fmtAnnoRssDate: Invalid date:', d, 'in anno', a.id);
    d = 0;
  }
  if (!d.getDay) { d = new Date(d); }
  return dateFmtRfc822(d);
}


const EX = function fmtAnnosAsRssFeed(how) {
  const {
    annos,
    feedTitle,
    extraTopFields,
    linkTpl: origLinkTpl,
    req,
    srv,
    ...unexpected
  } = how;
  delete unexpected.untrustedOpt;
  mustBe.keyless('Unexpected options', unexpected);
  mustBe.ary('Annotations list', annos);

  const meta = orf(annos.meta);
  let lnk = origLinkTpl || EX.defaultLinkTpl(meta);
  if (lnk.startsWith('/')) { lnk = srv.publicBaseUrlNoSlash + lnk; }

  const dateFieldName = (how.dateFieldName || 'created');
  const [subFmt1] = meta.outFmtSub;
  const subjUrls = ((subFmt1 === 'tgt')
    && meta.subjTgtUrlsByResultIndex) || '';

  const rss = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '  ><channel>',
    xmlStrTag('title', feedTitle || 'Annotations'),
    ...Object.values(mapValues(extraTopFields, EX.fmtOneExtraTopField)),

    ...arrayOfTruths(annos).map((a, rIdx) => ('  <item>\n'
      + xmlStrTag('title', a['dc:title'] || a.title || '(untitled)')
      + xmlStrTag('link', fmtAnnoRssLink(lnk, a, meta))
      + xmlStrTag('pubDate', fmtAnnoRssDate(a[dateFieldName], a))
      + (subjUrls && EX.renderTargetLinks(subjUrls[rIdx]))
      + '  </item>')),
    '</channel>',
    '</rss>\n'].filter(Boolean).join('\n');
  return sendFinalTextResponse(req, { text: rss, type: 'rss' });
};



Object.assign(EX, {

  defaultMaxItems: 50,

  defaultLinkTpl(meta) {
    const { rssMode } = orf(meta);
    if (rssMode === 'version-history') { return '%hu'; }
    return '%au';
  },

  fmtAnnoRssDate,


  fmtOneExtraTopField(v, k) {
    let w = v;
    if ((w && typeof w) === 'object') { w = prettyJson(v); }
    return '  <!-- ' + xmlenc(String(k + ': ' + w)) + ' -->';
  },


  renderTargetLinks(origList) {
    let list = new Set(origList);
    list = Array.from(list.values());
    list = list.map(url => xmlStrTag('dc:references', url));
    return list.join('');
  },




});



export default EX;
