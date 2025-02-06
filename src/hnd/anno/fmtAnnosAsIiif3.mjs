// -*- coding: utf-8, tab-width: 2 -*-

import arrayOfTruths from 'array-of-truths';
import getOwn from 'getown';
import mustBe from 'typechecks-pmb/must-be';
import shapeToPath from 'svg-shape-to-path-pmb';
import xmlAttrDict from 'xmlattrdict';

import httpErrors from '../../httpErrors.mjs';
import plumb from '../util/miscPlumbing.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';


const errNoCanvasPattern = httpErrors.notImpl.explain(
  'This service is not configured to support IIIF.').throwable;
const errSvgSelectorLacksDimension = httpErrors.fubar.explain(
  'The SVG selector for this annotation cannot be scaled to the target image'
  + ' size because it lacks required size information or uses an unsupported'
  + ' unit of length');
const errSvgSelectorExoticScalingFailure = httpErrors.fubar.explain(
  'Exotic failure in control flow or math while trying to scale SVG selector.');
const errSvgSelectorNotOpened = httpErrors.fubar.explain(
  'The SVG selector for this annotation lacks an opening SVG tag');


function orf(x) { return x || false; }
function propIf(o, k) { return (o && o[k]) || o; }


const EX = function fmtAnnosAsIiif3() {
  throw new Error('Need req.aclMetaCache => use .replyToRequest()!');
};


