// -*- coding: utf-8, tab-width: 2 -*-

import arrayOfTruths from 'array-of-truths';
import getOwn from 'getown';
import mustBe from 'typechecks-pmb/must-be';
import xmlAttrDict from 'xmlattrdict';

import sendFinalTextResponse from '../../finalTextResponse.mjs';
import plumb from '../util/miscPlumbing.mjs';
import httpErrors from '../../httpErrors.mjs';


const errNoCanvasPattern = httpErrors.notImpl.explain(
  'This service is not configured to support IIIF.').throwable;


function orf(x) { return x || false; }


const EX = function fmtAnnosAsIiif3() {
  throw new Error('Need req.aclMetaCache => use .replyToRequest()!');
};


Object.assign(EX, {

  replyToRequest(srv, req, origHow) {
    const { annos, extraTopFields } = origHow;
    mustBe.ary('Annotations list', annos);
    const canonicalUrl = plumb.guessOrigReqUrl(srv, req);
    mustBe.nest('canonicalUrl', canonicalUrl);

    /* Some viewers cannot understand multi-target annos: For example,
      when we feed Mirador an array of canvas IDs, it will add the anno
      to all those canvases' anno lists, but fails to render the rectangle.
      We thus have to simplify the IIIF target to point to only the one
      canvas that was searched for.
      */

    const annoMeta = orf(annos.meta);
    const { subjTgtSpec } = annoMeta;
    const subjTgtMeta = req.aclMetaCache['tgtUrl:' + subjTgtSpec];
    const canvasId = EX.constructCanvasId(subjTgtMeta);
    if (!canvasId) { throw errNoCanvasPattern(); }

    const fmtCtx = {
      logCkp: req.logCkp.bind(req),
      canvasId,
      subjTgtSpec,
    };

    const coll = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      type: ['AnnotationPage'],
      id: canonicalUrl,
      items: arrayOfTruths.ifAnyMap(annos, EX.fmtOneAnno.bind(null, fmtCtx)),
      ...annoMeta.extraTopFields,
      ...extraTopFields,
    };
    return sendFinalTextResponse.json(req, coll);
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
    'source',
    'scope',
  ],


  fmtOneAnno(fmtCtx, origAnno) {
    const target = (EX.fmtIiifTarget(fmtCtx, origAnno)
      || 'about:error/no_iiif_target_canvas');
    const anno = {
      type: 'Annotation',
      target,
      body: {
        type: 'TextualBody',
        format: 'text/plain',
        value: origAnno['dc:title'],
      },
    };
    if (fmtCtx.svgShapes) {
      anno.body.value += (' / SVG shapes: ' + fmtCtx.svgShapes.map(
        s => s['']).join(','));
    }
    return anno;
  },


  fmtIiifTarget(fmtCtx, origAnno) {
    const {
      logCkp,
      canvasId,
      subjTgtSpec,
    } = fmtCtx;
    let foundProp;
    const origTargets = arrayOfTruths(origAnno.target);
    const foundIdx = origTargets.findIndex(function findIiifTarget(origTgt) {
      const k = EX.iiifTargetMatchPropsOrder.find(
        p => (origTgt[p] === subjTgtSpec));
      if (!k) { return false; }
      foundProp = k;
      return true;
    });
    if (!foundProp) { return ''; }
    const foundTgt = origTargets[foundIdx];

    const sel = orf(foundTgt.selector);
    if (sel.type === 'SvgSelector') {
      const svgShapes = EX.findSvgShapes(sel.value);
      Object.assign(fmtCtx, { svgShapes });
      if (svgShapes) {
        const { single } = svgShapes;
        if (single[''] === 'rect') {
          const nums = ['x', 'y', 'width', 'height'].map(
            k => Math.round(+single[k] || 0));
          return canvasId + '#xywh=' + nums.join(',');
        }
        logCkp('IIIF unsupported SVG selector:', { canvasId, svgShapes });
      }
    }

    logCkp('IIIF no selector:', { canvasId });
    return canvasId;
  },


  xmlTagsRgx: /<[ -;=\?-\uFFFF]+>/g,


  findSvgShapes(origSvg) {
    let svg = origSvg.replace(/\s+/g, ' ');
    const shapes = [];
    svg = svg.replace(EX.xmlTagsRgx, function foundTag(m) {
      const t = xmlAttrDict(m);
      const n = t[''];
      if (n.startsWith('/')) { return ''; }
      if (n === '?xml') { return ''; }
      if (n === 'svg') { return ''; }
      shapes.push(t);
      return '';
    });
    shapes.textContent = svg.trim();
    shapes.single = orf((shapes.length <= 1) && shapes[0]);
    return shapes.length && shapes;
  },


});


export default EX;