Object.assign(EX, {

  miradorAcceptableMotivation: 'commenting', /*
    Mirador 3 accepts these motivations:
      * commenting
      * tagging (ignores body type and assumes text/plain)
    Mirador 3 will ignore annos with these motivations:
      * linking
      * replying
      * (maybe more?)
  */


  openSvgTagBaseProps: {
    '': 'svg',
    xmlns: 'http://www.w3.org/2000/svg',
    version: '1.1',
  },
  openSvgTagCopyProps: ['x', 'y', 'width', 'height', 'viewbox'], /*
    Some of our annos carry useless xlink NS in their SVG tags, so we only
    copy essential attributes, and also only ones for which we can rely on
    having simple values that we can blindly requote from double quotes to
    apostrophe. */


  replyToRequest(srv, req, origHow) {
    const { annos, extraTopFields } = origHow;
    mustBe.ary('Annotations list', annos);
    const canonicalUrl = plumb.guessOrigReqUrl(srv, req);
    mustBe.nest('canonicalUrl', canonicalUrl);

    const annoListMeta = orf(annos.meta);
    const fmtCtx = {
      ...EX.predictCanvasForMultiTargetAnno(annoListMeta, req.aclMetaCache),
      logCkp: req.logCkp.bind(req),
      scaleTo: EX.decideTargetScaling(annoListMeta),
    };

    const coll = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      type: 'AnnotationPage', /* No array! Mirador 3 expects string. */
      id: canonicalUrl,
      items: arrayOfTruths.ifAnyMap(annos, EX.fmtOneAnno.bind(null, fmtCtx)),
      ...annoListMeta.extraTopFields,
      ...extraTopFields,
    };
    return sendFinalTextResponse.json(req, coll);
  },


  predictCanvasForMultiTargetAnno(annoListMeta, aclMetaCache) {
    /* Some viewers cannot understand multi-target annos: For example,
      when we feed Mirador an array of canvas IDs, it will add the anno
      to all those canvases' anno lists, but fails to render the rectangle.
      We thus have to simplify the IIIF target to point to only the one
      canvas that was searched for. */
    const { subjTgtSpec } = annoListMeta;
    const subjTgtMeta = aclMetaCache['tgtUrl:' + subjTgtSpec];
    const canvasId = EX.constructCanvasId(subjTgtMeta);
    if (!canvasId) { throw errNoCanvasPattern(); }
    return { canvasId, subjTgtMeta, subjTgtSpec };
  },


  decideTargetScaling(meta) {
    /* Some viewers, like Mirador (@2025-02-06, issue 3875), don't scale
      the SVG selector to the target image. Also for single rectangles,
      we have to provide absolute xywh. Both mean we need to scale the
      SVG selector server-side. */
    const w = (+meta.scaleTargetWidth || 0);
    const h = (+meta.scaleTargetHeight || 0);
    return ((w >= 1) || (h >= 1)) && { w, h };
    // ^-- These checks are meant to be quick, not overly fool-proof.
  },


  constructCanvasId(subjTgtMeta) {
    let canvas = orf(subjTgtMeta).iiifCanvasIdPattern;
    if (!canvas) { return ''; }
    mustBe.nest('iiifCanvasIdPattern', canvas);
    canvas = canvas.replace(/%\{([ -z\|~]+)\}/g,
      (m, k) => String(m && getOwn(subjTgtMeta, k, '')));
    canvas = canvas.trim();
    return canvas;
  },


  iiifTargetMatchPropsOrder: [
    'id',
    'source',
    'scope',
  ],


  isTargetMatch(wantUrl, curTgt) {
    return ((curTgt === wantUrl)
      || EX.iiifTargetMatchPropsOrder.some(p => (curTgt[p] === wantUrl)));
  },


  pickIiifTarget(subjTgtSpec, origAnno) {
    /* Since some viewers cannot handle multi-target annos, we have to
      extract the one target that was searched for. */
    const origTargets = arrayOfTruths.ifAny(origAnno.target);
    if (!origTargets) { return ''; }
    const replyTargets = arrayOfTruths.ifAny(origAnno['as:inReplyTo']);
    let firstSelectorMatch;
    let firstWholeMatch;
    origTargets.some(function findIiifTarget(origTgt) {
      if (!EX.isTargetMatch(subjTgtSpec, origTgt)) {
        // console.debug('pickIiifTarget: no match:', subjTgtSpec, origTgt);
        return false;
      }
      if (replyTargets) {
        const isReply = replyTargets.find(t => EX.isTargetMatch(t, origTgt));
        if (isReply) {
          // console.debug('pickIiifTarget: reply:', isReply, origTgt);
          return false;
        }
      }
      if (origTgt.selector) {
        if (!firstSelectorMatch) { firstSelectorMatch = origTgt; }
        return true; // perfect, stop scanning.
      }
      if (!firstWholeMatch) { firstWholeMatch = origTgt; }
      return false;
    });
    return (firstSelectorMatch || firstWholeMatch || '');
  },


  fmtOneAnno(fmtCtx, origAnno) {
    const annoIdUrl = origAnno.id;
    const annoTarget = EX.pickIiifTarget(fmtCtx.subjTgtSpec, origAnno);
    const selector = orf(annoTarget.selector);
    const svgShapes = orf((selector.type === 'SvgSelector')
      && EX.findSvgShapes(selector.value, annoIdUrl, fmtCtx.scaleTo));
    const tgtMeta = fmtCtx.subjTgtMeta;
    const iiifTarget = EX.fmtIiifTarget(fmtCtx,
      { annoTarget, selector, svgShapes });

    /* As of 2025-01-24, Mirador 3 seems to not support IIIF cookbook
      recipe #22 "Linking with a hotspot", so instead we have to try and
      use an HTML body for the link: */
    let htmlBody = xmlAttrDict({ '': 'span', '¶': origAnno['dc:title'] });
    if (tgtMeta.iiifAnnoIdUrlLinkCaption) {
      const scope = (tgtMeta.iiifAnnoIdUrlLinkToScope
        && propIf(annoTarget.scope, 'id'));
      htmlBody = xmlAttrDict({
        '': 'a',
        href: scope || annoIdUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        '¶': tgtMeta.iiifAnnoIdUrlLinkCaption || '[link]',
      }) + '&nbsp;&nbsp; ' + htmlBody;
    }
    htmlBody = xmlAttrDict({
      '': 'p', /*
        Mirador 3 loads the body into a span, so we shouldn't wrap it in a
        block level element. */
      'class': 'as22-iiif-anno-body',
      '|': htmlBody,
    });

    const iiifAnno = {
      id: annoIdUrl,
      type: 'Annotation',
      motivation: EX.miradorAcceptableMotivation,
      target: iiifTarget,
      body: {
        type: 'TextualBody',
        format: 'text/html',
        value: htmlBody,
      },
    };
    // if (!svgShapes) { iiifAnno['skos:note'] = { nShapes: 0, annoTarget }; }
    return iiifAnno;
  },


  fmtIiifTarget(fmtCtx, how) {
    if (!fmtCtx.canvasId) { throw new Error('Missing canvasId!'); }
    if (how.svgShapes) { return EX.fmtIiifTargetSvgSelector(fmtCtx, how); }
    return fmtCtx.canvasId;
  },


  fmtIiifTargetSvgSelector(fmtCtx, how) {
    // const { logCkp } = fmtCtx;
    const { canvasId } = fmtCtx;
    const { svgShapes } = how;
    const { single } = svgShapes;
    if (single[''] === 'rect') {
      const nums = ['x', 'y', 'width', 'height'].map(
        k => Math.round(+single[k] || 0));
      return canvasId + '#xywh=' + nums.join(',');
    }

    const sel = { ...how.selector };
    const openSvgTag = { ...EX.openSvgTagBaseProps };
    EX.openSvgTagCopyProps.forEach(function copy(k) {
      const v = svgShapes.svgTag[k];
      if (v) { openSvgTag[k] = v; }
    });

    sel.value = (xmlAttrDict(openSvgTag).replace(/"/g, "'")
      + svgShapes.map(shapeToPath.xad).join('')
      + '</svg>');
    // logCkp('IIIF converted SVG selector:', { canvasId, svgShapes, sel });
    return { type: 'SpecificResource', source: canvasId, selector: sel };
  },


  findSvgShapes(svg, annoIdUrl, scaleTo) {
    const shapes = [];
    let doScale;

    function foundTag(t) {
      const n = t[''];
      if (n.startsWith('/')) { return; }
      if (n === '?xml') { return; }
      if (n === 'svg') {
        shapes.svgTag = t;
        doScale = EX.calcScalingFactors(annoIdUrl, scaleTo, t); /*
          If the width and/or height attribute of .svgTag needed adjusting,
          calcScalingFactors has sneakily done that inplace. */
        return;
      }
      const s = (doScale ? shapeToPath.scaleOneSvgTag(doScale, t) : t);
      shapes.push(s);
    }

    xmlAttrDict.splitXml(svg, { onto: null, verbatim: '<>', onTag: foundTag });
    if (!shapes.svgTag) { throw errSvgSelectorNotOpened.explain(annoIdUrl); }
    const n = shapes.length;
    if (!n) { return false; }
    shapes.single = orf((n <= 1) && shapes[0]);
    return shapes;
  },


  calcScalingFactors: (function compile() {
    const f = function calcScalingFactors(annoIdUrl, scaleTo, t) {
      if (!scaleTo) { return false; }
      const x = f.div(annoIdUrl, scaleTo.w, t, 'width');
      const y = f.div(annoIdUrl, scaleTo.h, t, 'height') || x;
      if (!y) { throw errSvgSelectorExoticScalingFailure; }
      if ((x === 1) && (y === 1)) { return false; }
      return { x, y };
    };
    f.div = function scaleDivide(annoIdUrl, to, svgTag, svgProp) {
      if (!to) { return 0; }
      let v = (svgTag[svgProp] || '');
      if (v.endsWith('px')) { v = v.slice(0, -2); }
      v = (+v || 0);
      if (v === to) { return 1; }
      if (v >= 1) {
        // console.debug('scaleDivide', annoIdUrl, svgProp, to, svgTag);
        svgTag[svgProp] = to; // eslint-disable-line no-param-reassign
        return to / v;
      }
      throw errSvgSelectorLacksDimension.explain(svgProp + ' in ' + annoIdUrl);
    };
    return f;
  }()),


});


export default EX;
